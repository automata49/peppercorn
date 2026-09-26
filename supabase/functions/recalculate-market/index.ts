import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as jose from "jsr:@panva/jose@6";

const JWKS=jose.createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
async function authorized(req:Request){
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return false;
  try{
    const {payload}=await jose.jwtVerify(auth.slice(7),JWKS,{issuer:"https://token.actions.githubusercontent.com",audience:"peppercorn-supabase"});
    return payload.repository==="automata49/peppercorn" && payload.ref==="refs/heads/main";
  }catch{return false}
}
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return Response.json({error:"method_not_allowed"},{status:405});
  if(!(await authorized(req)))return Response.json({error:"unauthorized"},{status:401});
  const base=Deno.env.get("SUPABASE_URL"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!base||!secret)return Response.json({error:"server_not_configured"},{status:500});
  const r=await fetch(base+"/rest/v1/rpc/recalculate_market_leadership",{
    method:"POST",headers:{apikey:secret,Authorization:"Bearer "+secret,"Content-Type":"application/json"},body:"{}"
  });
  if(!r.ok)return Response.json({error:"recalculate_failed",detail:await r.text()},{status:502});
  return Response.json({ok:true,result:await r.json()});
});
