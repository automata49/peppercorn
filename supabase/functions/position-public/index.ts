// Public read of the latest Position snapshot per company, for the stock analysis screen.
// Reads inside a transaction under SET LOCAL ROLE anon, so it can return only what the anon role may read
// (position_snapshot and instruments). Facts with lineage (fundamentals_q) stay authenticated-only.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

const allowedOrigins = new Set(["https://automata49.github.io", "http://localhost:5173", "http://127.0.0.1:5173"]);
const publicClientToken = "peppercorn-public-read-v1";

// Metrics the screen shows. Everything else in a snapshot stays in the database.
const METRICS = ["as_of", "ttm_revenue", "ttm_operating_income", "ttm_net_income", "ttm_fcf", "ttm_operating_cash_flow",
  "revenue_yoy", "revenue_yoy_q", "revenue_cagr_3y", "net_income_cagr_3y", "gross_margin", "operating_margin", "fcf_margin",
  "roic", "roic_method", "roe", "net_debt", "debt_ratio", "eps_ttm", "eps_yoy_q", "eps_cagr_3y", "diluted_shares_latest",
  "shares_common", "shares_preferred", "dilution_yoy"];

export const LATEST_SNAPSHOTS = `
select distinct on (s.instrument_id)
  i.market, i.ticker, s.as_of, s.status, s.rules_version, s.fcf_method, s.roic_method, s.checks, s.metrics,
  s.type_label, s.quality_label, s.growth_label, s.value_label, s.label_reasons, s.computed_at
from public.position_snapshot s join public.instruments i on i.id = s.instrument_id
order by s.instrument_id, s.as_of desc, s.computed_at desc`;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://automata49.github.io",
    "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET,OPTIONS", "Vary": "Origin",
    "Cache-Control": "public, max-age=300",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") return Response.json({ error: "method_not_allowed" }, { status: 405, headers });
  if (new URL(req.url).searchParams.get("client") !== publicClientToken) {
    return Response.json({ error: "unauthorized_client" }, { status: 401, headers });
  }
  if (origin && !allowedOrigins.has(origin)) return Response.json({ error: "origin_not_allowed" }, { status: 403, headers });
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return Response.json({ error: "server_not_configured" }, { status: 500, headers });
  const sql = postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe("set local role anon");
      return await tx.unsafe(LATEST_SNAPSHOTS);
    });
    const out = rows.map((r: any) => ({
      market: r.market, ticker: r.ticker, as_of: r.as_of, status: r.status, rules_version: r.rules_version,
      methods: { fcf: r.fcf_method, roic: r.roic_method },
      failed_checks: (r.checks || []).filter((c: any) => Array.isArray(c) && c[1] !== true).map((c: any) => [c[0], c[2]]),
      metrics: Object.fromEntries(METRICS.map((k) => [k, r.metrics?.[k] ?? null])),
      labels: { type: r.type_label, quality: r.quality_label, growth: r.growth_label, value: r.value_label },
      label_reasons: r.label_reasons || {}, computed_at: r.computed_at,
    }));
    return Response.json({ updated_at: new Date().toISOString(), source: "position_snapshot", rows: out }, { headers });
  } catch (error) {
    return Response.json({ error: "read_failed", detail: String((error as Error).message).slice(0, 200) }, { status: 502, headers });
  } finally {
    await sql.end({ timeout: 5 });
  }
});
