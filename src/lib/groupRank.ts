import type { LeaderRow } from '../types'

// GROUP-RANK-1 (display): IBD-style industry group rank from loaded rows. Equities are grouped per market by their
// industry group (US: industry; KR: the WICS industry group in `sector`, since KR `industry` holds the broad sector).
// Groups with at least GROUP_MIN_MEMBERS ranked members are ordered by median RS rank (ties: more members first);
// smaller groups and stocks without an RS rank get no group rank. Never feeds classification.
export const GROUP_RANK_VERSION='GROUP-RANK-1'
export const GROUP_MIN_MEMBERS=5

export const groupOf=(r:LeaderRow)=>(r.market==='KR'?r.sector:r.industry)||''
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2}

export function groupRanks(rows:LeaderRow[]){
  const groups=new Map<string,number[]>()
  for(const r of rows){
    const g=groupOf(r)
    if(r.asset_class!=='Equity'||!g||r.rs_rank==null||!Number.isFinite(r.rs_rank))continue
    const key=r.market+'|'+g
    groups.set(key,[...(groups.get(key)||[]),r.rs_rank])
  }
  const out=new Map<string,{rank:number;total:number;median:number;n:number}>()
  for(const market of ['US','KR']){
    const ranked=[...groups].filter(([k,v])=>k.startsWith(market+'|')&&v.length>=GROUP_MIN_MEMBERS)
      .map(([k,v])=>({k,median:median(v),n:v.length})).sort((a,b)=>b.median-a.median||b.n-a.n||a.k.localeCompare(b.k))
    ranked.forEach((g,i)=>out.set(g.k,{rank:i+1,total:ranked.length,median:g.median,n:g.n}))
  }
  return out
}

export function withGroupRanks(rows:LeaderRow[]):LeaderRow[]{
  const ranks=groupRanks(rows)
  return rows.map(r=>{
    if(r.asset_class!=='Equity')return r
    const g=ranks.get(r.market+'|'+groupOf(r))
    return g?{...r,group_rank:g.rank,group_total:g.total,group_name:groupOf(r)}:{...r,group_rank:null,group_total:null,group_name:groupOf(r)||null}
  })
}

// SECTOR-LABEL-1 (display): US sectors arrive in two schemes (GICS for S&P 500 members, Nasdaq's classification for
// the rest), so the same sector showed under two names. Nasdaq names map to the closest GICS sector; GICS names stay.
export const US_SECTOR_GICS:Record<string,string>={
  'Technology':'Information Technology',
  'Finance':'Financials',
  'Basic Materials':'Materials',
  'Telecommunications':'Communication Services',
  'Miscellaneous':'Other',
}
export function normalizeUsSectors(rows:LeaderRow[]):LeaderRow[]{
  return rows.map(r=>r.market==='US'&&US_SECTOR_GICS[r.sector]?{...r,sector:US_SECTOR_GICS[r.sector]}:r)
}
