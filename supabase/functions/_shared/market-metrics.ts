// Shared unchanged daily-bar calculations for Edge and scheduled runners.
export type Instrument={id:string;market:"US"|"KR";ticker:string;exchange?:string|null};

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
const YAHOO_US_ALIASES:Record<string,string>={"BFB":"BF-B","BRKB":"BRK-B"};
export function symbol(i:Instrument){
  if(i.market!=="KR")return YAHOO_US_ALIASES[i.ticker]||i.ticker.replaceAll(".","-");
  return i.ticker+(((i.exchange||"").toUpperCase().includes("KOSDAQ"))?".KQ":".KS");
}
function safe(n:number|null){return n==null||!Number.isFinite(n)?null:n}

export function metrics(rows:any[]){
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
    return_5d:safe(ret(c,5)),return_20d:safe(ret(c,20)),return_50d:safe(ret(c,50)),return_120d:safe(ret(c,120)),return_200d:safe(ret(c,200)),
    volume_ratio:safe(vol20&&vol20>0?v.at(-1)!/vol20:null),adr20_pct:safe(adr),rsi14:safe(calcRsi(c)),
    atr20_pct:safe(atr&&price?atr/price:null),high_52w_distance:safe(hi?price/hi-1:null),
    atr_multiple:safe(atr&&ma50?Math.abs(price-ma50)/atr:null),data_days:valid.length
  }
}

