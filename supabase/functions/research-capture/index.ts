// RESEARCH-INGEST-1: authenticated user's own browser-captured research text.
// Deployed with verify_jwt ON. The function never fetches the supplied source URL.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins=new Set(["https://automata49.github.io","http://localhost:5173","http://127.0.0.1:5173","http://127.0.0.1:4173"]);
function cors(origin:string|null){const allow=origin&&allowedOrigins.has(origin)?origin:"https://automata49.github.io";return{"Access-Control-Allow-Origin":allow,"Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS","Vary":"Origin"}}
const json=(data:unknown,status:number,headers:Record<string,string>)=>Response.json(data,{status,headers});
function decodeSub(auth:string){const part=auth.replace(/^Bearer\s+/i,"").split(".")[1]||"";const normalized=part.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(part.length/4)*4,"=");return JSON.parse(atob(normalized)).sub as string}
function clientKey(){
  try{const keys=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");if(keys?.default)return String(keys.default)}catch{}
  return Deno.env.get("SUPABASE_ANON_KEY")||"";
}
function sourceType(url:string){
  try{const host=new URL(url).hostname.toLowerCase();if(host==="contents.premium.naver.com")return"naver_premium";if(host==="t.me")return"telegram";if(host.includes("youtube.com")||host==="youtu.be")return"youtube"}catch{}
  return"web";
}
async function sha256(text:string){const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("")}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin"),headers=cors(origin);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(origin&&!allowedOrigins.has(origin))return json({error:"origin_not_allowed"},403,headers);
  const auth=req.headers.get("authorization")||"";if(!auth.startsWith("Bearer "))return json({error:"missing_auth"},401,headers);
  let uid:string;try{uid=decodeSub(auth);if(!/^[0-9a-f-]{36}$/i.test(uid))throw new Error()}catch{return json({error:"invalid_auth"},401,headers)}
  const url=Deno.env.get("SUPABASE_URL"),key=clientKey();if(!url||!key)return json({error:"server_not_configured"},500,headers);
  const baseHeaders={apikey:key,Authorization:auth,"Content-Type":"application/json"};
  const rest=async(path:string,init:RequestInit={})=>{const response=await fetch(url+"/rest/v1/"+path,{...init,headers:{...baseHeaders,...(init.headers||{})}});const raw=await response.text();let data:any=null;if(raw){try{data=JSON.parse(raw)}catch{data=raw}}if(!response.ok)throw new Error(JSON.stringify({status:response.status,data}));return data};
  const reqUrl=new URL(req.url);
  try{
    if(req.method==="GET"){
      const [feed,captures]=await Promise.all([
        rest("external_research_feed?select=id,source,source_key,external_id,source_url,linked_url,linked_type,title,excerpt,published_at,discovered_at&order=published_at.desc.nullslast,discovered_at.desc&limit=30"),
        rest("research_captures?user_id=eq."+uid+"&select=id,feed_item_id,source_url,title,source_type,captured_text,content_hash,analysis_status,analysis,captured_at,updated_at&order=captured_at.desc&limit=100")
      ]);
      return json({feed,captures},200,headers);
    }
    if(req.method==="POST"){
      let body:any;try{body=await req.json()}catch{return json({error:"invalid_json"},400,headers)}
      const sourceUrl=String(body?.source_url||"").trim(),title=String(body?.title||"").trim().slice(0,500),capturedText=String(body?.captured_text||"").trim();
      if(!sourceUrl.startsWith("https://")||sourceUrl.length>2048)return json({error:"invalid_source_url"},400,headers);
      if(!capturedText||capturedText.length>200000)return json({error:"invalid_captured_text"},400,headers);
      const feedId=body?.feed_item_id==null?null:String(body.feed_item_id);
      if(feedId&&!/^[0-9a-f-]{36}$/i.test(feedId))return json({error:"invalid_feed_item_id"},400,headers);
      const hash=await sha256(capturedText);
      const payload={user_id:uid,feed_item_id:feedId,source_url:sourceUrl,title,source_type:sourceType(sourceUrl),captured_text:capturedText,
        content_hash:hash,analysis_status:"provider_unavailable",analysis:null,captured_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      const rows=await rest("research_captures?on_conflict=user_id,content_hash",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify([payload])});
      return json({ok:true,capture:rows?.[0]||null,analysis_status:"provider_unavailable"},200,headers);
    }
    if(req.method==="DELETE"){
      const id=reqUrl.searchParams.get("id")||"";if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:"invalid_id"},400,headers);
      await rest("research_captures?id=eq."+id+"&user_id=eq."+uid,{method:"DELETE",headers:{Prefer:"return=minimal"}});
      return json({ok:true},200,headers);
    }
    return json({error:"method_not_allowed"},405,headers);
  }catch(e){return json({error:"research_request_failed",detail:String(e).slice(0,500)},502,headers)}
});
