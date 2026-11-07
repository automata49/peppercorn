import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as jose from "jsr:@panva/jose@6";

const GITHUB_JWKS=jose.createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
async function githubAuthorized(req:Request){
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return false;
  try{
    const {payload}=await jose.jwtVerify(auth.slice(7),GITHUB_JWKS,{issuer:"https://token.actions.githubusercontent.com",audience:"peppercorn-supabase"});
    return payload.repository==="automata49/peppercorn" && payload.ref==="refs/heads/main";
  }catch{return false}
}

import {symbol, metrics, type Instrument} from "../_shared/market-metrics.ts";

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return Response.json({error:"method_not_allowed"},{status:405});
  let body:any;try{body=await req.json()}catch{return Response.json({error:"invalid_json"},{status:400})}

  const base=Deno.env.get("SUPABASE_URL");
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!base||!secret)return Response.json({error:"server_not_configured"},{status:500});
  const dbHeaders={apikey:secret,Authorization:"Bearer "+secret,"Content-Type":"application/json"};

  let isAuthorized=await githubAuthorized(req);
  if(!isAuthorized && body?.token){
    const auth=await fetch(base+"/rest/v1/rpc/check_refresh_token",{
      method:"POST",headers:dbHeaders,body:JSON.stringify({p_token:String(body.token)})
    });
    isAuthorized=auth.ok && await auth.json()===true;
  }
  if(!isAuthorized)return Response.json({error:"unauthorized"},{status:401});

  const offset=Math.max(0,Number(body?.offset||0));
  const limit=Math.min(120,Math.max(1,Number(body?.limit||80)));
  const market=body?.market??"ALL";
  if(market!=="ALL" && market!=="KR" && market!=="US")return Response.json({error:"invalid_market"},{status:400});

  const q=new URL(base+"/rest/v1/instruments");
  q.searchParams.set("select","id,market,ticker,exchange");
  q.searchParams.set("active","eq.true");
  if(market!=="ALL")q.searchParams.set("market","eq."+market);
  q.searchParams.set("order","market.asc,ticker.asc");
  q.searchParams.set("offset",String(offset));
  q.searchParams.set("limit",String(limit));
  const list=await fetch(q,{headers:dbHeaders});
  if(!list.ok)return Response.json({error:"instrument_read_failed",detail:await list.text()},{status:502});
  const instruments=await list.json() as Instrument[];

  const failed:string[]=[];let refreshed=0,priceRows=0;

  const one=async(inst:Instrument)=>{
    const sym=symbol(inst);
    try{
      const y=new URL("https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(sym));
      y.searchParams.set("range","18mo");y.searchParams.set("interval","1d");y.searchParams.set("events","history");
      const yr=await fetch(y,{headers:{"User-Agent":"Mozilla/5.0 PeppercornCapital/1.0"}});
      if(!yr.ok)throw new Error("yahoo_"+yr.status);
      const payload=await yr.json();
      const result=payload?.chart?.result?.[0];
      const ts=result?.timestamp||[];
      const quote=result?.indicators?.quote?.[0];
      if(!quote||!ts.length)throw new Error("no_data");
      const rows=ts.map((t:number,idx:number)=>({
        date:new Date(t*1000).toISOString().slice(0,10),
        open:quote.open?.[idx]??null,high:quote.high?.[idx]??null,low:quote.low?.[idx]??null,
        close:quote.close?.[idx]??null,volume:quote.volume?.[idx]??null
      })).filter((r:any)=>r.close!=null);
      const m=metrics(rows);if(!m)throw new Error("insufficient_data");

      const prices=rows.map((r:any)=>({instrument_id:inst.id,trade_date:r.date,open:r.open,high:r.high,low:r.low,close:r.close,volume:r.volume}));
      for(let i=0;i<prices.length;i+=400){
        const pr=await fetch(base+"/rest/v1/price_daily?on_conflict=instrument_id,trade_date",{
          method:"POST",headers:{...dbHeaders,Prefer:"resolution=merge-duplicates,return=minimal"},
          body:JSON.stringify(prices.slice(i,i+400))
        });
        if(!pr.ok)throw new Error("price_upsert_"+pr.status+"_"+await pr.text());
      }

      const metric={instrument_id:inst.id,...m};
      const mr=await fetch(base+"/rest/v1/market_metrics?on_conflict=instrument_id,as_of",{
        method:"POST",headers:{...dbHeaders,Prefer:"resolution=merge-duplicates,return=minimal"},
        body:JSON.stringify(metric)
      });
      if(!mr.ok)throw new Error("metric_upsert_"+mr.status+"_"+await mr.text());
      refreshed++;priceRows+=prices.length;
    }catch(e){failed.push(sym+":"+String(e))}
  };

  for(let i=0;i<instruments.length;i+=10){
    await Promise.all(instruments.slice(i,i+10).map(one));
  }
  return Response.json({ok:true,offset,limit,requested:instruments.length,refreshed,price_rows:priceRows,failed:failed.slice(0,30)});
});
