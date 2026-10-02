import type { LeaderRow } from '../types'
import { ETF_HEAT_PERIODS, type EtfHeatPeriod } from './etfIndustries'

// RS-CHART-2 (display only): line charts with x = period (5D…52W) and y = % from already loaded rows.
// No request, no new metric: each point is a stored RS band / return or a median of them; missing values break the line.
export const RS_CHART_VERSION='RS-CHART-2'
export const RS_CHART_PERIODS=ETF_HEAT_PERIODS
export type RsChartPeriod=EtfHeatPeriod
export type ChartKind='rs'|'return'
export type LineSeries={key:string;label:string;sub?:string;values:(number|null)[];n?:number;highlight?:boolean}

const PERIODS=ETF_HEAT_PERIODS.map(([p])=>p)
const RS_FIELD=Object.fromEntries(ETF_HEAT_PERIODS) as Record<RsChartPeriod,typeof ETF_HEAT_PERIODS[number][1]>
const RETURN_FIELD:Record<RsChartPeriod,keyof LeaderRow>={'5D':'return_5d','20D':'return_20d','50D':'return_50d','120D':'return_120d','200D':'return_200d','52W':'return_12m'}

const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null
export const rsValue=(row:LeaderRow,period:RsChartPeriod)=>num(row[RS_FIELD[period]])
export const periodValue=(row:LeaderRow,period:RsChartPeriod,kind:ChartKind)=>kind==='rs'?rsValue(row,period):num(row[RETURN_FIELD[period]])
export const seriesOf=(row:LeaderRow,kind:ChartKind)=>PERIODS.map(p=>periodValue(row,p,kind))

export const medianOf=(values:number[]):number|null=>{
  if(!values.length)return null
  const s=values.slice().sort((a,b)=>a-b),mid=s.length>>1
  return s.length%2?s[mid]:(s[mid-1]+s[mid])/2
}
const medianSeries=(rows:LeaderRow[],kind:ChartKind)=>PERIODS.map(p=>medianOf(rows.map(r=>periodValue(r,p,kind)).filter((v):v is number=>v!=null)))

// Top rows by RS for the ranking period; rows without a value are counted, not ranked.
export function topByRs(rows:LeaderRow[],period:RsChartPeriod,limit:number){
  const valued=rows.map(row=>({row,value:rsValue(row,period)})).filter((x):x is {row:LeaderRow;value:number}=>x.value!=null)
  valued.sort((a,b)=>b.value-a.value||(b.row.rs_rank??b.row.etf_rs_rank??0)-(a.row.rs_rank??a.row.etf_rs_rank??0)||a.row.ticker.localeCompare(b.row.ticker))
  return {items:valued.slice(0,limit),missing:rows.length-valued.length}
}

// Median RS series per group (e.g. sector).
export function groupSeries(rows:LeaderRow[],keyOf:(row:LeaderRow)=>string){
  const groups=new Map<string,LeaderRow[]>()
  for(const row of rows){const key=keyOf(row);const list=groups.get(key)??[];list.push(row);groups.set(key,list)}
  return new Map([...groups].map(([key,list])=>[key,{values:medianSeries(list,'rs'),n:list.length,first:list[0]}]))
}

// Stock detail: the row against same-market, same-asset-class peers (industry, sector for equities, market).
export function peerSeries(row:LeaderRow,all:LeaderRow[],kind:ChartKind):LineSeries[]{
  const peers=all.filter(r=>r.market===row.market&&r.asset_class===row.asset_class)
  const unit=row.asset_class==='ETF'?'ETF':'주식'
  const out:LineSeries[]=[{key:'self',label:row.asset_class==='ETF'?'이 ETF':'이 종목',values:seriesOf(row,kind),highlight:true}]
  const add=(key:string,label:string,list:LeaderRow[])=>out.push({key,label,sub:`${unit} ${list.length}`,values:medianSeries(list,kind),n:list.length})
  if(row.industry)add('industry','산업 중앙값',peers.filter(r=>r.industry===row.industry))
  if(row.asset_class!=='ETF'&&row.sector)add('sector','섹터 중앙값',peers.filter(r=>r.sector===row.sector))
  add('market',`${row.market} 중앙값`,peers)
  return out
}

// Y axis: zero always included, ≤6 ticks on a 1-2-5 step.
export function yScale(series:LineSeries[]){
  const vals=series.flatMap(s=>s.values).filter((v):v is number=>v!=null)
  let lo=Math.min(0,...vals),hi=Math.max(0,...vals)
  if(hi-lo<1e-9){lo-=.01;hi+=.01}
  const step=[.005,.01,.02,.05,.1,.2,.5,1,2,5].find(s=>(hi-lo)/s<=5)??10
  lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step
  const ticks:number[]=[];for(let v=lo;v<=hi+step/2;v+=step)ticks.push(Math.round(v/step)*step)
  return {lo,hi,ticks,digits:step<.01?1:0}
}
