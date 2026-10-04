// RESEARCH-INGEST-1: accepts public discovery metadata only from the scheduled GitHub workflow.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as jose from "jsr:@panva/jose@6";
import postgres from "npm:postgres@3.4.7";

const WORKFLOW="automata49/peppercorn/.github/workflows/research-discover.yml@refs/heads/main";
const JWKS=jose.createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const MAX_ITEMS=100;

async function authorized(req:Request){
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return false;
  try{
    const {payload}=await jose.jwtVerify(auth.slice(7),JWKS,{issuer:"https://token.actions.githubusercontent.com",audience:"peppercorn-supabase"});
    return payload.repository==="automata49/peppercorn"&&payload.ref==="refs/heads/main"&&payload.workflow_ref===WORKFLOW;
  }catch{return false}
}
const httpsUrl=(value:unknown)=>typeof value==="string"&&value.startsWith("https://")&&value.length<=2048;
function cleanItem(r:any){
  if(!r||r.source!=="telegram"||r.source_key!=="hs_academy")throw new Error("unsupported source");
  if(typeof r.external_id!=="string"||!/^[0-9]{1,20}$/.test(r.external_id))throw new Error("invalid external_id");
  if(typeof r.fingerprint!=="string"||!/^[0-9a-f]{64}$/.test(r.fingerprint))throw new Error("invalid fingerprint");
  if(!httpsUrl(r.source_url)||!String(r.source_url).startsWith("https://t.me/HS_academy/"))throw new Error("invalid source_url");
  if(r.linked_url!=null&&!httpsUrl(r.linked_url))throw new Error("invalid linked_url");
  if(r.linked_type!=null&&!["naver_premium","naver","youtube","other"].includes(r.linked_type))throw new Error("invalid linked_type");
  const title=String(r.title||"").trim().slice(0,500);if(!title)throw new Error("missing title");
  return {source:"telegram",source_key:"hs_academy",external_id:r.external_id,fingerprint:r.fingerprint,
    source_url:r.source_url,linked_url:r.linked_url||null,linked_type:r.linked_type||null,title,
    excerpt:r.excerpt?String(r.excerpt).slice(0,4000):null,published_at:r.published_at||null,
    metadata:r.metadata&&typeof r.metadata==="object"&&!Array.isArray(r.metadata)?r.metadata:{}};
}
const UPSERT=`
insert into public.external_research_feed
(source,source_key,external_id,fingerprint,source_url,linked_url,linked_type,title,excerpt,published_at,metadata,discovered_at)
select r.source,r.source_key,r.external_id,r.fingerprint,r.source_url,r.linked_url,r.linked_type,r.title,r.excerpt,r.published_at,r.metadata,now()
from jsonb_to_recordset($1::text::jsonb) as r(
  source text,source_key text,external_id text,fingerprint text,source_url text,linked_url text,linked_type text,
  title text,excerpt text,published_at timestamptz,metadata jsonb)
on conflict (source_key,external_id) do update set
  fingerprint=excluded.fingerprint,source_url=excluded.source_url,linked_url=excluded.linked_url,
  linked_type=excluded.linked_type,title=excluded.title,excerpt=excluded.excerpt,published_at=excluded.published_at,
  metadata=excluded.metadata,discovered_at=now()
returning id`;

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return Response.json({error:"method_not_allowed"},{status:405});
  if(!(await authorized(req)))return Response.json({error:"unauthorized"},{status:401});
  let body:any;try{body=await req.json()}catch{return Response.json({error:"invalid_json"},{status:400})}
  if(!Array.isArray(body?.items)||body.items.length>MAX_ITEMS)return Response.json({error:"invalid_items"},{status:400});
  let items:any[];try{items=body.items.map(cleanItem)}catch(e){return Response.json({error:"invalid_item",detail:String((e as Error).message)},{status:400})}
  if(!items.length)return Response.json({ok:true,received:0,upserted:0});
  const dbUrl=Deno.env.get("SUPABASE_DB_URL");if(!dbUrl)return Response.json({error:"server_not_configured"},{status:500});
  const sql=postgres(dbUrl,{prepare:false,max:1,idle_timeout:5});
  try{
    const rows=await sql.unsafe(UPSERT,[JSON.stringify(items)]);
    return Response.json({ok:true,received:items.length,upserted:rows.length});
  }catch(e){return Response.json({error:"write_refused",detail:String((e as Error).message).slice(0,300)},{status:422})}
  finally{await sql.end({timeout:5})}
});
