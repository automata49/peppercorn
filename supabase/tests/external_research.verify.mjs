// RESEARCH-INGEST-1: PGlite checks public discovery metadata and owner-only captured bodies.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';

const db=new PGlite();let passed=0;
const check=(name,yes)=>{if(!yes)throw new Error(name);passed++;console.log('PASS',name)};
const q=(sql,args)=>db.query(sql,args);
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public to anon,authenticated,service_role; grant usage on schema auth to anon,authenticated;
  grant execute on function auth.uid() to anon,authenticated;`);
await db.exec(readFileSync('supabase/schema.sql','utf8').replace(/create extension if not exists pgcrypto;/,''));
const sql=readFileSync('supabase/migrations/20261004140000_external_research_ingestion.sql','utf8');
await db.exec(sql);await db.exec(sql);check('migration re-applies',true);
const asRole=async(role,fn)=>{await db.exec(`set role ${role}`);try{return await fn()}finally{await db.exec('reset role')}};
const pipelineHash='e'.repeat(64);
check('pipeline role inserts public feed only',await asRole('research_feed_pipeline',async()=>{await q(`insert into public.external_research_feed(source,source_key,external_id,fingerprint,source_url,title) values('telegram','hs_academy','pipeline',$1,'https://t.me/HS_academy/999','pipeline')`,[pipelineHash]);return true}));
check('pipeline role cannot insert private captures',await (async()=>{try{await asRole('research_feed_pipeline',()=>q(`insert into public.research_captures(user_id,source_url,captured_text,content_hash) values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','https://example.com','x',$1)`,['f'.repeat(64)]));return false}catch{return true}})());

const A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
await q('insert into auth.users(id) values($1),($2)',[A,B]);
await q(`insert into public.external_research_feed(source,source_key,external_id,fingerprint,source_url,linked_url,linked_type,title,excerpt)
values('telegram','hs_academy','123','${'a'.repeat(64)}','https://t.me/HS_academy/123','https://contents.premium.naver.com/x','naver_premium','공개 메타','공개 Telegram 문구')`);
const as=async(uid,fn)=>{await db.exec(`set role authenticated; select set_config('test.uid','${uid}',false)`);try{return await fn()}finally{await db.exec('reset role')}};
const fails=async fn=>{try{await fn();return false}catch{return true}};

check('authenticated owner can read public feed metadata',await as(A,async()=>Number((await q('select count(*) n from public.external_research_feed')).rows[0].n)===1));
await db.exec('set role anon');check('anon cannot read feed',await fails(()=>q('select * from public.external_research_feed')));await db.exec('reset role');

check('owner captures text',await as(A,async()=>{await q(`insert into public.research_captures(user_id,source_url,title,source_type,captured_text,content_hash)
values($1,'https://contents.premium.naver.com/example','내가 연 글','naver_premium','사용자가 직접 넘긴 본문',$2)`,[A,'b'.repeat(64)]);return true}));
check('capture starts provider unavailable',await as(A,async()=>((await q('select analysis_status from public.research_captures')).rows[0].analysis_status==='provider_unavailable')));
check('other user sees no captures',await as(B,async()=>Number((await q('select count(*) n from public.research_captures')).rows[0].n)===0));
check('other user cannot insert for owner',await fails(()=>as(B,()=>q(`insert into public.research_captures(user_id,source_url,captured_text,content_hash) values($1,'https://example.com','x',$2)`,[A,'c'.repeat(64)]))));
check('duplicate user content hash refused',await fails(()=>as(A,()=>q(`insert into public.research_captures(user_id,source_url,captured_text,content_hash) values($1,'https://example.com','same',$2)`,[A,'b'.repeat(64)]))));
check('empty capture refused',await fails(()=>as(A,()=>q(`insert into public.research_captures(user_id,source_url,captured_text,content_hash) values($1,'https://example.com','   ',$2)`,[A,'d'.repeat(64)]))));
const policies=(await q(`select count(*) n from pg_policies where tablename='research_captures'`)).rows[0].n;
check('capture has four owner policies',Number(policies)===4);
check('capture RLS enabled',(await q(`select relrowsecurity r from pg_class where oid='public.research_captures'::regclass`)).rows[0].r===true);
console.log(`${passed} external research checks passed`);
