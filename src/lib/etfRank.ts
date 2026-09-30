import type { LeaderRow } from '../types'

// ETF-RS-RANK-1: ETFs are ranked only against ETFs of the same market; they never enter the equity rs_rank.
// Score and scale mirror the equity rank in recalculate_market_leadership(): weighted RS 1M/3M/6M/12M
// (.30/.30/.20/.20, re-weighted over available periods), then round(1+98*cume_dist) per market.
// Inputs are ETF-RS-1 benchmark-relative returns (US SPY, KR 069500); an ETF without any of them stays unranked.
export const ETF_RS_RANK_VERSION='ETF-RS-RANK-1'

const weights=[['rs_1m',.30],['rs_3m',.30],['rs_6m',.20],['rs_12m',.20]] as const

export function etfRsScore(row:LeaderRow):number|null{
  let sum=0,weight=0
  for(const [field,w] of weights){
    const raw=row[field]
    if(raw==null||(raw as unknown)==='')continue
    const value=Number(raw)
    if(!Number.isFinite(value))continue
    sum+=value*w;weight+=w
  }
  return weight?sum/weight:null
}

export function rankEtfs(rows:LeaderRow[]):Map<string,number>{
  const byMarket=new Map<string,{id:string;score:number}[]>()
  for(const row of rows){
    if(row.asset_class!=='ETF')continue
    const score=etfRsScore(row)
    if(score==null)continue
    const list=byMarket.get(row.market)||[];list.push({id:row.id,score});byMarket.set(row.market,list)
  }
  const ranks=new Map<string,number>()
  for(const list of byMarket.values()){
    const sorted=list.map(e=>e.score).sort((a,b)=>a-b)
    for(const entry of list){
      // cume_dist: share of rows with a score at or below this one (ties share the higher position).
      let lo=0,hi=sorted.length
      while(lo<hi){const mid=(lo+hi)>>1;if(sorted[mid]<=entry.score)lo=mid+1;else hi=mid}
      ranks.set(entry.id,Math.round(1+98*lo/sorted.length))
    }
  }
  return ranks
}

export function withEtfRanks(rows:LeaderRow[]):LeaderRow[]{
  const ranks=rankEtfs(rows)
  return rows.map(row=>row.asset_class==='ETF'?{...row,etf_rs_rank:ranks.get(row.id)??null}:row)
}
