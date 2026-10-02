import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins = new Set([
  "https://automata49.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);

const publicClientToken = "peppercorn-public-read-v1";

function cors(origin: string | null) {
  const allow = origin && allowedOrigins.has(origin)
    ? origin
    : "https://automata49.github.io";

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Vary": "Origin"
  };
}

// Public read-only daily closes for at most 10 instruments (dashboard momentum lines). price_daily is already anon-readable.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SESSIONS = 253;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("client") !== publicClientToken) {
    return Response.json({ error: "unauthorized_client" }, { status: 401, headers });
  }

  if (origin && !allowedOrigins.has(origin)) {
    return Response.json({ error: "origin_not_allowed" }, { status: 403, headers });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretJson = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (!supabaseUrl || !secretJson) {
    return Response.json({ error: "server_not_configured" }, { status: 500, headers });
  }

  const secret = JSON.parse(secretJson).default;
  if (!secret) {
    return Response.json({ error: "secret_key_missing" }, { status: 500, headers });
  }

  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  if (!ids.length || ids.length > 10 || !ids.every(id => UUID.test(id))) {
    return Response.json({ error: "invalid_ids" }, { status: 400, headers });
  }
  const since = new Date(Date.now() - 420 * 86_400_000).toISOString().slice(0, 10);
  const byId: Record<string, [string, number][]> = {};
  for (let offset = 0; ; offset += 1000) {
    const endpoint = new URL("/rest/v1/price_daily", supabaseUrl);
    endpoint.searchParams.set("select", "instrument_id,trade_date,close");
    endpoint.searchParams.set("instrument_id", `in.(${ids.join(",")})`);
    endpoint.searchParams.set("trade_date", `gte.${since}`);
    endpoint.searchParams.set("order", "instrument_id.asc,trade_date.asc");
    endpoint.searchParams.set("offset", String(offset));
    endpoint.searchParams.set("limit", "1000");
    const db = await fetch(endpoint, { headers: { apikey: secret } });
    if (!db.ok) {
      return Response.json({ error: "database_error", detail: await db.text() }, { status: 502, headers });
    }
    const page = await db.json() as { instrument_id: string; trade_date: string; close: number | string }[];
    for (const r of page) (byId[r.instrument_id] ??= []).push([r.trade_date, Number(r.close)]);
    if (page.length < 1000) break;
  }
  for (const id of Object.keys(byId)) byId[id] = byId[id].slice(-SESSIONS);
  return Response.json(
    { updated_at: new Date().toISOString(), series: byId },
    { headers: { ...headers, "Cache-Control": "public, max-age=300, stale-while-revalidate=900" } }
  );
});
