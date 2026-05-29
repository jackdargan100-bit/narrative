import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BIRDEYE_API_KEY = Deno.env.get("BIRDEYE_API_KEY") ?? "";
const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") ?? "";

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

async function checkHelius(): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  if (!HELIUS_API_KEY) return { ok: false, latency_ms: 0, error: "HELIUS_API_KEY not configured" };
  const start = Date.now();
  try {
    // Use a known wallet with transactions (Serum deployer) as a health-check target
    const url = `https://api.helius.xyz/v0/addresses/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM/transactions?api-key=${HELIUS_API_KEY}&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const latency_ms = Date.now() - start;
    if (res.status === 401 || res.status === 403) {
      return { ok: false, latency_ms, error: "Invalid API key (401/403)" };
    }
    if (res.status === 429) {
      return { ok: false, latency_ms, error: "Rate limited (429)" };
    }
    if (!res.ok) {
      return { ok: false, latency_ms, error: `HTTP ${res.status}` };
    }
    return { ok: true, latency_ms };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
  }
}

async function checkBirdeye(): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  if (!BIRDEYE_API_KEY) return { ok: false, latency_ms: 0, error: "BIRDEYE_API_KEY not configured" };
  const start = Date.now();
  try {
    // Price check for SOL as a lightweight health-check
    const url = "https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112";
    const res = await fetch(url, {
      headers: { "X-API-KEY": BIRDEYE_API_KEY },
      signal: AbortSignal.timeout(8000),
    });
    const latency_ms = Date.now() - start;
    if (res.status === 401 || res.status === 403) {
      return { ok: false, latency_ms, error: "Invalid API key (401/403)" };
    }
    if (res.status === 429) {
      return { ok: false, latency_ms, error: "Rate limited (429)" };
    }
    if (!res.ok) {
      return { ok: false, latency_ms, error: `HTTP ${res.status}` };
    }
    const j = await res.json();
    if (!j?.data?.value) {
      return { ok: false, latency_ms, error: "Unexpected response shape" };
    }
    return { ok: true, latency_ms };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const [helius, birdeye] = await Promise.all([checkHelius(), checkBirdeye()]);

    return jsonRes({
      helius: {
        configured: HELIUS_API_KEY.length > 0,
        ...helius,
      },
      birdeye: {
        configured: BIRDEYE_API_KEY.length > 0,
        ...birdeye,
      },
      all_ok: helius.ok && birdeye.ok,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonRes({ error: message }, 500);
  }
});
