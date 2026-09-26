import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Instrument={id:string;market:"US"|"KR";ticker:string;exchange?:string|null};

function mean(a:number[]){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function tail<T>(a:T[],n:number){return a.slice(Math.max(0,a.length-n))}
function ret(c:number[],n:number){return c.length>n?c[c.length-1]/c[c.length-1-n]-1:null}
function calcRsi(c:number[],n=14){
  if(c.length<n+1)return null;
  let gain=0,loss=0;
  for(let i=1;i<=n;i++){const d=c[i]-c[i-1];if(d>=0)gain+=d;else loss-=d}
  gain/=n;loss/=n;
  for(let i=n+1;i<c.length;i++){const d=c[i]-c[i-1];gain=(gain*(n-1)+Math.max(d,0))/n;loss=(loss*(n-1)+Math.max(-d,0))/n}
  if(loss===0)return 100;
  const rs=gain/loss;return 100-100/(1+rs)
}
function symbol(i:Instrument){
  if(i.market!=="KR")return i.ticker;
  return i.ticker+(((i.exchange||"").toUpperCase().includes("KOSDAQ"))?".KQ":".KS");
}
function safe(n:number|null){return n==null||!Number.isFinite(n)?null:n}

function metrics(rows:any[]){
  const valid=rows.filter(r=>r.close!=null&&Number.isFinite(r.close));
  if(valid.length<22)return null;
  const c=valid.map(r=>Number(r.close));
  const h=valid.map(r=>Number(r.high??r.close));
  const l=valid.map(r=>Number(r.low??r.close));
  const v=valid.map(r=>Number(r.volume??0));
  const price=c.at(-1)!;
  const ma50=c.length>=50?mean(tail(c,50)):null;
  const ma200=c.length>=200?mean(tail(c,200)):null;
  const hi=Math.max(...tail(h,Math.min(252,h.length)));
  const lo=Math.min(...tail(l,Math.min(252,l.length)));
  const tr:number[]=[];
  for(let i=0;i<valid.length;i++){
    const prev=i?c[i-1]:c[i];
    tr.push(Math.max(Math.abs(h[i]-l[i]),Math.abs(h[i]-prev),Math.abs(l[i]-prev)))
  }
  const atr=c.length>=20?mean(tail(tr,20)):null;
  const adr=c.length>=20?mean(tail(valid,20).map((r:any)=>Math.abs(Number(r.high??r.close)-Number(r.low??r.close))/Number(r.close))):null;
  const vol20=c.length>=20?mean(tail(v,20)):null;
  return {
    as_of:valid.at(-1)!.date,
    price:safe(price),ma50:safe(ma50),ma200:safe(ma200),high_52w:safe(hi),low_52w:safe(lo),
    return_1w:safe(ret(c,5)),return_1m:safe(ret(c,21)),return_3m:safe(ret(c,63)),return_6m:safe(ret(c,126)),return_12m:safe(ret(c,252)),
    volume_ratio:safe(vol20&&vol20>0?v.at(-1)!/vol20:null),adr20_pct:safe(adr),rsi14:safe(calcRsi(c)),
    atr20_pct:safe(atr&&price?atr/price:null),high_52w_distance:safe(hi?price/hi-1:null),
    atr_multiple:safe(atr&&ma50?Math.abs(price-ma50)/atr:null),data_days:valid.length
  }
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return Response.json({error:"method_not_allowed"},{status:405});
  let body:any;try{body=await req.json()}catch{return Response.json({error:"invalid_json"},{status:400})}

  const base=Deno.env.get("SUPABASE_URL");
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!base||!secret)return Response.json({error:"server_not_configured"},{status:500});
  const dbHeaders={apikey:secret,Authorization:"Bearer "+secret,"Content-Type":"application/json"};

  const auth=await fetch(base+"/rest/v1/rpc/check_refresh_token",{
    method:"POST",headers:dbHeaders,body:JSON.stringify({p_token:String(body?.token||"")})
  });
  if(!auth.ok || await auth.json()!==true)return Response.json({error:"unauthorized"},{status:401});

  const offset=Math.max(0,Number(body?.offset||0));
  const limit=Math.min(120,Math.max(1,Number(body?.limit||80)));

  const q=new URL(base+"/rest/v1/instruments");
  q.searchParams.set("select","id,market,ticker,exchange");
  q.searchParams.set("active","eq.true");
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