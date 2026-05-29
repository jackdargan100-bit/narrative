import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") ?? "";
const BIRDEYE_API_KEY = Deno.env.get("BIRDEYE_API_KEY") ?? "";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface WalletTrade {
  id: string;
  token_name: string;
  token_symbol: string;
  contract_address: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number;
  setup_type: string;
  notes: string;
  status: "open" | "closed";
  tx_signature: string;
  timestamp: number;
  trade_type: "buy" | "sell";
  token_amount: number;
  sol_amount: number;
  usd_value: number | null;
}

// Helius enhanced transaction shape (partial — only fields we use)
// deno-lint-ignore no-explicit-any
type HeliusTx = Record<string, any>;

// Stablecoins + wrapped native assets to skip as trade targets
const SKIP_MINTS = new Set([
  "So11111111111111111111111111111111111111112",         // wSOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",     // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",      // USDT
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",     // ETH (Wormhole)
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",      // mSOL
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",      // bSOL
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",     // jitoSOL
]);

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

// ---------------------------------------------------------------------------
// Fetch ALL recent transactions — no type filter
// KEY FIX: Helius type=SWAP misses many real swaps (Jupiter, Pump.fun, etc.)
// that are classified as UNKNOWN or other types. We fetch all and parse
// swap events from the events.swap structure instead.
// ---------------------------------------------------------------------------
async function fetchAllTxs(wallet: string, limit: number): Promise<HeliusTx[]> {
  const all: HeliusTx[] = [];
  let before: string | undefined;
  const pageSize = 100;

  while (all.length < limit) {
    const url = new URL(`https://api.helius.xyz/v0/addresses/${wallet}/transactions`);
    url.searchParams.set("api-key", HELIUS_API_KEY);
    url.searchParams.set("limit", String(Math.min(pageSize, limit - all.length)));
    // NO type filter — fetch everything, parse swap events ourselves
    if (before) url.searchParams.set("before", before);

    const res = await fetch(url.toString());

    if (res.status === 429) {
      throw Object.assign(
        new Error("Helius rate limit reached. Wait a few seconds and try again."),
        { code: "RATE_LIMIT" }
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw Object.assign(
        new Error("Invalid or missing Helius API key. Check your Edge Function secret."),
        { code: "AUTH" }
      );
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Helius API error ${res.status}: ${text.slice(0, 300)}`);
    }

    const batch: HeliusTx[] = await res.json();
    if (!batch.length) break;
    all.push(...batch);
    before = batch[batch.length - 1].signature;
    if (batch.length < pageSize) break;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Token metadata via Helius DAS
// ---------------------------------------------------------------------------
const metaCache = new Map<string, { name: string; symbol: string }>();

async function getTokenMeta(mint: string): Promise<{ name: string; symbol: string }> {
  if (metaCache.has(mint)) return metaCache.get(mint)!;
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "m", method: "getAsset", params: { id: mint } }),
    });
    if (res.ok) {
      const j = await res.json();
      const m = j?.result?.content?.metadata;
      if (m?.name) {
        const result = { name: m.name as string, symbol: (m.symbol as string) ?? "???" };
        metaCache.set(mint, result);
        return result;
      }
    }
  } catch { /* fall through */ }
  const fallback = { name: `${mint.slice(0, 4)}…${mint.slice(-4)}`, symbol: "???" };
  metaCache.set(mint, fallback);
  return fallback;
}

// ---------------------------------------------------------------------------
// Birdeye USD price
// ---------------------------------------------------------------------------
async function getUsdPrice(mint: string): Promise<number | null> {
  if (!BIRDEYE_API_KEY) return null;
  try {
    const res = await fetch(`https://public-api.birdeye.so/defi/price?address=${mint}`, {
      headers: { "X-API-KEY": BIRDEYE_API_KEY },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.data?.value ?? null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Detect swap events from a transaction — handles multiple DEX shapes
// ---------------------------------------------------------------------------
type RawSwap = {
  sig: string;
  timestamp: number;
  tx_type: string;
  source: string;
  description: string;
  tradeType: "buy" | "sell";
  mint: string;
  tokenAmount: number;
  solAmount: number;
  swapDetectedVia: string;
};

function extractSwap(tx: HeliusTx): RawSwap | null {
  const sig = tx.signature ?? "";
  const timestamp = tx.timestamp ?? 0;
  const tx_type = tx.type ?? "UNKNOWN";
  const source = tx.source ?? "";
  const description = (tx.description ?? "").replace(/\s+/g, " ").trim();

  // --- Path 1: events.swap (Helius classified SWAPs, Jupiter, Raydium etc.) ---
  const swap = tx.events?.swap;
  if (swap) {
    const solIn  = swap.nativeInput  ? Number(swap.nativeInput.amount)  / 1e9 : 0;
    const solOut = swap.nativeOutput ? Number(swap.nativeOutput.amount) / 1e9 : 0;
    const tokOut = swap.tokenOutputs?.[0];
    const tokIn  = swap.tokenInputs?.[0];

    if (solIn > 0 && tokOut && !SKIP_MINTS.has(tokOut.mint) && tokOut.tokenAmount > 0) {
      return { sig, timestamp, tx_type, source, description, tradeType: "buy",  mint: tokOut.mint, tokenAmount: tokOut.tokenAmount, solAmount: solIn,  swapDetectedVia: "events.swap/buy" };
    }
    if (solOut > 0 && tokIn && !SKIP_MINTS.has(tokIn.mint) && tokIn.tokenAmount > 0) {
      return { sig, timestamp, tx_type, source, description, tradeType: "sell", mint: tokIn.mint,  tokenAmount: tokIn.tokenAmount,  solAmount: solOut, swapDetectedVia: "events.swap/sell" };
    }
    // Token-to-token swap — SOL not directly involved, treat the output token as a buy
    if (tokOut && tokIn && !SKIP_MINTS.has(tokOut.mint) && tokOut.tokenAmount > 0) {
      const inputValue = tokIn.tokenAmount; // raw token units — best-effort
      return { sig, timestamp, tx_type, source, description, tradeType: "buy", mint: tokOut.mint, tokenAmount: tokOut.tokenAmount, solAmount: inputValue / 1e6, swapDetectedVia: "events.swap/tok-tok" };
    }
  }

  // --- Path 2: tokenTransfers heuristic (Pump.fun, unknown DEXes) ---
  const transfers: HeliusTx[] = tx.tokenTransfers ?? [];
  const nativeTransfers: HeliusTx[] = tx.nativeTransfers ?? [];

  const solOut2 = nativeTransfers
    .filter((t: HeliusTx) => t.fromUserAccount === tx.feePayer)
    .reduce((s: number, t: HeliusTx) => s + (Number(t.amount) / 1e9), 0);
  const solIn2 = nativeTransfers
    .filter((t: HeliusTx) => t.toUserAccount === tx.feePayer)
    .reduce((s: number, t: HeliusTx) => s + (Number(t.amount) / 1e9), 0);

  const tokReceived = transfers.find((t: HeliusTx) => t.toUserAccount === tx.feePayer && !SKIP_MINTS.has(t.mint));
  const tokSent     = transfers.find((t: HeliusTx) => t.fromUserAccount === tx.feePayer && !SKIP_MINTS.has(t.mint));

  if (solOut2 > 0.0005 && tokReceived && Number(tokReceived.tokenAmount) > 0) {
    return { sig, timestamp, tx_type, source, description, tradeType: "buy",  mint: tokReceived.mint, tokenAmount: Number(tokReceived.tokenAmount), solAmount: solOut2, swapDetectedVia: "nativeTransfers/buy" };
  }
  if (solIn2 > 0.0005 && tokSent && Number(tokSent.tokenAmount) > 0) {
    return { sig, timestamp, tx_type, source, description, tradeType: "sell", mint: tokSent.mint,     tokenAmount: Number(tokSent.tokenAmount),     solAmount: solIn2,  swapDetectedVia: "nativeTransfers/sell" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parse all transactions into trades
// ---------------------------------------------------------------------------
async function parseTrades(txs: HeliusTx[]): Promise<{ trades: WalletTrade[]; debug: object }> {
  const swapEvents: RawSwap[] = [];
  const filterReasons: string[] = [];

  for (const tx of txs) {
    const swap = extractSwap(tx);
    if (swap) {
      swapEvents.push(swap);
    } else {
      filterReasons.push(`${(tx.signature ?? "").slice(0, 12)}… type=${tx.type ?? "?"} source=${tx.source ?? "?"} hasSwapEvent=${!!tx.events?.swap} transfers=${(tx.tokenTransfers ?? []).length}`);
    }
  }

  swapEvents.sort((a, b) => a.timestamp - b.timestamp);

  const uniqueMints = [...new Set(swapEvents.map(e => e.mint))];
  await Promise.all(uniqueMints.map(m => getTokenMeta(m)));

  const buyStacks = new Map<string, WalletTrade[]>();
  const result: WalletTrade[] = [];

  for (const ev of swapEvents) {
    const meta = await getTokenMeta(ev.mint);
    const entryPrice = ev.tokenAmount > 0 ? ev.solAmount / ev.tokenAmount : 0;
    const date = new Date(ev.timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    if (ev.tradeType === "buy") {
      const trade: WalletTrade = {
        id: ev.sig,
        token_name: meta.name,
        token_symbol: meta.symbol,
        contract_address: ev.mint,
        entry_price: entryPrice,
        exit_price: null,
        stop_loss: null,
        take_profit: null,
        position_size: ev.solAmount,
        setup_type: suggestSetup(ev.solAmount),
        notes: ev.description ? `Buy on ${date}. ${ev.description}` : `Buy detected on ${date}.`,
        status: "open",
        tx_signature: ev.sig,
        timestamp: ev.timestamp,
        trade_type: "buy",
        token_amount: ev.tokenAmount,
        sol_amount: ev.solAmount,
        usd_value: null,
      };
      const stack = buyStacks.get(ev.mint) ?? [];
      stack.push(trade);
      buyStacks.set(ev.mint, stack);
      result.push(trade);
    } else {
      const stack = buyStacks.get(ev.mint) ?? [];
      const openBuy = stack.shift();
      if (openBuy) {
        openBuy.exit_price = entryPrice;
        openBuy.status = "closed";
        openBuy.notes += ` Closed on ${date}.`;
      }
    }
  }

  if (BIRDEYE_API_KEY) {
    await Promise.all(
      result.filter(t => t.status === "open").map(async t => {
        const price = await getUsdPrice(t.contract_address);
        if (price !== null) t.usd_value = price * t.token_amount;
      })
    );
  }

  const debug = {
    txs_fetched: txs.length,
    swaps_detected: swapEvents.length,
    trades_built: result.length,
    swap_breakdown: swapEvents.map(e => ({
      sig: e.sig.slice(0, 16) + "…",
      type: e.tradeType,
      via: e.swapDetectedVia,
      mint: e.mint.slice(0, 8) + "…",
      sol: e.solAmount.toFixed(4),
      ts: new Date(e.timestamp * 1000).toISOString(),
    })),
    filtered_out_sample: filterReasons.slice(0, 20),
    date_range: txs.length > 0 ? {
      oldest: new Date(Math.min(...txs.map(t => t.timestamp ?? 0)) * 1000).toISOString(),
      newest: new Date(Math.max(...txs.map(t => t.timestamp ?? 0)) * 1000).toISOString(),
    } : null,
    raw_tx_sample: txs.slice(0, 20).map((tx: HeliusTx) => ({
      sig: (tx.signature ?? "").slice(0, 16) + "…",
      type: tx.type ?? "?",
      source: tx.source ?? "?",
      timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : "?",
      has_swap_event: !!tx.events?.swap,
      has_token_transfers: (tx.tokenTransfers ?? []).length,
      has_native_transfers: (tx.nativeTransfers ?? []).length,
      description: (tx.description ?? "").slice(0, 80),
    })),
  };

  return { trades: result.sort((a, b) => b.timestamp - a.timestamp), debug };
}

function suggestSetup(solAmount: number): string {
  if (solAmount >= 20) return "breakout";
  if (solAmount >= 10) return "reclaim";
  if (solAmount >= 5)  return "support_bounce";
  return "momentum_scalp";
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { wallet_address, limit = 100, debug_mode = false } = body as {
      wallet_address?: string;
      limit?: number;
      debug_mode?: boolean;
    };

    if (!wallet_address || typeof wallet_address !== "string") {
      return json({ error: "wallet_address is required" }, 400);
    }

    const addr = wallet_address.trim();

    if (!isValidSolanaAddress(addr)) {
      return json({
        error: "Invalid Solana address. Public keys are 32–44 base58 characters.",
        code: "INVALID_ADDRESS",
      }, 422);
    }

    if (!HELIUS_API_KEY) {
      return json({
        error: "HELIUS_API_KEY is not configured. Add it as an Edge Function secret.",
        code: "NOT_CONFIGURED",
      }, 503);
    }

    const txs = await fetchAllTxs(addr, Math.min(Math.max(limit, 1), 200));

    if (txs.length === 0) {
      return json({
        wallet_address: addr,
        trades: [],
        total: 0,
        source: "helius",
        mock: false,
        debug: { txs_fetched: 0, message: "Helius returned zero transactions for this wallet." },
      });
    }

    const { trades, debug } = await parseTrades(txs);

    return json({
      wallet_address: addr,
      trades,
      total: trades.length,
      source: "helius",
      mock: false,
      debug,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code ?? "UNKNOWN";
    console.error("scan-wallet error:", message);
    const status = code === "RATE_LIMIT" ? 429 : code === "AUTH" ? 401 : 500;
    return json({ error: message, code }, status);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
