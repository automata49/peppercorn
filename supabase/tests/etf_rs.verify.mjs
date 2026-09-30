import {PGlite} from '@electric-sql/pglite';
import {readFileSync, readdirSync} from 'node:fs';

const db = new PGlite();
let passed = 0;
function check(name, yes) { if (!yes) throw new Error(name); passed++; console.log('PASS', name); }
async function q(sql, args) { return db.query(sql, args); }
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  grant usage on schema public to anon,authenticated,service_role;`);
await db.exec(readFileSync('supabase/schema.sql','utf8').replace(/create extension if not exists pgcrypto;/,''));
await db.exec('grant select on public.instruments to service_role; grant select,update on public.market_metrics to service_role');
const migration = readdirSync('supabase/migrations').find(name=>name.endsWith('_etf_relative_strength.sql'));
if (!migration) throw new Error('missing ETF migration');

const ids = {
  SPY:'11111111-1111-1111-1111-111111111111', QQQ:'22222222-2222-2222-2222-222222222222',
  AAPL:'33333333-3333-3333-3333-333333333333', KR:'44444444-4444-4444-4444-444444444444',
  KRETF:'55555555-5555-5555-5555-555555555555', STALE:'66666666-6666-6666-6666-666666666666'
};
async function row(key, market, ticker, asset, date, ret5, ret200, ret12m, rs5=null, rank=null) {
  await q('insert into public.instruments(id,market,ticker,name,asset_class) values($1,$2,$3,$4,$5)',
    [ids[key],market,ticker,ticker,asset]);
  await q(`insert into public.market_metrics(instrument_id,as_of,return_5d,return_20d,return_50d,return_120d,return_200d,return_12m,rs_5d,rs_rank)
    values($1,$2,$3,$3,$3,$3,$4,$5,$6,$7)`,[ids[key],date,ret5,ret200,ret12m,rs5,rank]);
}
await row('SPY','US','SPY','ETF','2026-09-28',.02,.12,.2);
await row('QQQ','US','QQQ','ETF','2026-09-28',.1,null,.3,null,88);
await row('AAPL','US','AAPL','Equity','2026-09-28',.05,.4,.5,.5,90);
await row('KR','KR','069500','ETF','2026-09-29',.03,.8,.9);
await row('KRETF','KR','229200','ETF','2026-09-29',-.01,.7,.85);
await row('STALE','US','OLD','ETF','2026-09-27',.1,.2,.3);

await db.exec(readFileSync(`supabase/migrations/${migration}`,'utf8'));
const metric = async key => (await q('select rs_5d,rs_20d,rs_200d,rs_12m,rs_rank from public.market_metrics where instrument_id=$1',
  [ids[key]])).rows[0];
const spy=await metric('SPY'), qqq=await metric('QQQ'), kr=await metric('KR'), krEtf=await metric('KRETF');
check('benchmark ETFs equal zero in each market', Number(spy.rs_5d)===0 && Number(kr.rs_5d)===0);
check('US ETF 5D uses SPY return', Math.abs(Number(qqq.rs_5d)-.08)<1e-10);
check('KR ETF 5D uses 069500 return', Math.abs(Number(krEtf.rs_5d)+.04)<1e-10);
check('all available trading bands update', Math.abs(Number(qqq.rs_20d)-.08)<1e-10 && Math.abs(Number(qqq.rs_12m)-.1)<1e-10);
check('missing ETF return remains unknown', qqq.rs_200d===null);
check('equity RS and rank unchanged', Number((await metric('AAPL')).rs_5d)===.5 && Number((await metric('AAPL')).rs_rank)===90);
check('stale ETF rank cleared; new rank remains null', qqq.rs_rank===null && krEtf.rs_rank===null);
check('mismatched benchmark date remains unknown', (await metric('STALE')).rs_5d===null);
await db.exec('set role service_role');
check('service role rerun is idempotent', Number((await q('select public.recalculate_etf_relative_strength() n')).rows[0].n)===0);
await db.exec('reset role');
await q('update public.market_metrics set return_5d=$1 where instrument_id=$2',[.12,ids.QQQ]);
check('new ETF return recalculates once', Number((await q('select public.recalculate_etf_relative_strength() n')).rows[0].n)===1);
check('new RS 5D reflects source revision', Math.abs(Number((await metric('QQQ')).rs_5d)-.10)<1e-10);
await db.exec('set role anon');
let denied=false;
try { await q('select public.recalculate_etf_relative_strength()'); } catch(e) { denied=/permission denied/.test(String(e.message)); }
await db.exec('reset role');
check('anon cannot recalculate',denied);

// ETF-SWING-1: IBD estimate, Trend Template, stage, verdict and guide for ETFs, ranked among ETFs only.
const swing = readdirSync('supabase/migrations').find(name=>name.endsWith('_etf_swing_criteria.sql'));
if (!swing) throw new Error('missing ETF swing migration');
await db.exec(readFileSync(`supabase/migrations/${swing}`,'utf8'));
// Identical inputs for one equity (AAPL, the only US equity) and one ETF (QQQ, the strongest US ETF).
const same = `price=110,ma50=100,ma200=90,high_52w_distance=-.02,low_52w=60,atr_multiple=3,volume_ratio=1.6,
  return_1w=.03,return_1m=.08,return_3m=.2,return_6m=.3,return_12m=.5`;
await q(`update public.market_metrics set ${same} where instrument_id in ($1,$2)`,[ids.AAPL,ids.QQQ]);
await q(`update public.market_metrics set price=100,ma50=100,ma200=100,return_1w=0,return_1m=0,return_3m=0,return_6m=0,return_12m=0 where instrument_id=$1`,[ids.SPY]);
// 253 sessions: AAPL and QQQ share one rising series; SPY is flat; KR 229200 has only 100 sessions.
async function prices(id, days, step, end='2026-09-28') {
  await q(`insert into public.price_daily(instrument_id,trade_date,close)
    select $1::uuid,$4::date-g,100+$3::numeric*($2::int-g) from generate_series(0,$2::int-1) g`,[id,days,step,end]);
}
await prices(ids.AAPL,253,.5); await prices(ids.QQQ,253,.5); await prices(ids.SPY,253,0);
await prices(ids.KRETF,100,.5,'2026-09-29');
await q('select public.recalculate_market_leadership()');
await q('select public.recalculate_etf_relative_strength()');
const full = async key => (await q(`select rs_rank,ibd_rs_estimate,ibd_rs_as_of,tt_pass_count,leader_tt,stage,verdict,action_guide
  from public.market_metrics where instrument_id=$1`,[ids[key]])).rows[0];
const aapl=await full('AAPL'), etfQ=await full('QQQ'), spyFull=await full('SPY'), krShort=await full('KRETF');
check('ETF IBD estimate ranks among ETFs only', etfQ.ibd_rs_estimate===99 && spyFull.ibd_rs_estimate<99);
check('equity IBD estimate unchanged by ETF ranking', aapl.ibd_rs_estimate===99);
check('ETF without 253 sessions has no IBD estimate', krShort.ibd_rs_estimate===null);
check('ETF rank never stored in rs_rank', etfQ.rs_rank===null && spyFull.rs_rank===null);
check('Trend Template parity with equities', etfQ.leader_tt===aapl.leader_tt && etfQ.tt_pass_count===aapl.tt_pass_count && etfQ.leader_tt===true);
check('stage, verdict and guide parity with equities', etfQ.stage===aapl.stage && etfQ.verdict===aapl.verdict && etfQ.action_guide===aapl.action_guide);
check('ETF classification reaches the top verdict', etfQ.verdict==='⭐ 최우선 관심');
check('flat benchmark ETF fails the Trend Template', spyFull.leader_tt===false);
await db.exec('set role service_role');
check('service role ETF swing rerun is idempotent', Number((await q('select public.recalculate_etf_relative_strength() n')).rows[0].n)===0);
await db.exec('reset role');
console.log(`${passed} ETF RS checks passed`);
