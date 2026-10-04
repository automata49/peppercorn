import type { LeaderRow } from '../types'
import { groupOf } from './groupRank'
import type { StockFlag } from './stockFlags'

// LEADER-LENS-1 (display, by user decision 2026-10-03 after the IBD/Minervini benchmark): ways to read the daily
// leadership classes without changing them. Nothing here feeds classification, RS rank, stage or thresholds.

// BIGCAP-1 (IBD Big Cap 20 style): a large cap is an equity whose 20-session average trading value (VALUE-2) is in the
// top 10 % of its market. Large caps are ranked by RS rank among large caps only; a 대형 주도주 is a large cap with
// price > MA50 > MA200, within 25 % of its 52-week high and in the top 30 % of large caps by RS rank. A market without
// trading values has no large-cap list (unknown, never guessed).
export const BIGCAP={version:'BIGCAP-1',valueTopShare:.10,rsTopShare:.30,highDistanceMin:-.25}

export type BigCapRow=LeaderRow&{bigcap_rank:number;bigcap_total:number}
export function bigCapLeaders(rows:LeaderRow[]):{rows:BigCapRow[];markets:Record<string,{large:number;valued:number}>}{
  const out:BigCapRow[]=[]
  const markets:Record<string,{large:number;valued:number}>={}
  for(const market of ['US','KR']){
    const valued=rows.filter(r=>r.market===market&&r.asset_class==='Equity'&&r.traded_value_20d!=null&&Number.isFinite(r.traded_value_20d)&&r.traded_value_20d>0)
    if(!valued.length)continue
    const n=Math.max(1,Math.ceil(valued.length*BIGCAP.valueTopShare))
    const large=valued.slice().sort((a,b)=>(b.traded_value_20d as number)-(a.traded_value_20d as number)).slice(0,n)
    markets[market]={large:large.length,valued:valued.length}
    const ranked=large.filter(r=>r.rs_rank!=null).sort((a,b)=>(b.rs_rank as number)-(a.rs_rank as number)||a.ticker.localeCompare(b.ticker))
    const cut=Math.max(1,Math.ceil(ranked.length*BIGCAP.rsTopShare))
    ranked.forEach((r,i)=>{
      const trend=r.price!=null&&r.ma50!=null&&r.ma200!=null&&r.price>r.ma50&&r.ma50>r.ma200
      if(i<cut&&trend&&r.high_52w_distance!=null&&r.high_52w_distance>=BIGCAP.highDistanceMin)out.push({...r,bigcap_rank:i+1,bigcap_total:ranked.length})
    })
  }
  return {rows:out.sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0)),markets}
}

// Top-down view (IBD/Minervini: leading groups first, then the leaders inside them): the industry groups present in a
// list, ordered by GROUP-RANK-1 (unranked groups last), and the list ordered by group rank, then RS rank.
export type LeaderGroup={key:string;market:string;name:string;rank:number|null;total:number|null;rows:LeaderRow[]}
export const groupKey=(r:LeaderRow)=>r.market+'|'+(groupOf(r)||'—')
export function leaderGroups(rows:LeaderRow[]):LeaderGroup[]{
  const map=new Map<string,LeaderGroup>()
  for(const r of rows){
    const key=groupKey(r)
    const g=map.get(key)||{key,market:r.market,name:groupOf(r)||'분류 없음',rank:r.group_rank??null,total:r.group_total??null,rows:[]}
    g.rows.push(r);map.set(key,g)
  }
  return [...map.values()].sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||b.rows.length-a.rows.length||a.key.localeCompare(b.key))
}
export function byGroupThenRs(rows:LeaderRow[]){
  return rows.slice().sort((a,b)=>(a.group_rank??Infinity)-(b.group_rank??Infinity)||groupKey(a).localeCompare(groupKey(b))||(b.rs_rank??0)-(a.rs_rank??0))
}
// Top 20 % of ranked groups in a market (IBD's "top 40 of 197").
export const topGroup=(g:{rank:number|null;total:number|null})=>g.rank!=null&&!!g.total&&g.rank<=Math.ceil(g.total*.2)

// GROWTH-1 filters on STOCK-FLAGS-1 data. Without the flags file nothing can be judged, so the filters are off.
// growthOnly (GROWTH-FILTER-1, by user decision 2026-10-03 after SEPA-DEFAULT, on by default): latest quarter revenue
// >= +20 % and earnings >= +25 % vs a year earlier; unknown growth is hidden while it is on. Display only.
export const GROWTH_FILTER={revMin:.20,epsMin:.25}
export type LensFilter={hideWeak:boolean;sepaOnly:boolean;growthOnly:boolean}
export const DEFAULT_LENS_FILTER:LensFilter={hideWeak:false,sepaOnly:false,growthOnly:true}
export const growthPasses=(x:StockFlag|undefined)=>!!x?.growth&&(x.growth.rev??-1)>=GROWTH_FILTER.revMin&&(x.growth.eps??-1)>=GROWTH_FILTER.epsMin
// growthMarkets: markets whose quarterly growth source loaded (the flags file's growth_period). A market whose source
// failed has no known growth at all, so the growth filter skips it instead of hiding all of its stocks.
export function applyLensFilter(rows:LeaderRow[],flags:Record<string,StockFlag>|null|undefined,f:LensFilter,growthMarkets?:string[]){
  if(!flags)return rows
  return rows.filter(r=>{
    const x=flags[r.market+':'+r.ticker]
    if(f.hideWeak&&(x?.loss||x?.no_revenue))return false
    if(f.sepaOnly&&!x?.sepa)return false
    if(f.growthOnly&&(!growthMarkets||growthMarkets.includes(r.market))&&!growthPasses(x))return false
    return true
  })
}
