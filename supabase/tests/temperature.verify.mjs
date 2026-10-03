// TEMP-1: PGlite checks for supabase/migrations/*_market_temperature.sql (RLS, ranges, re-run).
import {PGlite} from '@electric-sql/pglite';
import {readFileSync, readdirSync} from 'node:fs';

const db = new PGlite();
let passed = 0;
function check(name, yes) { if (!yes) throw new Error(name); passed++; console.log('PASS', name); }
const q = (sql, args) => db.query(sql, args);
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public to anon,authenticated,service_role; grant usage on schema auth to anon,authenticated;
  grant execute on function auth.uid() to anon,authenticated;`);
await db.exec(readFileSync('supabase/schema.sql','utf8').replace(/create extension if not exists pgcrypto;/,''));
const file = readdirSync('supabase/migrations').find(n => n.endsWith('_market_temperature.sql'));
if (!file) throw new Error('missing migration');
const sql = readFileSync(`supabase/migrations/${file}`,'utf8');
await db.exec(sql);
await db.exec(sql);
check('migration re-applies', true);

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
await q('insert into auth.users(id) values($1),($2)',[A,B]);
const as = async (uid, fn) => { await db.exec(`set role authenticated; select set_config('test.uid','${uid}',false)`); try { return await fn(); } finally { await db.exec('reset role'); } };
const fails = async fn => { try { await fn(); return false; } catch { return true; } };

check('owner inserts an entry', await as(A, async () => { await q(`insert into public.market_temperature_entries(user_id,recorded_on,marks,evidence) values($1,'2026-10-03','{"economy":1,"rates":3}','{"rates":"10년물 5.29%"}')`,[A]); return true; }));
check('owner reads only own rows', await as(A, async () => (await q('select count(*) n from public.market_temperature_entries')).rows[0].n == 1));
check('another user sees nothing', await as(B, async () => (await q('select count(*) n from public.market_temperature_entries')).rows[0].n == 0));
check('another user cannot insert for the owner', await fails(() => as(B, () => q(`insert into public.market_temperature_entries(user_id,recorded_on) values($1,'2026-10-04')`,[A]))));
check('another user cannot delete the owner\'s rows', await as(B, async () => { await q('delete from public.market_temperature_entries'); return true; }) && Number((await q('select count(*) n from public.market_temperature_entries')).rows[0].n) === 1);
check('one entry per user and date', await fails(() => as(A, () => q(`insert into public.market_temperature_entries(user_id,recorded_on) values($1,'2026-10-03')`,[A]))));
check('marks outside 0..4 are refused', await fails(() => as(A, () => q(`insert into public.market_temperature_entries(user_id,recorded_on,marks) values($1,'2026-10-05','{"economy":5}')`,[A]))));
check('fractional marks are refused', await fails(() => as(A, () => q(`insert into public.market_temperature_entries(user_id,recorded_on,marks) values($1,'2026-10-05','{"economy":1.5}')`,[A]))));
check('text marks are refused', await fails(() => as(A, () => q(`insert into public.market_temperature_entries(user_id,recorded_on,marks) values($1,'2026-10-05','{"economy":"1"}')`,[A]))));
check('non-object marks are refused', await fails(() => as(A, () => q(`insert into public.market_temperature_entries(user_id,recorded_on,marks) values($1,'2026-10-05','[1]')`,[A]))));
check('an empty marks object is allowed', await as(A, async () => { await q(`insert into public.market_temperature_entries(user_id,recorded_on) values($1,'2026-10-06')`,[A]); return true; }));
await db.exec('set role anon');
check('anon cannot read', await fails(() => q('select * from public.market_temperature_entries')));
await db.exec('reset role');
const pol = (await q(`select count(*) n from pg_policies where tablename='market_temperature_entries'`)).rows[0].n;
check('four owner policies after re-apply', Number(pol) === 4);
check('RLS enabled', (await q(`select relrowsecurity r from pg_class where oid='public.market_temperature_entries'::regclass`)).rows[0].r === true);
check('research_notes untouched (no rows created or removed)', Number((await q('select count(*) n from public.research_notes')).rows[0].n) === 0);
console.log(`${passed} temperature checks passed`);
