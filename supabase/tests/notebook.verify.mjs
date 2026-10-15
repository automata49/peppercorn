import {PGlite} from '@electric-sql/pglite'
import {readFileSync,readdirSync} from 'node:fs'
const db=new PGlite(),A='10000000-0000-0000-0000-000000000001',B='20000000-0000-0000-0000-000000000002'
let passed=0
const check=(label,ok)=>{if(!ok)throw Error(label);passed++}
const fails=async fn=>{try{await fn();return false}catch{return true}}
await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;insert into auth.users values('${A}'),('${B}');`)
await db.exec(readFileSync('supabase/migrations/'+readdirSync('supabase/migrations').find(p=>p.endsWith('_notebook_account_sync.sql')),'utf8'))
const as=async(uid,fn)=>{await db.exec(`set role authenticated;select set_config('test.uid','${uid}',false)`);try{return await fn()}finally{await db.exec('reset role')}}
const save=entries=>db.query('select public.save_notebook_entries($1::jsonb)',[JSON.stringify(entries)])
const original={id:'page-a',title:'Private page',updatedAt:'2026-10-15T00:00:00Z',revisions:[],body:{type:'doc'},photos:['data:image/png;base64,AA=='],ink:[[{x:1,y:2}]]}
await as(A,()=>save([original]))
check('owner reads complete original',JSON.stringify((await as(A,()=>db.query('select entry from public.notebook_entries'))).rows[0].entry.photos)===JSON.stringify(original.photos))
check('other account sees no page',(await as(B,()=>db.query('select * from public.notebook_entries'))).rows.length===0)
check('idempotent retry',!await fails(()=>as(A,()=>save([original]))))
const revised={...original,title:'Revised',updatedAt:'2026-10-15T01:00:00Z',revisions:[{at:original.updatedAt,snapshot:original}]}
await as(A,()=>save([revised]))
check('stale same-record write is rejected',await fails(()=>as(A,()=>save([{...original,title:'stale',updatedAt:'2026-10-15T02:00:00Z'}]))))
check('batch conflict is atomic',await fails(()=>as(A,()=>save([{...original,id:'must-rollback'},original]))))
check('failed batch preserves unrelated pages',(await as(A,()=>db.query("select * from public.notebook_entries where id='must-rollback'"))).rows.length===0)
check('owner reassignment denied',await fails(()=>as(A,()=>db.query('update public.notebook_entries set user_id=$1',[B]))))
await db.exec('set role anon');check('anonymous reads denied',await fails(()=>db.query('select * from public.notebook_entries')));check('anonymous writes denied',await fails(()=>save([original])));await db.exec('reset role')
check('invoker RPC',(await db.query("select prosecdef from pg_proc where proname='save_notebook_entries'")).rows[0].prosecdef===false)
const offline={...revised,title:'Second offline edit',updatedAt:'2026-10-15T03:00:00Z',revisions:[...revised.revisions,{at:revised.updatedAt,snapshot:revised}]}
await as(A,()=>save([offline]));check('offline chain fast-forwards from any recorded ancestor',(await as(A,()=>db.query('select entry from public.notebook_entries'))).rows[0].entry.title===offline.title)
await as(A,()=>db.query("insert into public.folio_basket_items(market,ticker,name) values('US','NVDA','NVIDIA')"))
check('basket isolated between accounts',(await as(B,()=>db.query('select * from public.folio_basket_items'))).rows.length===0)
check('basket ownership cannot be reassigned',await fails(()=>as(A,()=>db.query('update public.folio_basket_items set user_id=$1',[B]))))
check('no destructive notebook grant',(await db.query("select has_table_privilege('authenticated','public.notebook_entries','delete') allowed")).rows[0].allowed===false)
console.log(`${passed} notebook isolation, retry, conflict and atomicity checks passed`);await db.close()
