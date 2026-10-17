const origins=new Set(['https://automata49.github.io','http://localhost:5173','http://127.0.0.1:5173'])
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||''
 const headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://automata49.github.io','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Vary':'Origin'}
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return json({error:'method_not_allowed'},405)
 if(origin&&!origins.has(origin))return json({error:'origin_denied'},403)
 const auth=req.headers.get('authorization')||''
 if(!auth.startsWith('Bearer '))return json({error:'login_required'},401)
 const supa=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY')
 if(!supa||!anon)return json({error:'server_unconfigured'},503)
 const user=await fetch(supa+'/auth/v1/user',{headers:{Authorization:auth,apikey:anon}}).catch(()=>null)
 if(!user?.ok)return json({error:'invalid_session'},401)
 const apiKey=Deno.env.get('GEMINI_API_KEY')||Deno.env.get('GOOGLE_AI_API_KEY')
 if(!apiKey)return json({error:'model_unconfigured'},503)
 let input:unknown
 try{input=await req.json()}catch{return json({error:'invalid_json'},400)}
 const value=input as {context?:unknown;messages?:unknown}
 if(typeof value.context!=='string'||value.context.length>10000||!Array.isArray(value.messages)||value.messages.length>12)return json({error:'invalid_request'},400)
 const messages=value.messages as Array<{role?:unknown;content?:unknown}>
 if(!messages.length||messages.some(m=>!m||!['user','assistant'].includes(String(m.role))||typeof m.content!=='string'||!m.content.trim()||m.content.length>2000))return json({error:'invalid_messages'},400)
 const contents=messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:String(m.content)}]}))
 const prompt='You are an investing journal thinking partner. Respond in Korean, concisely. Distinguish facts from hypotheses, challenge assumptions, note missing financial data and uncertainty, never pretend to have live data. Never place trades or change the journal. User-owned context, not verified market evidence:\n'+value.context
 try{
  const result=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({systemInstruction:{parts:[{text:prompt}]},contents,generationConfig:{temperature:0.4,maxOutputTokens:900}})})
  if(!result.ok)return json({error:result.status===429?'rate_limited':'model_unavailable'},result.status===429?429:502)
  const response=await result.json()
  const reply=response.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text||'').join('').trim()
  return reply?json({reply:reply.slice(0,6000)}):json({error:'empty_response'},502)
 }catch{return json({error:'model_unavailable'},502)}
})
