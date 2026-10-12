import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins = new Set([
  "https://automata49.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);

function cors(origin: string | null) {
  const allow = origin && allowedOrigins.has(origin) ? origin : "https://automata49.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin"
  };
}
function json(data: unknown, status: number, headers: Record<string,string>) {
  return Response.json(data,{status,headers:{...headers,"Cache-Control":"no-store"}});
}

Deno.serve(async (req: Request) => {
  const origin=req.headers.get("origin");
  const headers=cors(origin);
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405,headers);
  if(origin && !allowedOrigins.has(origin)) return json({error:"origin_not_allowed"},403,headers);

  let body:any;
  try{body=await req.json()}catch{return json({error:"invalid_json"},400,headers)}
  const action=String(body?.action||"");
  const email=String(body?.email||"").trim().toLowerCase();
  const password=String(body?.password||"");

  const url=Deno.env.get("SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!anon) return json({error:"server_not_configured"},500,headers);

  // Public readiness only; provider credentials and the remaining auth configuration stay server-side.
  if(action==="google_status"){
    try{
      const result=await fetch(url+"/auth/v1/settings",{headers:{apikey:anon},signal:AbortSignal.timeout(8000)});
      if(!result.ok)return json({error:"auth_provider_check_failed"},503,headers);
      const settings=await result.json();
      if(settings?.external?.google!==true)return json({error:"google_provider_disabled"},503,headers);
      return json({ready:true},200,headers);
    }catch{return json({error:"auth_provider_check_failed"},503,headers)}
  }

  // MULTI-USER-1: regular GoTrue signup preserves email verification and provider rate limits.
  // Never auto-confirm email or use the admin API for public registration.
  if(action==="signup"){
    if(!email || password.length<8) return json({error:"email_and_password_required"},400,headers);
    const created=await fetch(url+"/auth/v1/signup?redirect_to="+encodeURIComponent("https://automata49.github.io/peppercorn/?email-confirmed=1"),{
      method:"POST",headers:{apikey:anon,"Content-Type":"application/json"},
      body:JSON.stringify({email,password}),signal:AbortSignal.timeout(10000)
    });
    const payload=await created.json().catch(()=>({}));
    if(!created.ok){
      const allowed=["signup_disabled","email_provider_disabled","email_address_invalid","weak_password","user_already_exists","over_email_send_rate_limit","over_request_rate_limit"];
      const error=allowed.includes(payload.error_code)?payload.error_code:"signup_failed";
      return json({error},created.status,headers);
    }
    if(!payload.access_token) return json({confirmation_required:true},200,headers);
    return json({access_token:payload.access_token,refresh_token:payload.refresh_token,expires_at:payload.expires_at,
      user:{id:payload.user?.id,email:payload.user?.email}},200,headers);
  }

  if(action==="login"){
    const token=await fetch(url+"/auth/v1/token?grant_type=password",{
      method:"POST",
      headers:{apikey:anon,"Content-Type":"application/json"},
      body:JSON.stringify({email,password})
    });
    const payload=await token.json().catch(()=>({}));
    if(!token.ok) return json({error:payload.error_code==="email_not_confirmed"?"email_not_confirmed":"login_failed"},401,headers);
    return json({
      access_token:payload.access_token,
      refresh_token:payload.refresh_token,
      expires_in:payload.expires_in,
      expires_at:payload.expires_at,
      user:{id:payload.user?.id,email:payload.user?.email}
    },200,headers);
  }

  // Any valid Google PKCE session may sign in; users own their workspace through auth.uid().
  if(action==="pkce"){
    const authCode=String(body?.auth_code||"");const verifier=String(body?.code_verifier||"");
    if(!authCode||!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return json({error:"pkce_required"},400,headers);
    const token=await fetch(url+"/auth/v1/token?grant_type=pkce",{
      method:"POST",
      headers:{apikey:anon,"Content-Type":"application/json"},
      body:JSON.stringify({auth_code:authCode,code_verifier:verifier})
    });
    const payload=await token.json().catch(()=>({}));
    if(!token.ok) return json({error:"oauth_failed"},401,headers);
    const user=payload.user||{};
    return json({
      access_token:payload.access_token,
      refresh_token:payload.refresh_token,
      expires_in:payload.expires_in,
      expires_at:payload.expires_at,
      user:{id:user.id,email:user.email}
    },200,headers);
  }

  if(action==="refresh"){
    const refreshToken=String(body?.refresh_token||"");
    if(!refreshToken) return json({error:"refresh_token_required"},400,headers);
    const token=await fetch(url+"/auth/v1/token?grant_type=refresh_token",{
      method:"POST",
      headers:{apikey:anon,"Content-Type":"application/json"},
      body:JSON.stringify({refresh_token:refreshToken})
    });
    const payload=await token.json().catch(()=>({}));
    if(!token.ok) return json({error:"refresh_failed"},401,headers);
    return json({
      access_token:payload.access_token,
      refresh_token:payload.refresh_token,
      expires_in:payload.expires_in,
      expires_at:payload.expires_at,
      user:{id:payload.user?.id,email:payload.user?.email}
    },200,headers);
  }

  return json({error:"unknown_action"},400,headers);
});
