import type { LeaderRow } from '../types'

// ETF-INDUSTRY-1: leading industries as seen through ETFs. ETFs are grouped by market and industry; the strength
// of an industry is the median ETF-only RS rank (ETF-RS-RANK-1) of its ranked ETFs. Broad-market, multi-sector
// and multi-asset ETFs describe no single industry and are left out; ETFs without a rank do not enter the median.
export const ETF_INDUSTRY_VERSION='ETF-INDUSTRY-1'
const NON_INDUSTRY_SECTORS=new Set(['Broad Market','Multi-Sector','Multi-Asset','분류 확인'])

export type EtfIndustry={
  key:string;market:string;industry:string;n:number;ranked:number;medRank:number;ttPass:number;leader:string
}

const median=(values:number[])=>{
  const a=values.slice().sort((x,y)=>x-y),m=Math.floor(a.length/2)
  return a.length%2?a[m]:(a[m-1]+a[m])/2
}

export function buildEtfIndustries(rows:LeaderRow[]):EtfIndustry[]{
  const groups=new Map<string,LeaderRow[]>()
  for(const r of rows){
    const industry=String(r.industry||'').trim()
    if(r.asset_class!=='ETF'||!industry||NON_INDUSTRY_SECTORS.has(String(r.sector||'').trim()))continue
    const key=`${r.market}|${industry}`
    const list=groups.get(key)||[];list.push(r);groups.set(key,list)
  }
  const out:EtfIndustry[]=[]
  for(const [key,list] of groups){
    const ranked=list.filter(r=>r.etf_rs_rank!=null&&Number.isFinite(Number(r.etf_rs_rank)))
    if(!ranked.length)continue
    const leader=ranked.slice().sort((a,b)=>Number(b.etf_rs_rank)-Number(a.etf_rs_rank))[0]
    out.push({key,market:list[0].market,industry:String(list[0].industry).trim(),n:list.length,ranked:ranked.length,
      medRank:median(ranked.map(r=>Number(r.etf_rs_rank))),ttPass:list.filter(r=>r.leader_tt).length,leader:leader.name})
  }
  return out.sort((a,b)=>b.medRank-a.medRank||b.n-a.n||a.industry.localeCompare(b.industry))
}
