import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as jose from "jsr:@panva/jose@6";

const JWKS=jose.createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const EXPECTED_REPO="automata49/peppercorn";
const AUDIENCE="peppercorn-supabase";

async function githubAuthorized(req:Request){
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return false;
  try{
    const {payload}=await jose.jwtVerify(auth.slice(7),JWKS,{issuer:"https://token.actions.githubusercontent.com",audience:AUDIENCE});
    return payload.repository===EXPECTED_REPO && payload.ref==="refs/heads/main";
  }catch{return false}
}
function chunks<T>(rows:T[],n=300){const out:T[][]=[];for(let i=0;i<rows.length;i+=n)out.push(rows.slice(i,i+n));return out}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return Response.json({error:"method_not_allowed"},{status:405});
  if(!(await githubAuthorized(req)))return Response.json({error:"unauthorized"},{status:401});

  const base=Deno.env.get("SUPABASE_URL"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!base||!secret)return Response.json({error:"server_not_configured"},{status:500});
  const headers={apikey:secret,Authorization:"Bearer "+secret,"Content-Type":"application/json"};
  let body:any;try{body=await req.json()}catch{return Response.json({error:"invalid_json"},{status:400})}
  const instruments=Array.isArray(body?.instruments)?body.instruments:[];
  const memberships=Array.isArray(body?.memberships)?body.memberships:[];
  if(instruments.length<1400||instruments.length>1600)return Response.json({error:"invalid_instrument_count",count:instruments.length},{status:400});
  if(memberships.length<1400||memberships.length>3000)return Response.json({error:"invalid_membership_count",count:memberships.length},{status:400});

  const idMap=new Map<string,string>();
  for(const batch of chunks(instruments)){
    const r=await fetch(base+"/rest/v1/instruments?on_conflict=market,ticker",{
      method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(batch)
    });
    if(!r.ok)return Response.json({error:"instrument_upsert_failed",detail:await r.text()},{status:502});
    for(const x of await r.json())idMap.set(x.market+"|"+x.ticker,x.id);
  }

  const del=await fetch(base+"/rest/v1/universe_memberships?entry_type=eq.INDEX",{method:"DELETE",headers:{...headers,Prefer:"return=minimal"}});
  if(!del.ok)return Response.json({error:"membership_delete_failed",detail:await del.text()},{status:502});

  const mapped=memberships.map((m:any)=>{
    const instrument_id=idMap.get(String(m.market)+"|"+String(m.ticker));
    if(!instrument_id)throw new Error("missing_instrument:"+m.market+":"+m.ticker);
    const {market:_,ticker:__,...rest}=m;return {...rest,instrument_id};
  });
  for(const batch of chunks(mapped)){
    const r=await fetch(base+"/rest/v1/universe_memberships?on_conflict=id",{
      method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(batch)
    });
    if(!r.ok)return Response.json({error:"membership_upsert_failed",detail:await r.text()},{status:502});
  }

  const active=await fetch(base+"/rest/v1/rpc/activate_index_universe",{method:"POST",headers,body:"{}"});
  if(!active.ok)return Response.json({error:"activation_failed",detail:await active.text()},{status:502});
  return Response.json({ok:true,instruments:instruments.length,memberships:mapped.length,activated:await active.json()});
});
