/** Display-only sector rank (v2). Never changes RS or stock leadership classifications. */
export const SECTOR_MIN_MEMBERS=5
export const SECTOR_CONFIDENCE_MEMBERS=20
export type SectorRankInput={
  sector:string;n:number;rankedCount:number;ma50Count:number;
  medRank:number|null;core:number;candidate:number;breadth:number;
}
export function sectorStanding(g:SectorRankInput){
  const leaders=g.core+g.candidate
  const eligible=g.sector!=='Other'&&g.n>=SECTOR_MIN_MEMBERS
    &&g.rankedCount>=SECTOR_MIN_MEMBERS&&g.ma50Count>=SECTOR_MIN_MEMBERS
    &&leaders>0&&g.medRank!=null&&Number.isFinite(g.medRank)
  const reason=g.sector==='Other'?'기타 분류':g.n<SECTOR_MIN_MEMBERS||g.rankedCount<SECTOR_MIN_MEMBERS||g.ma50Count<SECTOR_MIN_MEMBERS
    ?'표본 부족':leaders===0?'주도 없음':''
  // RS 45%, leader ratio 25%, MA50 breadth 20%, leader count 10%.
  // Shrink thin eligible groups (5–19 stocks), preventing a 5-name outlier from outranking broad sectors.
  const raw=(g.medRank??0)*.45+(leaders/g.n)*25+g.breadth*20+Math.min(leaders/20,1)*10
  const score=eligible?raw*Math.min(g.n/SECTOR_CONFIDENCE_MEMBERS,1):null
  return {rankEligible:eligible,rankScore:score,rankReason:reason}
}
export type SectorStanding=ReturnType<typeof sectorStanding>&{n:number;medRank:number|null;core:number;candidate:number;key:string}
export function compareSectorStanding(a:SectorStanding,b:SectorStanding){
  return Number(b.rankEligible)-Number(a.rankEligible)
    ||(b.rankScore??-1)-(a.rankScore??-1)
    ||(b.medRank??-1)-(a.medRank??-1)
    ||(b.core+b.candidate)-(a.core+a.candidate)
    ||b.n-a.n||a.key.localeCompare(b.key)
}
