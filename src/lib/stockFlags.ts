import { useEffect, useState } from 'react'
import type { LeaderRow } from '../types'

// STOCK-FLAGS-1 (display): warning badges published with each Pages deployment by analysis/stock_flags.py
// (data/stock-flags.json). Filed annual results: loss, no revenue, shrinking revenue; daily closes: one-day jump.
// Only true flags are in the file; a missing file or stock shows no badge (unknown is never a warning).
// GROWTH-1 / SEPA-1 (analysis/stock_flags.py): latest quarter vs a year earlier (revenue, diluted EPS; KR net income),
// published only at or above +20 % / +25 %, and the Minervini SEPA screen (8 Trend Template conditions + both growth
// thresholds). Positive badges; like the warnings they never change a classification.
export type StockFlag={loss?:boolean;no_revenue?:boolean;shrinking?:boolean;revenue_growth?:number;jump?:{top_day:number;share:number;window_return:number};growth?:{rev?:number;eps?:number};sepa?:boolean}
export type FlagFile={version:string;generated_at:string;flags:Record<string,StockFlag>;growth_period?:Record<string,string>}

let cache:FlagFile|null=null
let pending:Promise<FlagFile|null>|null=null
const listeners=new Set<(f:FlagFile|null)=>void>()
export function loadStockFlags(){
  if(cache)return Promise.resolve(cache)
  pending??=fetch('./data/stock-flags.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then((f:FlagFile|null)=>{
    cache=f&&f.flags&&typeof f.flags==='object'?f:null;listeners.forEach(l=>l(cache));return cache
  }).catch(()=>null)
  return pending
}
export function useStockFlags(){
  const [file,setFile]=useState<FlagFile|null>(cache)
  useEffect(()=>{listeners.add(setFile);void loadStockFlags();return()=>{listeners.delete(setFile)}},[])
  return file
}
const pct=(x:number)=>(x>0?'+':'')+(x*100).toFixed(0)+'%'
export function flagBadges(f:StockFlag|undefined,period?:string):{key:string;label:string;title:string}[]{
  if(!f)return []
  const out=[]
  const basis=period?` (${period}, 전년 동기 대비)`:' (최근 분기, 전년 동기 대비)'
  const g=f.growth
  const growthText=g?[g.rev!=null?`매출 ${pct(g.rev)}`:null,g.eps!=null?`이익 ${pct(g.eps)}`:null].filter(Boolean).join(' · '):''
  if(f.sepa)out.push({key:'sepa',label:'SEPA',title:`Minervini SEPA 조건 충족: Trend Template 8개 조건(MA50·150·200 정배열, MA200 상승, 52주 저점 +30% 이상, 고점 -25% 이내, RS순위 70 이상)과 분기 EPS +25%·매출 +20% 이상${basis}. ${growthText}. 표시용이며 분류에 쓰이지 않습니다.`})
  if(g?.rev!=null&&g.rev>=.2)out.push({key:'growth',label:`매출 ${pct(g.rev)}`,title:`최근 분기 매출 성장${basis}: ${growthText}. 미국은 희석 EPS, 한국은 순이익 기준. SEC·DART 공시.`})
  if(f.no_revenue)out.push({key:'no_revenue',label:'매출 없음',title:'최근 연간 매출이 없거나 미미합니다 (미국 $10M · 한국 100억원 미만, 또는 매출 항목 없이 적자 공시). SEC·DART 연간 공시 기준.'})
  if(f.loss&&!f.no_revenue)out.push({key:'loss',label:'적자',title:'최근 연간 순이익이 0보다 작습니다. SEC·DART 연간 공시 기준.'})
  if(f.shrinking)out.push({key:'shrinking',label:'매출 감소',title:'최근 연간 매출이 전년보다 줄었습니다'+(f.revenue_growth!=null?` (${pct(f.revenue_growth)})`:'')+'. SEC·DART 연간 공시 기준.'})
  if(f.jump)out.push({key:'jump',label:'급등일 의존',title:`최근 63거래일 상승의 대부분이 하루에 나왔습니다 (하루 ${pct(f.jump.top_day)}, 63일 ${pct(f.jump.window_return)}). 실적 발표·임상 결과 같은 단일 이벤트일 수 있습니다.`})
  return out
}
export const flagKey=(r:LeaderRow)=>r.market+':'+r.ticker
