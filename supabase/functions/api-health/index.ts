/**
 * supabase/functions/api-health/index.ts
 *
 * Returns liveness + latency for Helius and BirdEye.
 * Expected response shape (read by WalletImport.useEffect):
 * {
 *   helius: { ok: boolean, configured: boolean, latency_ms?: number, error?: string },
 *   birdeye: { ok: boolean, configured: boolean, latency_ms?: number, error?: string },
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") ?? "";
  const BIRDEYE_API_KEY = Deno.env.get("BIRDEYE_API_KEY") ?? "";

  const heliusConfigured = HELIUS_API_KEY.length > 0;
  const birdeyeConfigured = BIRDEYE_API_KEY.length > 0;

  // ── Helius ping ─────────────────────────────────────────────────────────────
  // Use getLatestBlockhash — cheap, always reachable, no credit cost.
  const heliusResult = await (async () => {
    if (!heliusConfigured) {
      return { ok: false, configured: false, error: "HELIUS_API_KEY not set" };
    }
    const t0 = Date.now();
    try {
      const res = await fetch(
        `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getLatestBlockhash",
            params: [{ commitment: "confirmed" }],
          }),
          signal: AbortSignal.timeout(8_000),
        }
      );
      const latency_ms = Date.now() - t0;
      if (!res.ok) {
        return { ok: false, configured: true, latency_ms, error: `HTTP ${res.status}` };
      }
      const json = await res.json();
      if (json.error) {
        return { ok: false, configured: true, latency_ms, error: String(json.error.message ?? json.error) };
      }
      return { ok: true, configured: true, latency_ms };
    } catch (e) {
      return { ok: false, configured: true, error: (e as Error).message };
    }
  })();

  // ── BirdEye ping ────────────────────────────────────────────────────────────
  // Use /defi/price for SOL — tiny payload, publicly documented endpoint.
  const birdeyeResult = await (async () => {
    if (!birdeyeConfigured) {
      return { ok: false, configured: false, error: "BIRDEYE_API_KEY not set" };
    }
    const t0 = Date.now();
    try {
      const res = await fetch(
        "https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112",
        {
          headers: {
            "X-API-KEY": BIRDEYE_API_KEY,
            "x-chain": "solana",
          },
          signal: AbortSignal.timeout(8_000),
        }
      );
      const latency_ms = Date.now() - t0;
      if (res.status === 401 || res.status === 403) {
        return { ok: false, configured: true, latency_ms, error: "Invalid BirdEye API key" };
      }
      if (!res.ok) {
        return { ok: false, configured: true, latency_ms, error: `HTTP ${res.status}` };
      }
      const json = await res.json();
      if (!json.success) {
        return { ok: false, configured: true, latency_ms, error: json.message ?? "BirdEye returned success=false" };
      }
      return { ok: true, configured: true, latency_ms };
    } catch (e) {
      return { ok: false, configured: true, error: (e as Error).message };
    }
  })();

  const body = JSON.stringify({ helius: heliusResult, birdeye: birdeyeResult });

  return new Response(body, {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
