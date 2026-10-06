import type {LeaderRow,PositionRow} from '../types'

const pct=(v:number|null|undefined)=>v==null||!Number.isFinite(v)?'—':`${v>=0?'+':''}${(v*100).toFixed(1)}%`

export function FolioInsight({row,position,leadership}:{row:LeaderRow;position?:PositionRow;leadership:string}){
  const rs=row.asset_class==='ETF'?row.etf_rs_rank:row.rs_rank
  const momentum=(row.return_50d??row.return_20d??0)
  const high=row.high_52w_distance
  const revenue=position?.metrics.revenue_yoy_q
  const eps=position?.metrics.eps_yoy_q
  const roe=position?.metrics.roe
  const debt=position?.metrics.debt_ratio
  const strengths:string[]=[]
  const risks:string[]=[]

  if((rs??0)>=90)strengths.push(`RS ${Math.round(rs!)} · 시장 상위 모멘텀`)
  else if(rs!=null)strengths.push(`RS ${Math.round(rs)} · 상대강도 추적 필요`)
  if(row.leader_tt)strengths.push('Trend Template 통과')
  if(momentum>0)strengths.push(`50D 모멘텀 ${pct(momentum)}`)
  if(revenue!=null&&revenue>=.20)strengths.push(`분기 매출 성장 ${pct(revenue)}`)
  if(eps!=null&&eps>=.25)strengths.push(`분기 EPS 성장 ${pct(eps)}`)
  if(roe!=null&&roe>=.15)strengths.push(`ROE ${pct(roe)}`)

  if(high!=null&&high<-.20)risks.push(`52W 고점 대비 ${pct(high)}`)
  if(momentum<0)risks.push(`50D 모멘텀 ${pct(momentum)}`)
  if(!row.leader_tt)risks.push('Trend Template 미충족')
  if(debt!=null&&debt>1)risks.push(`부채비율 ${pct(debt)}`)
  if(position?.status==='check_failed')risks.push('펀더멘털 데이터 검증 필요')

  const thesis=(leadership==='핵심 주도'||leadership==='주도 후보')
    ?`${row.name}은(는) ${leadership} 프레임에 있으며, 가격·상대강도·산업 위치를 먼저 확인할 가치가 있습니다. 진입 판단은 모멘텀 지속성과 공시 성장의 동행 여부를 확인한 뒤 결정합니다.`
    :`${row.name}은(는) 현재 ${leadership||'관찰'} 상태입니다. 가격 모멘텀의 회복과 리더십 조건 재진입을 확인하기 전까지는 관찰 우선으로 봅니다.`

  return <section className="folio-insight-card" aria-label="Folio Insight">
    <div className="folio-insight-head"><span>FOLIO INSIGHT</span><small>Signal synthesis</small></div>
    <p className="folio-insight-thesis">{thesis}</p>
    <div className="folio-insight-grid">
      <div><b>Key strengths</b><ul>{strengths.slice(0,4).map(x=><li key={x}>{x}</li>)}{!strengths.length&&<li>확정 강점 신호 없음</li>}</ul></div>
      <div><b>Risk considerations</b><ul>{risks.slice(0,4).map(x=><li key={x}>{x}</li>)}{!risks.length&&<li>현재 자동 경고 신호 없음</li>}</ul></div>
    </div>
  </section>
}
