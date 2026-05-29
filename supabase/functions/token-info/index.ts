import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BIRDEYE_API_KEY = Deno.env.get("BIRDEYE_API_KEY") ?? "";
const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") ?? "";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getBirdeyeToken(mint: string) {
  if (!BIRDEYE_API_KEY) return null;
  try {
    const [overviewRes, priceRes] = await Promise.all([
      fetch(`https://public-api.birdeye.so/defi/token_overview?address=${mint}`, {
        headers: { "X-API-KEY": BIRDEYE_API_KEY, "x-chain": "solana" },
      }),
      fetch(`https://public-api.birdeye.so/defi/price?address=${mint}`, {
        headers: { "X-API-KEY": BIRDEYE_API_KEY },
      }),
    ]);

    if (!overviewRes.ok && !priceRes.ok) return null;

    const overview = overviewRes.ok ? await overviewRes.json() : null;
    const priceData = priceRes.ok ? await priceRes.json() : null;

    const d = overview?.data ?? {};
    return {
      name: d.name ?? null,
      symbol: d.symbol ?? null,
      price: priceData?.data?.value ?? d.price ?? null,
      market_cap: d.mc ?? d.marketCap ?? null,
      liquidity: d.liquidity ?? null,
      volume_24h: d.v24hUSD ?? d.volume24h ?? null,
      price_change_24h: d.priceChange24hPercent ?? null,
      holder_count: d.holder ?? null,
    };
  } catch {
    return null;
  }
}

async function getHeliusMeta(mint: string) {
  if (!HELIUS_API_KEY) return null;
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "meta", method: "getAsset", params: { id: mint } }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const m = j?.result?.content?.metadata;
    const created = j?.result?.content?.created_at;
    if (!m?.name) return null;
    return {
      name: m.name as string,
      symbol: (m.symbol as string) ?? null,
      token_age: created
        ? formatAge(new Date(created * 1000))
        : null,
    };
  } catch {
    return null;
  }
}

function formatAge(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return "< 1 day";
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""}`;
  const years = Math.floor(days / 365);
  return `${years} year${years !== 1 ? "s" : ""}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { contract_address } = body as { contract_address?: string };

    if (!contract_address || typeof contract_address !== "string") {
      return jsonRes({ error: "contract_address is required" }, 400);
    }

    const mint = contract_address.trim();

    if (!BIRDEYE_API_KEY && !HELIUS_API_KEY) {
      return jsonRes({
        error: "Neither BIRDEYE_API_KEY nor HELIUS_API_KEY is configured. Add them as Edge Function secrets.",
        code: "NOT_CONFIGURED",
      }, 503);
    }

    const [birdeye, helius] = await Promise.all([
      getBirdeyeToken(mint),
      getHeliusMeta(mint),
    ]);

    if (!birdeye && !helius) {
      return jsonRes({
        error: `No token data found for ${mint}. Verify the contract address is correct and exists on Solana mainnet.`,
        code: "NOT_FOUND",
      }, 404);
    }

    return jsonRes({
      contract_address: mint,
      name: birdeye?.name ?? helius?.name ?? null,
      symbol: birdeye?.symbol ?? helius?.symbol ?? null,
      price: birdeye?.price ?? null,
      market_cap: birdeye?.market_cap ?? null,
      liquidity: birdeye?.liquidity ?? null,
      volume_24h: birdeye?.volume_24h ?? null,
      price_change_24h: birdeye?.price_change_24h ?? null,
      holder_count: birdeye?.holder_count ?? null,
      token_age: helius?.token_age ?? null,
      sources: {
        birdeye: birdeye !== null,
        helius: helius !== null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("token-info error:", message);
    return jsonRes({ error: message }, 500);
  }
});
