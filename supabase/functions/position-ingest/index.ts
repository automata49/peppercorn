// Position ingestion relay. Called only by the position-ingest workflow on main with a GitHub OIDC token.
// Each request writes one company's label-free facts and snapshot inside a transaction that first runs
// SET LOCAL ROLE position_pipeline, so the database limits it to fundamentals_q and position_snapshot
// (select/insert only, append-only, constraint-checked). Table names are fixed here; the payload never names one.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as jose from "jsr:@panva/jose@6";
import postgres from "npm:postgres@3.4.7";

const WORKFLOW = "automata49/peppercorn/.github/workflows/position-ingest.yml@refs/heads/main";
const JWKS = jose.createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const MAX_FACTS = 5000;

async function authorized(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const { payload } = await jose.jwtVerify(auth.slice(7), JWKS, {
      issuer: "https://token.actions.githubusercontent.com", audience: "peppercorn-supabase" });
    return payload.repository === "automata49/peppercorn" && payload.ref === "refs/heads/main"
      && payload.workflow_ref === WORKFLOW;
  } catch { return false; }
}

// Same SQL as supabase/tests/position_growth.verify.mjs exercises; keep them in step.
export const FACT_INSERT = `
insert into public.fundamentals_q (instrument_id, period_end, field, status, value, unit, scope, unknown_reason,
  extraction, method_version, lineage, source_filed_at, input_hash, pipeline_version)
select $1::uuid, r.period_end, r.field, r.status, r.value, r.unit, r.scope, r.unknown_reason, r.extraction,
  r.method_version, r.lineage, r.source_filed_at, r.input_hash, r.pipeline_version
from jsonb_to_recordset($2::jsonb) as r(period_end date, field text, status text, value numeric, unit text, scope text,
  unknown_reason text, extraction text, method_version text, lineage jsonb, source_filed_at date, input_hash text,
  pipeline_version text)
on conflict (instrument_id, period_end, field, input_hash) do nothing
returning 1`;
export const SNAPSHOT_INSERT = `
insert into public.position_snapshot (instrument_id, as_of, rules_version, fcf_method, roic_method, status, checks,
  metrics, type_label, quality_label, growth_label, value_label, label_reasons, input_hash, pipeline_version)
select $1::uuid, r.as_of, r.rules_version, r.fcf_method, r.roic_method, r.status, r.checks, r.metrics, r.type_label,
  r.quality_label, r.growth_label, r.value_label, r.label_reasons, r.input_hash, r.pipeline_version
from jsonb_to_recordset($2::jsonb) as r(as_of date, rules_version text, fcf_method text, roic_method text, status text,
  checks jsonb, metrics jsonb, type_label text, quality_label text, growth_label text, value_label text,
  label_reasons jsonb, input_hash text, pipeline_version text)
on conflict (instrument_id, as_of, rules_version, input_hash) do nothing
returning 1`;

function invalid(body: any): string | null {
  if (!body || typeof body !== "object") return "body must be an object";
  if (!["US", "KR"].includes(body.market)) return "market must be US or KR";
  if (typeof body.ticker !== "string" || !/^[A-Z0-9.\-]{1,12}$/.test(body.ticker)) return "invalid ticker";
  if (!Array.isArray(body.facts) || body.facts.length > MAX_FACTS) return `facts must be an array of at most ${MAX_FACTS}`;
  if (body.snapshot !== null && (typeof body.snapshot !== "object" || Array.isArray(body.snapshot))) return "snapshot must be an object or null";
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  if (!(await authorized(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return Response.json({ error: "server_not_configured" }, { status: 500 });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const problem = invalid(body);
  if (problem) return Response.json({ error: "invalid_payload", detail: problem }, { status: 400 });
  const sql = postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    const result = await sql.begin(async (tx) => {
      await tx.unsafe("set local role position_pipeline");
      const found = await tx.unsafe("select id from public.instruments where market = $1 and ticker = $2", [body.market, body.ticker]);
      if (found.length !== 1) throw new Error(`instrument ${body.market}:${body.ticker} found ${found.length} times`);
      const id = found[0].id;
      const facts = body.facts.length ? await tx.unsafe(FACT_INSERT, [id, JSON.stringify(body.facts)]) : [];
      const snaps = body.snapshot ? await tx.unsafe(SNAPSHOT_INSERT, [id, JSON.stringify([body.snapshot])]) : [];
      return { instrument_id: id, facts_received: body.facts.length, facts_inserted: facts.length,
               snapshots_inserted: snaps.length };
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    // Constraint and permission errors are the database refusing bad input; report them without secrets.
    return Response.json({ error: "write_refused", detail: String((error as Error).message).slice(0, 300) }, { status: 422 });
  } finally {
    await sql.end({ timeout: 5 });
  }
});
