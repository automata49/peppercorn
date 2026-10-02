import type { LeaderRow } from '../types'
import { ETF_HEAT_PERIODS, type EtfHeatPeriod } from './etfIndustries'

// RS-CHART-1 (display only): benchmark-relative RS for one period, drawn as bars from already loaded rows.
// No request, no new metric: each bar is a stored RS band or a median of them; missing values stay out.
export const RS_CHART_VERSION='RS-CHART-1'
export const RS_CHART_PERIODS=ETF_HEAT_PERIODS
export type RsChartPeriod=EtfHeatPeriod
export type RsBar={key:string;label:string;sub?:string;value:number|null;n?:number;highlight?:boolean}

const FIELD=Object.fromEntries(ETF_HEAT_PERIODS) as Record<RsChartPeriod,typeof ETF_HEAT_PERIODS[number][1]>

export const rsValue=(row:LeaderRow,period:RsChartPeriod):number|null=>{
  const v=row[FIELD[period]]
  return typeof v==='number'&&Number.isFinite(v)?v:null
}

export const medianOf=(values:number[]):number|null=>{
  if(!values.length)return null
  const s=values.slice().sort((a,b)=>a-b),mid=s.length>>1
  return s.length%2?s[mid]:(s[mid-1]+s[mid])/2
}

// Top rows by RS for the period; rows without a value are counted, not ranked.
export function topByRs(rows:LeaderRow[],period:RsChartPeriod,limit:number){
  const valued=rows.map(row=>({row,value:rsValue(row,period)})).filter((x):x is {row:LeaderRow;value:number}=>x.value!=null)
  valued.sort((a,b)=>b.value-a.value||(b.row.rs_rank??b.row.etf_rs_rank??0)-(a.row.rs_rank??a.row.etf_rs_rank??0)||a.row.ticker.localeCompare(b.row.ticker))
  return {items:valued.slice(0,limit),missing:rows.length-valued.length}
}

// Median RS per group (e.g. sector); groups whose members all lack the period's RS are counted as missing.
export function groupMedians(rows:LeaderRow[],period:RsChartPeriod,keyOf:(row:LeaderRow)=>string){
  const groups=new Map<string,number[]>()
  for(const row of rows){
    const key=keyOf(row),list=groups.get(key)??[]
    const v=rsValue(row,period);if(v!=null)list.push(v)
    groups.set(key,list)
  }
  return new Map([...groups].map(([key,values])=>[key,{value:medianOf(values),n:values.length}]))
}

// Stock detail: the row against same-market, same-asset-class peers (industry, sector for equities, market).
export function peerComparison(row:LeaderRow,all:LeaderRow[],period:RsChartPeriod):RsBar[]{
  const peers=all.filter(r=>r.market===row.market&&r.asset_class===row.asset_class)
  const kind=row.asset_class==='ETF'?'ETF':'주식'
  const med=(list:LeaderRow[])=>{const values=list.map(r=>rsValue(r,period)).filter((v):v is number=>v!=null);return {value:medianOf(values),n:values.length}}
  const bars:RsBar[]=[{key:'self',label:row.asset_class==='ETF'?'이 ETF':'이 종목',sub:row.ticker,value:rsValue(row,period),highlight:true}]
  if(row.industry){const m=med(peers.filter(r=>r.industry===row.industry));bars.push({key:'industry',label:'산업 중앙값',sub:`${row.industry} · ${kind} ${m.n}`,...m})}
  if(row.asset_class!=='ETF'&&row.sector){const m=med(peers.filter(r=>r.sector===row.sector));bars.push({key:'sector',label:'섹터 중앙값',sub:`${kind} ${m.n}`,...m})}
  const m=med(peers);bars.push({key:'market',label:`${row.market} 중앙값`,sub:`${kind} ${m.n}`,...m})
  return bars
}
