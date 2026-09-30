// POSITION-READ-1: public, read-only view of one instrument's latest Position snapshot and fact coverage for the
// 종목 분석 Position section. It runs a READ ONLY transaction under SET LOCAL ROLE position_pipeline, whose grants
// (select on instruments, fundamentals_q, position_snapshot) bound what it can see; it never writes. Labels are
// returned exactly as stored: a snapshot that is not `ok` carries no labels, so the app shows none.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

const allowedOrigins = new Set([
  "https://automata49.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const publicClientToken = "peppercorn-public-read-v1";
const TICKER = /^[A-Z0-9.\-]{1,12}$/;
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; body: unknown }>();

// Same SQL as supabase/tests/position_growth.verify.mjs exercises; keep them in step.
export const INSTRUMENT_READ = `select id from public.instruments where market = $1 and ticker = $2`;
export const SNAPSHOT_READ = `
select as_of, status, rules_version, fcf_method, roic_method, checks, metrics, type_label, quality_label, growth_label,
  value_label, label_reasons, pipeline_version, computed_at
from public.position_snapshot where instrument_id = $1::uuid
order by as_of desc, computed_at desc limit 1`;
export const FACTS_READ = `
select count(*) filter (where status = 'reported')::int as reported, count(*) filter (where status = 'unknown')::int as unknown,
  min(period_end) as first_period, max(period_end) as last_period, max(source_filed_at) as latest_filed,
  coalesce(array_agg(distinct lineage ->> 'source') filter (where lineage ->> 'source' is not null), '{}') as sources,
  max(collected_at) as collected_at
from public.fundamentals_q where instrument_id = $1::uuid`;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://automata49.github.io",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") return Response.json({ error: "method_not_allowed" }, { status: 405, headers });
  const url = new URL(req.url);
  if (url.searchParams.get("client") !== publicClientToken || (origin && !allowedOrigins.has(origin))) {
    return Response.json({ error: "forbidden" }, { status: 403, headers });
  }
  const market = url.searchParams.get("market") || "";
  const ticker = (url.searchParams.get("ticker") || "").toUpperCase();
  if (!["US", "KR"].includes(market) || !TICKER.test(ticker)) {
    return Response.json({ error: "invalid_instrument" }, { status: 400, headers });
  }
  const key = market + ":" + ticker;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.body, { headers });
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return Response.json({ error: "server_not_configured" }, { status: 500, headers });
  const sql = postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    const body = await sql.begin("read only", async (tx) => {
      await tx.unsafe("set local role position_pipeline");
      const found = await tx.unsafe(INSTRUMENT_READ, [market, ticker]);
      if (found.length !== 1) return { ok: true, market, ticker, instrument: false, snapshot: null, facts: null };
      const id = found[0].id;
      const [snapshot] = await tx.unsafe(SNAPSHOT_READ, [id]);
      const [facts] = await tx.unsafe(FACTS_READ, [id]);
      return { ok: true, market, ticker, instrument: true, snapshot: snapshot ?? null,
               facts: facts && (facts.reported || facts.unknown) ? facts : null };
    });
    cache.set(key, { at: Date.now(), body });
    return Response.json(body, { headers: { ...headers, "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    return Response.json({ error: "read_failed", detail: String((error as Error).message).slice(0, 200) },
      { status: 502, headers });
  } finally {
    await sql.end({ timeout: 5 });
  }
});
