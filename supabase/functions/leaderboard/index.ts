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

  const pageSize = 1000;
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const endpoint = new URL("/rest/v1/leaderboard_view", supabaseUrl);
    endpoint.searchParams.set("select", "*");
    endpoint.searchParams.set("order", "rs_rank.desc.nullslast,market.asc,ticker.asc");
    endpoint.searchParams.set("offset", String(offset));
    endpoint.searchParams.set("limit", String(pageSize));

    const db = await fetch(endpoint, { headers: { apikey: secret } });
    if (!db.ok) {
      const detail = await db.text();
      return Response.json({ error: "database_error", detail, offset }, { status: 502, headers });
    }
    const page = await db.json() as unknown[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return Response.json(
    { updated_at: new Date().toISOString(), source: "supabase", rows },
    {
      headers: {
        ...headers,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300"
      }
    }
  );
});
