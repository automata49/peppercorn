// Executes supabase/schema.sql and supabase/position_growth.sql in an in-process Postgres (PGlite) with
// Supabase-like roles, then checks grants, RLS, idempotency and the data constraints.
// Not part of CI: run from the repository root with
//   npm install --no-save @electric-sql/pglite && node supabase/tests/position_growth.verify.mjs
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';

const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${cond ? '' : extra}`); };

async function exec(sql) { return db.exec(sql); }
async function tryQ(sql, params) {
  try { const r = await db.query(sql, params); return {ok: true, rows: r.rows, count: r.affectedRows}; }
  catch (e) { return {ok: false, msg: String(e.message)}; }
}
async function as(role, fn) {
  await exec(`set role ${role}`);
  try { return await fn(); } finally { await exec('reset role'); }
}
const denied = r => !r.ok && /permission denied|row-level security|violates row-level/.test(r.msg);

// Supabase-like roles and helpers
await exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create role authenticator noinherit login;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`);

const schema = readFileSync('supabase/schema.sql', 'utf8').replace(/create extension if not exists pgcrypto;/, '');
try { await exec(schema); ok('schema.sql applies', true); } catch (e) { ok('schema.sql applies', false, e.message); }

const migration = readFileSync('supabase/position_growth.sql', 'utf8');
try { await exec(migration); ok('migration applies', true); } catch (e) { ok('migration applies', false, e.message); process.exit(1); }
try { await exec(migration); ok('migration re-runs cleanly', true); } catch (e) { ok('migration re-runs cleanly', false, e.message); }

await exec(`insert into public.instruments(id,market,ticker,name) values ('11111111-1111-1111-1111-111111111111','US','NVDA','NVIDIA')`);
const inst = '11111111-1111-1111-1111-111111111111';
const h = c => c.repeat(64 / c.length);
const fact = (over = {}) => ({
  instrument_id: inst, period_end: '2026-07-26', field: 'revenue', status: 'reported', value: 96221000000, unit: 'USD',
  scope: 'consolidated', unknown_reason: null, extraction: 'direct', method_version: 'US-FCF-1',
  lineage: {operation: 'direct', inputs: [{accession: '0001045810-26-000075'}]}, source_filed_at: '2026-08-26',
  input_hash: h('a'), pipeline_version: 'fundamentals-1', ...over});
const insertFact = f => tryQ(
  `insert into public.fundamentals_q(instrument_id,period_end,field,status,value,unit,scope,unknown_reason,extraction,method_version,lineage,source_filed_at,input_hash,pipeline_version)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14) on conflict (instrument_id,period_end,field,input_hash) do nothing`,
  [f.instrument_id, f.period_end, f.field, f.status, f.value, f.unit, f.scope, f.unknown_reason, f.extraction, f.method_version,
   JSON.stringify(f.lineage), f.source_filed_at, f.input_hash, f.pipeline_version]);
const snap = (over = {}) => ({
  instrument_id: inst, as_of: '2026-07-26', rules_version: 'position_v1', fcf_method: 'US-FCF-1', roic_method: 'US-ROIC-1',
  status: 'ok', checks: [['freshness', true, 'ok']], metrics: {roic: 0.3}, type_label: 'Growth', quality_label: 'High',
  growth_label: 'Durable', value_label: 'Fair', label_reasons: {type: 'a', quality: 'b', growth: 'c', value: 'd'},
  input_hash: h('b'), pipeline_version: 'position-1', ...over});
const insertSnap = s => tryQ(
  `insert into public.position_snapshot(instrument_id,as_of,rules_version,fcf_method,roic_method,status,checks,metrics,type_label,quality_label,growth_label,value_label,label_reasons,input_hash,pipeline_version)
   values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13::jsonb,$14,$15) on conflict (instrument_id,as_of,rules_version,input_hash) do nothing`,
  [s.instrument_id, s.as_of, s.rules_version, s.fcf_method, s.roic_method, s.status, JSON.stringify(s.checks), JSON.stringify(s.metrics),
   s.type_label, s.quality_label, s.growth_label, s.value_label, JSON.stringify(s.label_reasons), s.input_hash, s.pipeline_version]);
const count = async t => Number((await db.query(`select count(*)::int c from public.${t}`)).rows[0].c);

// --- pipeline role: allowed and denied operations
await as('position_pipeline', async () => {
  ok('pipeline inserts a fact', (await insertFact(fact())).ok);
  ok('pipeline inserts a snapshot', (await insertSnap(snap())).ok);
  ok('pipeline reads instruments', (await tryQ('select id from public.instruments')).ok);
  ok('pipeline reads its own facts', (await tryQ('select id from public.fundamentals_q')).rows?.length === 1);
  await insertFact(fact());
  ok('re-run with same input is idempotent', (await count('fundamentals_q')) === 1);
  await insertFact(fact({input_hash: h('c'), value: 96222000000}));
  ok('amended input adds a row and keeps history', (await count('fundamentals_q')) === 2);
  ok('pipeline cannot update', denied(await tryQ(`update public.fundamentals_q set value = 1`)));
  ok('pipeline cannot delete', denied(await tryQ(`delete from public.fundamentals_q`)));
  ok('pipeline cannot update snapshots', denied(await tryQ(`update public.position_snapshot set status = 'ok'`)));
  for (const t of ['price_daily', 'market_metrics', 'universe_memberships', 'stock_analyses', 'watchlist', 'portfolio_positions', 'user_thresholds', 'research_notes', 'trade_journal']) {
    ok(`pipeline cannot read ${t}`, denied(await tryQ(`select * from public.${t} limit 1`)));
    ok(`pipeline cannot write ${t}`, denied(await tryQ(`delete from public.${t}`)));
  }
  ok('pipeline cannot insert into price_daily', denied(await tryQ(`insert into public.price_daily(instrument_id,trade_date,close) values ('${inst}','2026-01-01',1)`)));
  ok('pipeline cannot create tables', !(await tryQ('create table public.x(a int)')).ok);
  ok('pipeline cannot touch instruments rows', denied(await tryQ(`update public.instruments set name = 'x'`)));
});

// --- constraints (owner session; role restrictions are irrelevant here)
const bad = async (name, r, c) => ok(name, !r.ok && r.msg.includes(c), `expected ${c}: ${r.msg ?? 'accepted'}`);
await bad('reported fact without value rejected', await insertFact(fact({input_hash: h('d'), value: null})), 'fundamentals_q_reported_has_evidence');
await bad('reported fact without filing date rejected', await insertFact(fact({input_hash: h('e'), source_filed_at: null})), 'fundamentals_q_reported_has_evidence');
await bad('reported fact without inputs rejected', await insertFact(fact({input_hash: h('f'), lineage: {inputs: []}})), 'fundamentals_q_reported_has_evidence');
await bad('reported fact with non-array inputs rejected', await insertFact(fact({input_hash: h('1'), lineage: {inputs: 'x'}})), 'fundamentals_q_reported_has_evidence');
await bad('unknown stored as zero rejected', await insertFact(fact({input_hash: h('2'), status: 'unknown', value: 0, unknown_reason: 'missing'})), 'fundamentals_q_unknown_has_reason');
await bad('unknown without reason rejected', await insertFact(fact({input_hash: h('3'), status: 'unknown', value: null, unknown_reason: null})), 'fundamentals_q_unknown_has_reason');
ok('unknown with reason accepted', (await insertFact(fact({input_hash: h('4'), field: 'sbc', status: 'unknown', value: null, unknown_reason: 'SBC not collected', source_filed_at: null, lineage: {}}))).ok);
await bad('bad unit rejected', await insertFact(fact({input_hash: h('5'), unit: 'EUR'})), 'fundamentals_q_unit_check');
await bad('bad hash rejected', await insertFact(fact({input_hash: 'xyz'})), 'fundamentals_q_input_hash_check');
await bad('bad field name rejected', await insertFact(fact({input_hash: h('6'), field: 'Revenue'})), 'fundamentals_q_field_check');

for (const [label, checks] of [['a failed check', [['a', true, ''], ['b', false, 'bad']]], ['a null passed value', [['a', null, '']]],
  ['a string passed value', [['a', 'true', '']]], ['a missing passed slot', [['a']]], ['a non-array element', [{name: 'a', passed: true}]]])
  await bad(`ok snapshot with ${label} rejected`, await insertSnap(snap({input_hash: h('7'), checks})), 'position_snapshot_ok_requires_passed_checks');
await bad('ok snapshot without checks rejected', await insertSnap(snap({input_hash: h('8'), checks: []})), 'position_snapshot_ok_requires_passed_checks');
await bad('ok snapshot without a label rejected', await insertSnap(snap({input_hash: h('9'), value_label: null})), 'position_snapshot_labels_follow_status');
await bad('ok snapshot without a reason rejected', await insertSnap(snap({input_hash: h('a1'), label_reasons: {type: 'a', quality: 'b', growth: 'c'}})), 'position_snapshot_labels_follow_status');
await bad('failed snapshot with labels rejected', await insertSnap(snap({input_hash: h('a2'), status: 'check_failed', checks: [['a', false, '']]})), 'position_snapshot_labels_follow_status');
await bad('failed snapshot with one label rejected', await insertSnap(snap({input_hash: h('a3'), status: 'check_failed', type_label: 'Growth', quality_label: null, growth_label: null, value_label: null, label_reasons: {}})), 'position_snapshot_labels_follow_status');
await bad('failed snapshot with reasons rejected', await insertSnap(snap({input_hash: h('a4'), status: 'unavailable', type_label: null, quality_label: null, growth_label: null, value_label: null, label_reasons: {type: 'x'}})), 'position_snapshot_labels_follow_status');
for (const key of ['score', 'position_score', 'composite_score', 'total_score'])
  await bad(`combined score key ${key} rejected`, await insertSnap(snap({input_hash: h('a5'), metrics: {[key]: 1}})), 'position_snapshot_no_combined_score');
const r1 = await insertSnap(snap({input_hash: h('a6'), status: 'check_failed', checks: [['fresh', false, 'stale']], type_label: null, quality_label: null, growth_label: null, value_label: null, label_reasons: {}})); ok('failed snapshot without labels accepted', r1.ok, r1.msg);
const r2 = await insertSnap(snap({input_hash: h('a7'), status: 'insufficient_data', checks: [], type_label: null, quality_label: null, growth_label: null, value_label: null, label_reasons: {}})); ok('insufficient_data snapshot accepted', r2.ok, r2.msg);
await bad('owner cannot update either (append-only trigger)', await tryQ(`update public.fundamentals_q set value = 1`), 'append-only');
await bad('owner cannot update snapshots', await tryQ(`update public.position_snapshot set status = 'check_failed'`), 'append-only');

// --- public roles
await as('anon', async () => {
  ok('anon reads snapshots', (await tryQ('select id from public.position_snapshot')).ok);
  ok('anon cannot read facts', denied(await tryQ('select id from public.fundamentals_q')));
  ok('anon cannot insert snapshot', denied(await insertSnap(snap({input_hash: h('b1')}))));
});
await as('authenticated', async () => {
  ok('authenticated reads snapshots', (await tryQ('select id from public.position_snapshot')).rows?.length > 0);
  ok('authenticated reads facts', (await tryQ('select id from public.fundamentals_q')).rows?.length > 0);
  ok('authenticated cannot insert fact', denied(await insertFact(fact({input_hash: h('b2')}))));
  ok('authenticated cannot insert snapshot', denied(await insertSnap(snap({input_hash: h('b3')}))));
  ok('authenticated cannot delete facts', denied(await tryQ('delete from public.fundamentals_q')));
});

// --- existing public grants are unchanged
await as('anon', async () => ok('anon still reads market_metrics', (await tryQ('select 1 from public.market_metrics limit 1')).ok));
ok('pipeline is a member of authenticator only through the migration',
  (await db.query(`select pg_has_role('authenticator','position_pipeline','member') m`)).rows[0].m === true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
