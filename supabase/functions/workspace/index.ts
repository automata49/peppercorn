import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins=new Set(["https://automata49.github.io","http://localhost:5173","http://127.0.0.1:5173"]);
function cors(origin:string|null){const allow=origin&&allowedOrigins.has(origin)?origin:"https://automata49.github.io";return{"Access-Control-Allow-Origin":allow,"Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Vary":"Origin"}}
function json(data:unknown,status:number,headers:Record<string,string>){return Response.json(data,{status,headers})}
function decodeSub(auth:string){const token=auth.replace(/^Bearer\s+/i,"");const part=token.split(".")[1]||"";const normalized=part.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(part.length/4)*4,"=");return JSON.parse(atob(normalized)).sub as string}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin");const headers=cors(origin);if(req.method==="OPTIONS")return new Response(null,{status:204,headers});if(origin&&!allowedOrigins.has(origin))return json({error:"origin_not_allowed"},403,headers);
  const auth=req.headers.get("authorization")||"";if(!auth.startsWith("Bearer "))return json({error:"missing_auth"},401,headers);let uid:string;try{uid=decodeSub(auth)}catch{return json({error:"invalid_auth"},401,headers)}
  const url=Deno.env.get("SUPABASE_URL");const anon=Deno.env.get("SUPABASE_ANON_KEY");if(!url||!anon)return json({error:"server_not_configured"},500,headers);
  const baseHeaders={apikey:anon,Authorization:auth,"Content-Type":"application/json"};
  const rest=async(path:string,init:RequestInit={})=>{const r=await fetch(url+"/rest/v1/"+path,{...init,headers:{...baseHeaders,...(init.headers||{})}});const text=await r.text();let data:any=null;if(text){try{data=JSON.parse(text)}catch{data=text}}if(!r.ok)throw new Error(JSON.stringify({status:r.status,data}));return data};
  const reqUrl=new URL(req.url);const resource=reqUrl.searchParams.get("resource")||"";

  if(req.method==="GET"){
    try{
      if(resource==="watchlist")return json({rows:await rest("watchlist_view?user_id=eq."+uid+"&select=*&order=priority.asc,updated_at.desc")},200,headers);
      if(resource==="portfolio")return json({rows:await rest("portfolio_view?user_id=eq."+uid+"&select=*&order=updated_at.desc")},200,headers);
      if(resource==="research")return json({rows:await rest("research_notes?user_id=eq."+uid+"&select=*&order=written_at.desc,created_at.desc")},200,headers);
      if(resource==="analysis")return json({rows:await rest("stock_analysis_view?user_id=eq."+uid+"&select=*&order=analysis_date.desc,created_at.desc")},200,headers);
      if(resource==="journal")return json({rows:await rest("trade_journal_view?user_id=eq."+uid+"&select=*&order=trade_date.desc,created_at.desc")},200,headers);
      return json({error:"unknown_resource"},400,headers);
    }catch(e){return json({error:"read_failed",detail:String(e)},502,headers)}
  }

  if(req.method==="POST"){
    let body:any;try{body=await req.json()}catch{return json({error:"invalid_json"},400,headers)}const rows=Array.isArray(body?.rows)?body.rows:[];
    try{
      const instruments=await rest("instruments?select=id,market,ticker,name&active=eq.true&limit=2000");const byKey=new Map<string,any>();const byTicker=new Map<string,any[]>();
      for(const i of instruments){byKey.set(String(i.market)+"|"+String(i.ticker),i);const t=String(i.ticker);const list=byTicker.get(t)||[];list.push(i);byTicker.set(t,list)}
      const resolve=(r:any)=>{let inst=null;if(r.market&&r.ticker)inst=byKey.get(String(r.market)+"|"+String(r.ticker));if(!inst&&r.ticker){const list=byTicker.get(String(r.ticker))||[];if(list.length===1)inst=list[0]}return inst};

      if(resource==="watchlist"){
        await rest("watchlist?user_id=eq."+uid,{method:"DELETE"});const payload=rows.map((r:any)=>{const inst=resolve(r);if(!inst)return null;return{user_id:uid,instrument_id:inst.id,interest_price:r.interest_price===""?null:r.interest_price,stop_pct:r.stop_pct===""?null:r.stop_pct,priority:r.priority||null,note:r.note||null,status:r.status||"WATCH"}}).filter(Boolean);
        if(payload.length)await rest("watchlist",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(payload)});return json({ok:true,count:payload.length},200,headers);
      }
      if(resource==="portfolio"){
        await rest("portfolio_positions?user_id=eq."+uid,{method:"DELETE"});const payload=rows.map((r:any)=>{const inst=resolve(r);if(!inst)return null;return{user_id:uid,instrument_id:inst.id,account:r.account||null,shares:r.shares===""?0:Number(r.shares||0),avg_price:r.avg_price===""?null:r.avg_price,currency:r.currency||null,target_price:r.target_price===""?null:r.target_price,stop_price:r.stop_price===""?null:r.stop_price,thesis:r.thesis||null,status:r.status||"OPEN",opened_at:r.opened_at||null}}).filter(Boolean);
        if(payload.length)await rest("portfolio_positions",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(payload)});return json({ok:true,count:payload.length},200,headers);
      }
      if(resource==="research"){
        await rest("research_notes?user_id=eq."+uid,{method:"DELETE"});const payload=rows.map((r:any)=>({user_id:uid,written_at:r.date||r.written_at||new Date().toISOString().slice(0,10),note_type:r.type||r.note_type||null,target:r.target||null,title:r.title||null,fact:r.fact||null,interpretation:r.interpretation||null,source:r.source||null,source_type:r.source_type||null,verification:r.verification||null,verified:r.verification==="확인됨"?true:r.verification==="반박됨"?false:(r.verified??null),market_impact:r.market_impact||null,related_assets:r.related_assets||null,importance:r.importance===""?null:r.importance,next_review_date:r.next_review_date||null,status:r.status||null,journal_no:r.journal_no||null}));
        if(payload.length)await rest("research_notes",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(payload)});return json({ok:true,count:payload.length},200,headers);
      }
      if(resource==="analysis"){
        await rest("stock_analyses?user_id=eq."+uid,{method:"DELETE"});const payload=rows.map((r:any)=>{const inst=resolve(r);if(!inst)return null;return{user_id:uid,instrument_id:inst.id,analysis_date:r.date||r.analysis_date||new Date().toISOString().slice(0,10),lynch_category:r.lynch_category||null,eps_growth_q:r.eps_growth_q===""?null:r.eps_growth_q,sales_growth_q:r.sales_growth_q===""?null:r.sales_growth_q,eps_growth_3y:r.eps_growth_3y===""?null:r.eps_growth_3y,roe:r.roe===""?null:r.roe,operating_margin:r.operating_margin===""?null:r.operating_margin,debt_ratio:r.debt_ratio===""?null:r.debt_ratio,operating_cashflow_positive:r.operating_cashflow_positive===""?null:(r.operating_cashflow_positive==="양수"?true:r.operating_cashflow_positive==="음수"?false:r.operating_cashflow_positive),pe:r.pe===""?null:r.pe,peg:r.peg===""?null:r.peg,moat:r.moat||null,growth_driver:r.growth_driver||null,key_risk:r.key_risk||null,auto_grade:r.auto_grade||null,conclusion:r.conclusion||null,research_note_no:r.research_note_no||null,journal_no:r.journal_no||null}}).filter(Boolean);
        if(payload.length)await rest("stock_analyses",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(payload)});return json({ok:true,count:payload.length},200,headers);
      }
      if(resource==="journal"){
        await rest("trade_journal?user_id=eq."+uid,{method:"DELETE"});const payload=rows.map((r:any)=>{const inst=resolve(r);return{user_id:uid,instrument_id:inst?.id||null,trade_date:r.date||r.trade_date||new Date().toISOString().slice(0,10),account:r.account||null,tranche:r.tranche||null,buy_price:r.buy_price===""?null:r.buy_price,currency:r.currency||null,thesis:r.thesis||null,evidence_type:r.evidence_type||null,confidence:r.confidence===""?null:r.confidence,target_price:r.target_price===""?null:r.target_price,stop_price:r.stop_price===""?null:r.stop_price,review_condition:r.review_condition||null,review_date:r.review_date||null,status:r.status||null,exit_date:r.exit_date||null,sell_price:r.sell_price===""?null:r.sell_price,realized_return:r.realized_return===""?null:r.realized_return,thesis_hit:r.thesis_hit||null,review_note:r.review_note||null,lesson:r.lesson||null}});
        if(payload.length)await rest("trade_journal",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(payload)});return json({ok:true,count:payload.length},200,headers);
      }
      return json({error:"unknown_resource"},400,headers);
    }catch(e){return json({error:"write_failed",detail:String(e)},502,headers)}
  }
  return json({error:"method_not_allowed"},405,headers);
});
