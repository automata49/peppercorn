// UNIVERSE-USER-1 and RETENTION-1: PGlite checks for supabase/migrations/*_universe_user_retention.sql.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync, readdirSync} from 'node:fs';

const db = new PGlite();
let passed = 0;
function check(name, yes) { if (!yes) throw new Error(name); passed++; console.log('PASS', name); }
const q = (sql, args) => db.query(sql, args);
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  grant usage on schema public to anon,authenticated,service_role;`);
await db.exec(readFileSync('supabase/schema.sql','utf8').replace(/create extension if not exists pgcrypto;/,''));
const file = readdirSync('supabase/migrations').find(n => n.endsWith('_universe_user_retention.sql'));
if (!file) throw new Error('missing migration');
const sql = readFileSync(`supabase/migrations/${file}`,'utf8');

const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const user = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
await q('insert into auth.users(id) values($1)',[user]);
const tickers = ['IDX','WATCH','PORT','ANAL','JOUR','GONE'];
for (const [i,t] of tickers.entries())
  await q('insert into public.instruments(id,market,ticker,name,asset_class) values($1,$2,$3,$3,$4)',[id(i+1),'US',t,'Equity']);
await q("insert into public.instruments(id,market,ticker,name,asset_class,active) values($1,'US','ETF1','ETF1','ETF',true)",[id(9)]);
await q("insert into public.universe_memberships(id,instrument_id,entry_type,theme_group) values($1,$2,'INDEX','UNIVERSE-2 US')",[id(100),id(1)]);
await q('insert into public.watchlist(user_id,instrument_id) values($1,$2)',[user,id(2)]);
await q('insert into public.portfolio_positions(user_id,instrument_id) values($1,$2)',[user,id(3)]);
await q('insert into public.stock_analyses(user_id,instrument_id) values($1,$2)',[user,id(4)]);
await q('insert into public.trade_journal(user_id,instrument_id) values($1,$2)',[user,id(5)]);

// A deployed activate_index_universe() that differs from schema.sql must survive the migration untouched.
await q("create or replace function public.activate_index_universe() returns integer language plpgsql security definer set search_path = '' as $f$ declare n integer; begin update public.instruments i set active = exists (select 1 from public.universe_memberships um where um.instrument_id=i.id and um.entry_type='INDEX') where i.asset_class='Equity'; get diagnostics n = row_count; return n; end $f$");
const before = (await q(`select md5(prosrc) m from pg_proc where oid='public.activate_index_universe()'::regprocedure`)).rows[0].m;
await db.exec(sql);
await db.exec(sql);
check('migration re-applies', true);
check('deployed activate_index_universe() is left as deployed', (await q(`select md5(prosrc) m from pg_proc where oid='public.activate_index_universe()'::regprocedure`)).rows[0].m === before);
const active = async () => Object.fromEntries((await q('select ticker,active from public.instruments order by ticker')).rows.map(r => [r.ticker, r.active]));
await q('select public.activate_index_universe()');
let a = await active();
check('activation alone deactivates non-members, including user-referenced ones', a.IDX && !a.WATCH && !a.GONE);
check('keep re-activates exactly the four user-referenced equities', Number((await q('select public.keep_user_referenced_active() n')).rows[0].n) === 4);
a = await active();
check('index member stays active', a.IDX === true);
check('watchlist, portfolio, analysis and journal references stay active', a.WATCH && a.PORT && a.ANAL && a.JOUR);
check('unreferenced non-member stays inactive', a.GONE === false);
check('ETFs are not touched', a.ETF1 === true);
check('keep is a no-op when nothing changed', Number((await q('select public.keep_user_referenced_active() n')).rows[0].n) === 0);
await q('delete from public.watchlist where instrument_id=$1',[id(2)]);
await q('select public.activate_index_universe()');await q('select public.keep_user_referenced_active()');
check('removing the last reference lets activation deactivate it', (await active()).WATCH === false);

// Retention
const day = n => new Date(Date.UTC(2024,0,1) + n*86400000).toISOString().slice(0,10);
await db.exec(`insert into public.price_daily(instrument_id,trade_date,close)
  select '${id(1)}', date '2024-01-01' + g, 100 from generate_series(0,449) g;
  insert into public.price_daily(instrument_id,trade_date,close)
  select '${id(2)}', date '2024-01-01' + g, 100 from generate_series(0,99) g;`);
await db.exec(`insert into public.market_metrics(instrument_id,as_of,price)
  select '${id(1)}', current_date - g, 1 from generate_series(0,89) g;
  insert into public.market_metrics(instrument_id,as_of,price) values('${id(3)}', current_date - 400, 1);`);
const count = async t => Number((await q(`select count(*) n from public.${t}`)).rows[0].n);
const priceBefore = await count('price_daily'), metricBefore = await count('market_metrics');
const dry = (await q('select public.prune_market_history() r')).rows[0].r;
check('dry run reports without deleting', dry.applied === false && dry.price_rows === 50 && await count('price_daily') === priceBefore && await count('market_metrics') === metricBefore);
// Older rows that survive: the last row of their ISO week (a week straddling the cutoff keeps its recent row instead).
const weeksOld = Number((await q(`select count(*) n from (select as_of, row_number() over(partition by date_trunc('week',as_of) order by as_of desc) w
  from public.market_metrics where instrument_id=$1) x where w=1 and as_of < current_date-30`,[id(1)])).rows[0].n);
const olderRows = Number((await q(`select count(*) n from public.market_metrics where instrument_id=$1 and as_of < current_date-30`,[id(1)])).rows[0].n);
check('metric dry run counts non-weekly rows older than 30 days', dry.metric_rows === olderRows - weeksOld);
const applied = (await q('select public.prune_market_history(400,30,true) r')).rows[0].r;
check('apply deletes the reported rows', applied.applied === true && await count('price_daily') === priceBefore - 50 && await count('market_metrics') === metricBefore - dry.metric_rows);
const kept = (await q(`select min(trade_date)::text d, count(*) n from public.price_daily where instrument_id=$1`,[id(1)])).rows[0];
check('newest 400 sessions kept', Number(kept.n) === 400 && kept.d === day(50));
check('short histories untouched', Number((await q(`select count(*) n from public.price_daily where instrument_id=$1`,[id(2)])).rows[0].n) === 100);
check('all metrics from the last 30 days kept', Number((await q(`select count(*) n from public.market_metrics where instrument_id=$1 and as_of >= current_date-30`,[id(1)])).rows[0].n) === 31);
check('only the last row of each older ISO week kept', Number((await q(`select count(*) n from public.market_metrics where instrument_id=$1 and as_of < current_date-30`,[id(1)])).rows[0].n) === weeksOld);
check('an old newest row is never pruned', Number((await q(`select count(*) n from public.market_metrics where instrument_id=$1`,[id(3)])).rows[0].n) === 1);
check('second apply is a no-op', (await q('select public.prune_market_history(400,30,true) r')).rows[0].r.price_rows === 0);
let tooShort = false;
try { await q('select public.prune_market_history(200)'); } catch (e) { tooShort = /keep_sessions/.test(String(e.message)); }
check('refuses to keep fewer than 260 sessions', tooShort);
for (const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  let denied = false;
  try { await q('select public.prune_market_history()'); } catch (e) { denied = /permission denied/.test(String(e.message)); }
  let deniedAct = false;
  try { await q('select public.keep_user_referenced_active()'); } catch (e) { deniedAct = /permission denied/.test(String(e.message)); }
  await db.exec('reset role');
  check(`${role} cannot prune or keep`, denied && deniedAct);
}
console.log(`${passed} universe checks passed`);
