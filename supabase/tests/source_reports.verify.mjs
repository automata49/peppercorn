import {PGlite} from '@electric-sql/pglite'
import {readFileSync,readdirSync} from 'node:fs'
const db=new PGlite(),A='10000000-0000-0000-0000-000000000001',B='20000000-0000-0000-0000-000000000002'
let passed=0
const check=(label,ok)=>{if(!ok)throw Error(label);passed++}
const fails=async fn=>{try{await fn();return false}catch{return true}}
await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
grant usage on schema public,auth to authenticated,anon,service_role;
insert into auth.users values('${A}'),('${B}');`)
const migration=readdirSync('supabase/migrations').find(p=>p.endsWith('_private_source_reports.sql'))
await db.exec(readFileSync('supabase/migrations/'+migration,'utf8'))
await db.query(`insert into public.private_source_reports(user_id,drive_file_id,folder_id,title,source_url,source_modified_at,content_hash,summary,pages,links)
values($1,'fixture_report_12345','fixture_folder_12345','Synthetic report','https://drive.google.com/file/d/fixture_report_12345/view','2026-10-15T02:00:00Z',$2,'["Fixture"]','[{"number":1,"text":"Fixture","images":[]}]','[]')`,[A,'a'.repeat(64)])
const as=async(uid,fn)=>{await db.exec(`set role authenticated;select set_config('test.uid','${uid}',false)`);try{return await fn()}finally{await db.exec('reset role')}}
check('owner sees report',await as(A,async()=>Number((await db.query('select count(*) n from public.private_source_reports')).rows[0].n)===1))
check('other account cannot read report',await as(B,async()=>Number((await db.query('select count(*) n from public.private_source_reports')).rows[0].n)===0))
check('browser cannot rewrite imported report',await fails(()=>as(A,()=>db.query("update public.private_source_reports set title='Changed'"))))
check('browser cannot delete imported report',await fails(()=>as(A,()=>db.query('delete from public.private_source_reports'))))
await db.exec('set role anon')
check('anonymous reads denied',await fails(()=>db.query('select * from public.private_source_reports')))
await db.exec('reset role')
check('no public browser insert grant',(await db.query("select has_table_privilege('authenticated','public.private_source_reports','insert') as allowed")).rows[0].allowed===false)
check('unique import key',await fails(()=>db.query('insert into public.private_source_reports select * from public.private_source_reports')))
console.log(`${passed} private report ownership/permission checks passed`)
await db.close()
