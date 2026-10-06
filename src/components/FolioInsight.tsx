import type {LeaderRow,PositionRow} from '../types'

const pct=(v:number|null|undefined)=>v==null||!Number.isFinite(v)?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%'

function labelOf(row:LeaderRow){
  if(row.asset_class&&row.asset_class!=='Equity')return 'ETF'
  if(row.leadership_class)return row.leadership_class
  if(row.leader_tt&&(row.rs_rank??0)>=95)return '핵심 주도'
  if(row.leader_tt&&(row.ibd_rs_estimate??0)>=80)return '주도 후보'
  return '관찰'
}

export function FolioInsight({row,position}:{row:LeaderRow;position?:PositionRow}){
  const label=labelOf(row)
  const above50=row.price!=null&&row.ma50!=null&&row.price>row.ma50
  const above200=row.price!=null&&row.ma200!=null&&row.price>row.ma200
  const nearHigh=row.high_52w_distance!=null&&row.high_52w_distance>=-.15
  const strongRs=(row.rs_rank??0)>=90
  const m=position?.metrics

  const strengths:string[]=[]
  if(['핵심 주도','주도 후보'].includes(label))strengths.push(`${label} 분류 · 리더십 유지`)
  if(strongRs)strengths.push(`RS 순위 ${Math.round(row.rs_rank!)} · 시장 상위권`)
  if(row.leader_tt)strengths.push('Trend Template 통과')
  if(above50&&above200)strengths.push('가격이 50일·200일 이동평균 위')
  if(nearHigh)strengths.push(`52주 고점 대비 ${pct(row.high_52w_distance)}`)
  if((m?.revenue_yoy_q??0)>=.20)strengths.push(`분기 매출 성장 ${pct(m?.revenue_yoy_q)}`)
  if((m?.eps_yoy_q??0)>=.25)strengths.push(`분기 EPS 성장 ${pct(m?.eps_yoy_q)}`)
  if((m?.roe??0)>=.17)strengths.push(`ROE ${pct(m?.roe)}`)

  const risks:string[]=[]
  if(!above50)risks.push('현재가가 50일선 아래 또는 확인 불가')
  if(!above200)risks.push('현재가가 200일선 아래 또는 확인 불가')
  if(row.high_52w_distance!=null&&row.high_52w_distance<-.25)risks.push(`52주 고점 대비 ${pct(row.high_52w_distance)}`)
  if((row.rs_3m??0)<=0)risks.push('3개월 상대강도 약화')
  if(position?.status==='check_failed')risks.push('공시 데이터 연속성 검사 실패')
  if(m?.debt_ratio!=null&&m.debt_ratio>1)risks.push(`부채비율 ${pct(m.debt_ratio)}`)
  if(m?.ttm_operating_cash_flow!=null&&m.ttm_operating_cash_flow<0)risks.push('영업현금흐름 음수')

  const s=strengths.slice(0,4)
  const r=risks.slice(0,4)
  if(!s.length)s.push('확인 가능한 강점 신호가 아직 충분하지 않습니다.')
  if(!r.length)r.push('현재 수집 데이터에서 즉시 드러나는 핵심 위험 신호가 제한적입니다.')

  const thesis=strongRs&&above50&&nearHigh
    ? `${row.name}은(는) 상대강도와 가격 구조가 함께 유지되는 종목입니다. 추세가 살아 있는 동안에는 리더십의 지속 여부와 공시 성장의 일관성을 함께 확인하는 편이 적합합니다.`
    : above200
      ? `${row.name}은(는) 장기 추세는 유지되지만 단기 리더십의 확신은 아직 제한적입니다. 가격 모멘텀과 공시 성장 신호가 동시에 강화되는지 확인할 필요가 있습니다.`
      : `${row.name}은(는) 현재 가격 구조의 확인이 우선입니다. 리더십 분류보다 추세 회복과 위험 신호의 해소 여부를 먼저 보는 편이 적합합니다.`

  return <section className="folio-insight" aria-label="Folio Insight">
    <header><div><span>FOLIO INSIGHT</span><h3>Investment Thesis</h3></div><small>Structured signal synthesis</small></header>
    <p className="folio-thesis">{thesis}</p>
    <div className="folio-insight-grid">
      <div><h4>Key Strengths</h4><ul>{s.map(x=><li key={x}>{x}</li>)}</ul></div>
      <div><h4>Risk Considerations</h4><ul>{r.map(x=><li key={x}>{x}</li>)}</ul></div>
    </div>
    <p className="folio-insight-note">가격·RS·공시 데이터의 규칙 기반 요약입니다. 투자 판단이나 생성형 AI 의견을 의미하지 않습니다.</p>
  </section>
}
