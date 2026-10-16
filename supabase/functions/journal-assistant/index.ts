import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const origins=new Set(["https://automata49.github.io","http://localhost:5173","http://127.0.0.1:5173"]);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin'),headers={'Access-Control-Allow-Origin':origin&&origins.has(origin)?origin:'https://automata49.github.io','Access-Control-Allow-Headers':'authorization,content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers})
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(origin&&!origins.has(origin))return json({error:'origin_not_allowed'},403)
 if(req.method!=='POST')return json({error:'method_not_allowed'},405)
 const authorization=req.headers.get('authorization')||'',token=authorization.startsWith('Bearer ')?authorization.slice(7):''
 if(!token)return json({error:'missing_auth'},401)
 const url=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||''
 const user=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,Authorization:authorization}}).catch(()=>null)
 if(!user?.ok)return json({error:'invalid_auth'},401)
 const key=Deno.env.get('GEMINI_API_KEY')
 if(!key)return json({error:'ai_not_configured'},503)
 const raw=await req.text();if(raw.length>20000)return json({error:'request_too_large'},413)
 let payload:any;try{payload=JSON.parse(raw)}catch{return json({error:'invalid_json'},400)}
 if(!Array.isArray(payload.messages)||payload.messages.length<1||payload.messages.length>20||typeof payload.context!=='string'||payload.context.length>5000)return json({error:'invalid_input'},400)
 const turns=payload.messages.slice(-12)
 if(turns.some((m:any)=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>2400)||turns.at(-1).role!=='user')return json({error:'invalid_messages'},400)
 const model=Deno.env.get('GEMINI_MODEL')||'gemini-2.5-flash'
 const body={systemInstruction:{parts:[{text:'You are a critical investment research thought partner in a private personal journal. Respond in Korean. Treat supplied notes as unverified user context, do not invent financial facts or imply access to unseen data. Ask for missing evidence and distinguish fact from hypothesis. Do not place trades or guarantee returns. Journal context:\n'+payload.context}]},contents:turns.map((m:any)=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:{maxOutputTokens:850,temperature:0.3}}
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).catch(()=>null)
 if(!response)return json({error:'ai_unreachable'},502)
 if(!response.ok)return json({error:response.status===429?'ai_rate_limit':'ai_service_failed'},response.status===429?429:502)
 const result=await response.json().catch(()=>({}))
 const reply=(result.candidates?.[0]?.content?.parts||[]).map((p:any)=>typeof p.text==='string'?p.text:'').join('\n').trim()
 if(!reply)return json({error:'ai_empty'},502)
 return json({reply:reply.slice(0,2400)})
});
