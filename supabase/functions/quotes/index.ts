import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// LIVE-QUOTE-1: public, read-only current price proxy for the web app.
// It never writes to the database; daily metrics stay owned by refresh-market.
const allowedOrigins = new Set([
  "https://automata49.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);
const publicClientToken = "peppercorn-public-read-v1";
const MAX_SYMBOLS = 60;
const CACHE_MS = 15_000;
const SYMBOL = /^[A-Z0-9^][A-Z0-9.\-=^]{0,19}$/;

type Quote = { price: number; time: number | null; previous_close: number | null; currency: string | null };
const cache = new Map<string, { at: number; quote: Quote | null }>();

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://automata49.github.io",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Vary": "Origin"
  };
}

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.quote;
  const url = new URL("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol));
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1d");
  let quote: Quote | null = null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 PeppercornCapital/1.0" }, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const meta = (await res.json())?.chart?.result?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice);
      if (Number.isFinite(price) && price > 0) {
        const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose);
        const time = Number(meta?.regularMarketTime);
        quote = {
          price,
          time: Number.isFinite(time) ? time * 1000 : null,
          previous_close: Number.isFinite(prev) && prev > 0 ? prev : null,
          currency: typeof meta?.currency === "string" ? meta.currency : null
        };
      }
    }
  } catch { /* unknown stays unknown */ }
  cache.set(symbol, { at: Date.now(), quote });
  return quote;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") return Response.json({ error: "method_not_allowed" }, { status: 405, headers });
  const url = new URL(req.url);
  if (url.searchParams.get("client") !== publicClientToken) return Response.json({ error: "unauthorized_client" }, { status: 401, headers });
  if (origin && !allowedOrigins.has(origin)) return Response.json({ error: "origin_not_allowed" }, { status: 403, headers });

  const symbols = [...new Set((url.searchParams.get("symbols") || "").toUpperCase().split(",").map(s => s.trim()).filter(Boolean))];
  if (!symbols.length || symbols.length > MAX_SYMBOLS || !symbols.every(s => SYMBOL.test(s))) {
    return Response.json({ error: "invalid_symbols", max: MAX_SYMBOLS }, { status: 400, headers });
  }

  const quotes: Record<string, Quote> = {};
  const failed: string[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, symbols.length) }, async () => {
    while (next < symbols.length) {
      const symbol = symbols[next++];
      const quote = await fetchQuote(symbol);
      if (quote) quotes[symbol] = quote; else failed.push(symbol);
    }
  }));
  return Response.json(
    { as_of: new Date().toISOString(), quotes, failed },
    { headers: { ...headers, "Cache-Control": "public, max-age=15" } }
  );
});
