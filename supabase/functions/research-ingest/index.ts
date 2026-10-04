import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins=new Set(["https://automata49.github.io","http://localhost:5173","http://127.0.0.1:5173"]);
function cors(origin:string|null){const allow=origin&&allowedOrigins.has(origin)?origin:"https://automata49.github.io";return{"Access-Control-Allow-Origin":allow,"Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Vary":"Origin"}}
function json(data:unknown,status:number,headers:Record<string,string>){return Response.json(data,{status,headers})}
function decodeSub(auth:string){const token=auth.replace(/^Bearer\s+/i,"");const part=token.split(".")[1]||"";const normalized=part.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(part.length/4)*4,"=");return JSON.parse(atob(normalized)).sub as string}
async function sha256(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function cleanText(value:unknown,max:number){return typeof value==="string"?value.replace(/\u0000/g,"").trim().slice(0,max):""}
function cleanMetadata(value:unknown){if(!value||typeof value!=="object"||Array.isArray(value))return{};const out:Record<string,string|number|boolean|null>={};for(const [k,v] of Object.entries(value as Record<string,unknown>)){if(!/^[a-z0-9_]{1,40}$/i.test(k))continue;if(v===null||typeof v==="string"||typeof v==="number"||typeof v==="boolean")out[k]=typeof v==="string"?v.slice(0,500):v}return out}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin");const headers=cors(origin);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(origin&&!allowedOrigins.has(origin))return json({error:"origin_not_allowed"},403,headers);
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return json({error:"missing_auth"},401,headers);
  let uid:string;try{uid=decodeSub(auth)}catch{return json({error:"invalid_auth"},401,headers)}
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!anon)return json({error:"server_not_configured"},500,headers);
  const baseHeaders={apikey:anon,Authorization:auth,"Content-Type":"application/json"};
  const rest=async(path:string,init:RequestInit={})=>{const r=await fetch(url+"/rest/v1/"+path,{...init,headers:{...baseHeaders,...(init.headers||{})}});const text=await r.text();let data:any=null;if(text){try{data=JSON.parse(text)}catch{data=text}}if(!r.ok)throw new Error(JSON.stringify({status:r.status,data}));return data};

  if(req.method==="GET"){
    try{
      const rows=await rest("external_research_items?user_id=eq."+encodeURIComponent(uid)+"&select=id,source_kind,source_name,source_url,title,content,captured_at,published_at,analysis_status,analysis,metadata,created_at,updated_at&order=captured_at.desc&limit=100");
      return json({rows},200,headers);
    }catch(error){return json({error:"read_failed",detail:String(error).slice(0,400)},502,headers)}
  }

  if(req.method==="POST"){
    let body:any;try{body=await req.json()}catch{return json({error:"invalid_json"},400,headers)}
    const sourceUrl=cleanText(body?.source_url,2048),title=cleanText(body?.title,500),content=cleanText(body?.content,120000);
    if(!sourceUrl||!title||!content)return json({error:"missing_required_fields"},400,headers);
    let parsed:URL;try{parsed=new URL(sourceUrl)}catch{return json({error:"invalid_source_url"},400,headers)}
    if(parsed.protocol!=="https:")return json({error:"https_source_required"},400,headers);
    const kind=["manual_capture","bookmarklet","file_upload"].includes(body?.source_kind)?body.source_kind:"manual_capture";
    const sourceName=cleanText(body?.source_name,160)||parsed.hostname;
    const publishedAt=body?.published_at&&/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(String(body.published_at))?String(body.published_at):null;
    const hash=await sha256(sourceUrl+"\n"+content);
    const now=new Date().toISOString();
    const row={user_id:uid,source_kind:kind,source_name:sourceName,source_url:sourceUrl,title,content,content_hash:hash,captured_at:now,published_at:publishedAt,analysis_status:"provider_unavailable",analysis:null,metadata:cleanMetadata(body?.metadata),updated_at:now};
    try{
      const saved=await rest("external_research_items?on_conflict=user_id,content_hash",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(row)});
      return json({ok:true,row:Array.isArray(saved)?saved[0]:saved,deduped:false},200,headers);
    }catch(error){return json({error:"write_failed",detail:String(error).slice(0,400)},502,headers)}
  }
  return json({error:"method_not_allowed"},405,headers);
});
