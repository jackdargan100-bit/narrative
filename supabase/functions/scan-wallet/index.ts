/**
 * supabase/functions/scan-wallet/index.ts
 *
 * POST  { wallet_address: string, limit?: number }
 *
 * Returns:
 * {
 *   trades: WalletTradeResult[],
 *   debug: { txs_fetched, swaps_detected, trades_built, date_range, swap_breakdown, raw_tx_sample, filtered_out_sample }
 * }
 *
 * WalletTradeResult shape (must match App.tsx interface WalletTradeResult):
 * {
 *   id, token_name, token_symbol, contract_address,
 *   entry_price, exit_price, stop_loss, take_profit,
 *   position_size, setup_type, notes, status,
 *   tx_signature, timestamp, trade_type, token_amount,
 *   sol_amount, usd_value,
 *   selected (always true), mock (always false)
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface HeliusTransaction {
  signature: string;
  timestamp: number; // unix seconds
  type: string;      // "SWAP", "TRANSFER", "UNKNOWN", …
  source: string;    // "JUPITER", "RAYDIUM", …
  description: string;
  tokenTransfers?: HeliusTokenTransfer[];
  nativeTransfers?: HeliusNativeTransfer[];
  events?: {
    swap?: HeliusSwapEvent;
  };
}

interface HeliusTokenTransfer {
  mint: string;
  fromUserAccount: string;
  toUserAccount: string;
  tokenAmount: number;
  symbol?: string;
  decimals?: number;
}

interface HeliusNativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number; // lamports
}

interface HeliusSwapEvent {
  nativeInput?: { account: string; amount: string };
  nativeOutput?: { account: string; amount: string };
  tokenInputs?: Array<{ userAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }>;
  tokenOutputs?: Array<{ userAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }>;
}

interface SwapRecord {
  sig: string;
  type: "buy" | "sell";
  via: string;
  mint: string;
  tokenAmount: number;
  solAmount: number;  // in SOL (not lamports)
  ts: string;         // ISO string
  timestamp: number;  // unix ms
}

interface WalletTradeResult {
  id: string;
  token_name: string;
  token_symbol: string;
  contract_address: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: null;
  take_profit: null;
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
  selected: boolean;
  mock: boolean;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidSolana(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

/** Fetch parsed transaction history from Helius Enhanced Transactions API */
async function fetchHeliusTransactions(
  wallet: string,
  limit: number,
  apiKey: string
): Promise<HeliusTransaction[]> {
  // Helius Enhanced Transactions endpoint — returns enriched tx objects
  const url =
    `https://api.helius.xyz/v0/addresses/${wallet}/transactions` +
    `?api-key=${apiKey}&limit=${Math.min(limit, 100)}&type=SWAP`;

  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });

  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error("Helius API key is invalid or missing. Check your Edge Function secrets."), { status: 401 });
  }
  if (res.status === 429) {
    throw Object.assign(new Error("Rate limit reached. Please wait a moment and try again."), { status: 429 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Helius API error: HTTP ${res.status}`), { status: res.status });
  }

  const data = await res.json();
  // Helius returns an array directly
  return Array.isArray(data) ? data : [];
}

/**
 * Extract a swap record from a Helius enriched transaction.
 * Returns null if the tx is not a recognisable SOL⟷SPL swap for this wallet.
 */
function extractSwap(
  tx: HeliusTransaction,
  wallet: string
): SwapRecord | null {
  const tsMs = (tx.timestamp ?? 0) * 1000;
  const iso = tsMs ? new Date(tsMs).toISOString() : new Date().toISOString();

  // Prefer the structured swap event if Helius provided it
  const swapEvent = tx.events?.swap;
  if (swapEvent) {
    // ── BUY: SOL in → token out ─────────────────────────────────────────────
    if (
      swapEvent.nativeInput &&
      swapEvent.tokenOutputs?.length
    ) {
      const solLamports = BigInt(swapEvent.nativeInput.amount ?? "0");
      const solAmount = Number(solLamports) / LAMPORTS_PER_SOL;
      const tokenOut = swapEvent.tokenOutputs[0];
      const rawAmt = tokenOut.rawTokenAmount;
      const decimals = rawAmt.decimals ?? 0;
      const tokenAmount = Number(BigInt(rawAmt.tokenAmount)) / 10 ** decimals;
      return {
        sig: tx.signature,
        type: "buy",
        via: tx.source ?? "DEX",
        mint: tokenOut.mint,
        tokenAmount,
        solAmount,
        ts: iso,
        timestamp: tsMs,
      };
    }

    // ── SELL: token in → SOL out ────────────────────────────────────────────
    if (
      swapEvent.nativeOutput &&
      swapEvent.tokenInputs?.length
    ) {
      const solLamports = BigInt(swapEvent.nativeOutput.amount ?? "0");
      const solAmount = Number(solLamports) / LAMPORTS_PER_SOL;
      const tokenIn = swapEvent.tokenInputs[0];
      const rawAmt = tokenIn.rawTokenAmount;
      const decimals = rawAmt.decimals ?? 0;
      const tokenAmount = Number(BigInt(rawAmt.tokenAmount)) / 10 ** decimals;
      return {
        sig: tx.signature,
        type: "sell",
        via: tx.source ?? "DEX",
        mint: tokenIn.mint,
        tokenAmount,
        solAmount,
        ts: iso,
        timestamp: tsMs,
      };
    }
  }

  // ── Fallback: parse tokenTransfers + nativeTransfers manually ────────────
  const transfers = tx.tokenTransfers ?? [];
  const nativeTransfers = tx.nativeTransfers ?? [];

  // Determine dominant token transfer direction relative to wallet
  const walletLower = wallet.toLowerCase();

  // SOL sent by wallet
  const solSent =
    nativeTransfers
      .filter((n) => n.fromUserAccount?.toLowerCase() === walletLower)
      .reduce((s, n) => s + n.amount, 0) / LAMPORTS_PER_SOL;

  // SOL received by wallet
  const solReceived =
    nativeTransfers
      .filter((n) => n.toUserAccount?.toLowerCase() === walletLower)
      .reduce((s, n) => s + n.amount, 0) / LAMPORTS_PER_SOL;

  // Tokens received by wallet
  const tokenReceived = transfers.filter(
    (t) => t.toUserAccount?.toLowerCase() === walletLower && t.mint !== "So11111111111111111111111111111111111111112"
  );

  // Tokens sent by wallet
  const tokenSent = transfers.filter(
    (t) => t.fromUserAccount?.toLowerCase() === walletLower && t.mint !== "So11111111111111111111111111111111111111112"
  );

  if (solSent > 0.001 && tokenReceived.length > 0) {
    // BUY
    const tok = tokenReceived[0];
    return {
      sig: tx.signature,
      type: "buy",
      via: tx.source ?? "DEX",
      mint: tok.mint,
      tokenAmount: tok.tokenAmount ?? 0,
      solAmount: solSent,
      ts: iso,
      timestamp: tsMs,
    };
  }

  if (solReceived > 0.001 && tokenSent.length > 0) {
    // SELL
    const tok = tokenSent[0];
    return {
      sig: tx.signature,
      type: "sell",
      via: tx.source ?? "DEX",
      mint: tok.mint,
      tokenAmount: tok.tokenAmount ?? 0,
      solAmount: solReceived,
      ts: iso,
      timestamp: tsMs,
    };
  }

  return null;
}

/** Fetch token metadata (name, symbol) from Helius for a list of mints */
async function fetchTokenMetadata(
  mints: string[],
  apiKey: string
): Promise<Record<string, { name: string; symbol: string }>> {
  if (mints.length === 0) return {};

  // Helius getAssetBatch — up to 1000 mints per call
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "get-assets",
    method: "getAssetBatch",
    params: { ids: mints.slice(0, 100) },
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return {};
    const json = await res.json();
    const result: Record<string, { name: string; symbol: string }> = {};
    for (const asset of json.result ?? []) {
      if (!asset?.id) continue;
      const name =
        asset.content?.metadata?.name ??
        asset.token_info?.symbol ??
        asset.id.slice(0, 6);
      const symbol =
        asset.token_info?.symbol ??
        asset.content?.metadata?.symbol ??
        name;
      result[asset.id] = { name, symbol };
    }
    return result;
  } catch {
    return {};
  }
}

/** Fetch current USD price for a mint from BirdEye */
async function fetchBirdeyePrice(
  mint: string,
  birdeyeKey: string
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${mint}`,
      {
        headers: { "X-API-KEY": birdeyeKey, "x-chain": "solana" },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.value ?? null;
  } catch {
    return null;
  }
}

/** Fetch current USD price for multiple mints (sequential, limited) */
async function fetchPrices(
  mints: string[],
  birdeyeKey: string
): Promise<Record<string, number | null>> {
  const unique = [...new Set(mints)].slice(0, 20); // cap to avoid timeouts
  const entries = await Promise.all(
    unique.map(async (mint) => [mint, await fetchBirdeyePrice(mint, birdeyeKey)] as const)
  );
  return Object.fromEntries(entries);
}

/**
 * Build trade entries from a list of detected swaps.
 * Each buy becomes an "open" trade; if a matching sell exists for the same mint,
 * the pair becomes a "closed" trade with exit_price calculated.
 */
function buildTrades(
  swaps: SwapRecord[],
  metadata: Record<string, { name: string; symbol: string }>,
  prices: Record<string, number | null>
): WalletTradeResult[] {
  const trades: WalletTradeResult[] = [];

  // Group by mint, sorted chronologically
  const byMint: Record<string, SwapRecord[]> = {};
  for (const s of swaps) {
    (byMint[s.mint] ??= []).push(s);
  }

  for (const [mint, mintSwaps] of Object.entries(byMint)) {
    const sorted = mintSwaps.sort((a, b) => a.timestamp - b.timestamp);
    const meta = metadata[mint];
    const tokenName = meta?.name ?? `Token (${mint.slice(0, 4)}…${mint.slice(-4)})`;
    const tokenSymbol = meta?.symbol ?? mint.slice(0, 6);
    const currentPrice = prices[mint] ?? null;

    // Simple pairing: match each buy with the next sell for the same mint
    const buys = sorted.filter((s) => s.type === "buy");
    const sells = sorted.filter((s) => s.type === "sell");

    // Match buys to sells in order
    const usedSells = new Set<number>();

    for (const buy of buys) {
      const entryPrice =
        buy.tokenAmount > 0 ? buy.solAmount / buy.tokenAmount : 0;

      // Find the first sell after this buy (same mint)
      const sellIdx = sells.findIndex(
        (s, i) => s.timestamp > buy.timestamp && !usedSells.has(i)
      );

      if (sellIdx >= 0) {
        usedSells.add(sellIdx);
        const sell = sells[sellIdx];
        const exitPrice =
          sell.tokenAmount > 0 ? sell.solAmount / sell.tokenAmount : null;

        const usdValue =
          currentPrice !== null ? sell.solAmount * (currentPrice > 0 ? (1 / entryPrice) * currentPrice : 1) : null;

        trades.push({
          id: `wt_${buy.sig}_${sell.sig}`.slice(0, 64),
          token_name: tokenName,
          token_symbol: tokenSymbol,
          contract_address: mint,
          entry_price: entryPrice,
          exit_price: exitPrice,
          stop_loss: null,
          take_profit: null,
          position_size: buy.solAmount,
          setup_type: "breakout",
          notes: `Imported from wallet scan. Buy tx: ${buy.sig.slice(0, 8)}…, Sell tx: ${sell.sig.slice(0, 8)}… via ${buy.via}`,
          status: "closed",
          tx_signature: buy.sig,
          timestamp: buy.timestamp,
          trade_type: "buy",
          token_amount: buy.tokenAmount,
          sol_amount: buy.solAmount,
          usd_value: usdValue,
          selected: true,
          mock: false,
        });
      } else {
        // No matching sell — open position
        trades.push({
          id: `wt_${buy.sig}`.slice(0, 64),
          token_name: tokenName,
          token_symbol: tokenSymbol,
          contract_address: mint,
          entry_price: entryPrice,
          exit_price: null,
          stop_loss: null,
          take_profit: null,
          position_size: buy.solAmount,
          setup_type: "breakout",
          notes: `Imported from wallet scan. Buy tx: ${buy.sig.slice(0, 8)}… via ${buy.via}`,
          status: "open",
          tx_signature: buy.sig,
          timestamp: buy.timestamp,
          trade_type: "buy",
          token_amount: buy.tokenAmount,
          sol_amount: buy.solAmount,
          usd_value: currentPrice !== null ? buy.solAmount * currentPrice : null,
          selected: true,
          mock: false,
        });
      }
    }

    // Sells with no matching buy (partial captures)
    const unusedSells = sells.filter((_, i) => !usedSells.has(i));
    for (const sell of unusedSells) {
      const exitPrice =
        sell.tokenAmount > 0 ? sell.solAmount / sell.tokenAmount : 0;
      trades.push({
        id: `wt_sell_${sell.sig}`.slice(0, 64),
        token_name: tokenName,
        token_symbol: tokenSymbol,
        contract_address: mint,
        entry_price: 0,
        exit_price: exitPrice,
        stop_loss: null,
        take_profit: null,
        position_size: sell.solAmount,
        setup_type: "breakout",
        notes: `Sell only — buy not found in scan window. Sell tx: ${sell.sig.slice(0, 8)}… via ${sell.via}`,
        status: "closed",
        tx_signature: sell.sig,
        timestamp: sell.timestamp,
        trade_type: "sell",
        token_amount: sell.tokenAmount,
        sol_amount: sell.solAmount,
        usd_value: null,
        selected: false, // off by default since incomplete
        mock: false,
      });
    }
  }

  // Return most recent first
  return trades.sort((a, b) => b.timestamp - a.timestamp);
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") ?? "";
  const BIRDEYE_API_KEY = Deno.env.get("BIRDEYE_API_KEY") ?? "";

  if (!HELIUS_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Helius API key is invalid or missing. Check your Edge Function secrets." }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let body: { wallet_address?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const walletAddress = (body.wallet_address ?? "").trim();
  const limit = Math.min(Math.max(Number(body.limit ?? 100), 10), 100);

  if (!walletAddress) {
    return new Response(JSON.stringify({ error: "wallet_address is required" }), {
      status: 422,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!isValidSolana(walletAddress)) {
    return new Response(
      JSON.stringify({ error: "That doesn't look like a valid Solana address. Public keys are 32–44 base58 characters." }),
      { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Fetch enriched transactions from Helius
    const rawTxs = await fetchHeliusTransactions(walletAddress, limit, HELIUS_API_KEY);

    // 2. Extract swap records
    const swaps: SwapRecord[] = [];
    const filteredOut: string[] = [];
    const rawSample: object[] = [];

    for (const tx of rawTxs) {
      rawSample.push({
        sig: tx.signature,
        type: tx.type,
        source: tx.source,
        timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : "?",
        has_swap_event: !!tx.events?.swap,
        has_token_transfers: tx.tokenTransfers?.length ?? 0,
        description: tx.description,
      });

      const swap = extractSwap(tx, walletAddress);
      if (swap) {
        swaps.push(swap);
      } else {
        filteredOut.push(`${tx.signature.slice(0, 8)}… type=${tx.type} source=${tx.source} — no recognisable SOL⟷token swap`);
      }
    }

    // 3. Fetch token metadata for all unique mints
    const uniqueMints = [...new Set(swaps.map((s) => s.mint))];
    const metadata = await fetchTokenMetadata(uniqueMints, HELIUS_API_KEY);

    // 4. Fetch current prices from BirdEye (if key available)
    const prices: Record<string, number | null> = {};
    if (BIRDEYE_API_KEY) {
      const fetched = await fetchPrices(uniqueMints, BIRDEYE_API_KEY);
      Object.assign(prices, fetched);
    }

    // 5. Build trade entries
    const trades = buildTrades(swaps, metadata, prices);

    // 6. Build debug payload (mirrors what DebugPanel in App.tsx expects)
    const timestamps = swaps.map((s) => s.timestamp).filter(Boolean);
    const debug = {
      txs_fetched: rawTxs.length,
      swaps_detected: swaps.length,
      trades_built: trades.length,
      date_range: {
        oldest: timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null,
        newest: timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null,
      },
      swap_breakdown: swaps.map((s) => ({
        sig: s.sig,
        type: s.type,
        via: s.via,
        mint: s.mint,
        sol: s.solAmount.toFixed(4),
        ts: s.ts,
      })),
      raw_tx_sample: rawSample.slice(0, 20),
      filtered_out_sample: filteredOut.slice(0, 20),
    };

    return new Response(JSON.stringify({ trades, debug }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    const status = e.status ?? 500;
    return new Response(JSON.stringify({ error: e.message }), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
