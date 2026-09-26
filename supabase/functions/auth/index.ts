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
  return Response.json(data,{status,headers});
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
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service) return json({error:"server_not_configured"},500,headers);

  if(action==="signup"){
    const setupCheck=await fetch(url+"/rest/v1/rpc/check_account_setup_code",{
      method:"POST",
      headers:{apikey:service,Authorization:"Bearer "+service,"Content-Type":"application/json"},
      body:JSON.stringify({p_code:String(body?.setup_code||"")})
    });
    if(!setupCheck.ok || await setupCheck.json()!==true) return json({error:"invalid_setup_code"},403,headers);
    if(!email || password.length<8) return json({error:"email_and_password_required"},400,headers);

    const list=await fetch(url+"/auth/v1/admin/users?page=1&per_page=1",{
      headers:{apikey:service,Authorization:"Bearer "+service}
    });
    if(!list.ok) return json({error:"admin_user_check_failed"},502,headers);
    const listed=await list.json();
    if(Array.isArray(listed?.users) && listed.users.length>0) {
      return json({error:"signup_closed"},409,headers);
    }

    const created=await fetch(url+"/auth/v1/admin/users",{
      method:"POST",
      headers:{
        apikey:service,
        Authorization:"Bearer "+service,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({email,password,email_confirm:true})
    });
    const createdBody=await created.json().catch(()=>({}));
    if(!created.ok) return json({error:"signup_failed",detail:createdBody},created.status,headers);
  }

  if(action==="signup" || action==="login"){
    const token=await fetch(url+"/auth/v1/token?grant_type=password",{
      method:"POST",
      headers:{apikey:anon,"Content-Type":"application/json"},
      body:JSON.stringify({email,password})
    });
    const payload=await token.json().catch(()=>({}));
    if(!token.ok) return json({error:"login_failed",detail:payload},401,headers);
    return json({
      access_token:payload.access_token,
      refresh_token:payload.refresh_token,
      expires_in:payload.expires_in,
      expires_at:payload.expires_at,
      user:{id:payload.user?.id,email:payload.user?.email}
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