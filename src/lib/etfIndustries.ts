import type { LeaderRow } from '../types'

// ETF-INDUSTRY-2: leading industries as seen through ETFs, drawn as a treemap heatmap. ETFs are grouped by market and
// industry. Tile size = sum of the ETFs' 20-session average trading value (ETF-VALUE-1, local currency, so markets are
// never sized against each other); tile colour = median benchmark-relative RS of the ETFs for the chosen period.
// Broad-market, multi-sector and multi-asset ETFs describe no single industry and are left out; missing values stay
// out of sums and medians (an industry without any trading value has no tile).
export const ETF_INDUSTRY_VERSION='ETF-INDUSTRY-2'
const NON_INDUSTRY_SECTORS=new Set(['Broad Market','Multi-Sector','Multi-Asset','분류 확인'])

// Korean labels for KR ETF industries (US industries keep their source names). Unmapped industries keep the source name.
const KR_INDUSTRY_NAMES:Record<string,string>={
  'AI Semiconductors':'AI 반도체','Aerospace & Defense':'방산·우주','Automobiles':'자동차','Automobiles & Mobility':'자동차·모빌리티',
  'Automobiles / Mobility':'자동차·모빌리티','Banks':'은행','Biotechnology':'바이오','Chemicals & Energy Materials':'화학·에너지소재',
  'Construction':'건설','Consumer Discretionary':'경기소비재','Consumer Staples':'필수소비재','Cosmetics':'화장품','Defensive Consumer':'경기방어',
  'Energy':'에너지','Financial Services':'금융','Health Care':'헬스케어','Heavy Industry':'중공업','Industrials':'산업재',
  'Information Technology':'IT','Insurance':'보험','Machinery':'기계장비','Media & Communication':'미디어·통신','Media & Content':'미디어·콘텐츠',
  'Media & Entertainment':'미디어·엔터테인먼트','Power Grid Equipment':'전력설비','Quantum Computing':'양자컴퓨팅','Secondary Batteries':'2차전지',
  'Securities':'증권','Semiconductors':'반도체','Shipbuilding':'조선','Software':'소프트웨어','Steel':'철강','Transportation':'운송',
  'US AI Power Infrastructure':'미국 AI 전력인프라','US AI Technology':'미국 AI 테크','Utilities':'유틸리티'
}
export const etfIndustryLabel=(market:string,industry:string)=>market==='KR'?(KR_INDUSTRY_NAMES[industry]||industry):industry

export const ETF_HEAT_PERIODS=[['5D','rs_5d'],['20D','rs_20d'],['50D','rs_50d'],['120D','rs_120d'],['200D','rs_200d'],['52W','rs_12m']] as const
export type EtfHeatPeriod=typeof ETF_HEAT_PERIODS[number][0]

export type EtfIndustry={
  key:string;market:string;industry:string;n:number;ranked:number;medRank:number|null;ttPass:number;leader:string
  // Sum of the ETFs' 20-session average trading value (local currency); ETFs without it add nothing.
  tradedValue:number;valued:number
  // Median benchmark-relative RS per period over ETFs that have that value; null when none do.
  medRs:Record<EtfHeatPeriod,number|null>
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
  const finite=(v:unknown)=>v!=null&&v!==''&&Number.isFinite(Number(v))
  for(const [key,list] of groups){
    const ranked=list.filter(r=>finite(r.etf_rs_rank))
    const valued=list.filter(r=>finite(r.traded_value_20d)&&Number(r.traded_value_20d)>0)
    const leader=(ranked.length?ranked:list).slice().sort((a,b)=>Number(b.etf_rs_rank??-1)-Number(a.etf_rs_rank??-1))[0]
    const medRs={} as Record<EtfHeatPeriod,number|null>
    for(const [period,field] of ETF_HEAT_PERIODS){
      const values=list.map(r=>r[field]).filter(finite).map(Number)
      medRs[period]=values.length?median(values):null
    }
    out.push({key,market:list[0].market,industry:String(list[0].industry).trim(),n:list.length,ranked:ranked.length,
      medRank:ranked.length?median(ranked.map(r=>Number(r.etf_rs_rank))):null,ttPass:list.filter(r=>r.leader_tt).length,leader:leader.name,
      tradedValue:valued.reduce((sum,r)=>sum+Number(r.traded_value_20d),0),valued:valued.length,medRs})
  }
  return out.sort((a,b)=>b.tradedValue-a.tradedValue||(b.medRank??-1)-(a.medRank??-1)||a.industry.localeCompare(b.industry))
}
