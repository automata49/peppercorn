import type {LeaderRow,Market} from '../types'
export type StockSize='large'|'small'|'all'
export type SizeBasis='market_cap'|'traded_value_20d'|null
export const SIZE_TOP_SHARE=.10
export const CAP_COVERAGE_MIN=.90
export const STOCK_SIZE_STORAGE='folio-stock-size'
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0
export type MarketSize={basis:SizeBasis;total:number;valued:number;unknown:number;large:Set<string>;known:Set<string>}
export function stockSizes(rows:LeaderRow[]):Record<Market,MarketSize>{
 const out={} as Record<Market,MarketSize>
 for(const market of ['KR','US'] as const){
  const equities=rows.filter(r=>r.market===market&&r.asset_class==='Equity')
  const caps=equities.filter(r=>valid(r.market_cap))
  const traded=equities.filter(r=>valid(r.traded_value_20d))
  const basis:SizeBasis=equities.length&&caps.length/equities.length>=CAP_COVERAGE_MIN?'market_cap':traded.length?'traded_value_20d':null
  const valued=basis?equities.filter(r=>valid(r[basis])).sort((a,b)=>Number(b[basis])-Number(a[basis])||a.id.localeCompare(b.id)):[]
  const cutoff=valued.length?Number(valued[Math.ceil(valued.length*SIZE_TOP_SHARE)-1][basis!]):Infinity
  out[market]={basis,total:equities.length,valued:valued.length,unknown:equities.length-valued.length,known:new Set(valued.map(r=>r.id)),large:new Set(valued.filter(r=>Number(r[basis!])>=cutoff).map(r=>r.id))}
 }
 return out
}
export function filterStockSize(rows:LeaderRow[],size:StockSize,sizes:Record<Market,MarketSize>){
 return rows.filter(r=>r.asset_class==='Equity'&&(size==='all'||(sizes[r.market].known.has(r.id)&&(size==='large'?sizes[r.market].large.has(r.id):!sizes[r.market].large.has(r.id)))))
}
export function readStockSize():StockSize{
 try{const value=localStorage.getItem(STOCK_SIZE_STORAGE);return value==='all'||value==='small'?value:'large'}catch{return 'large'}
}
