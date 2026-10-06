import { DecisionList } from './DecisionList'
import type { LeaderRow } from '../types'

export type HomeLeadershipKey='core'|'candidates'|'turns'|'corrections'
export type MarketRegimeTone='strong'|'neutral'|'weak'

export type HomeMarketRegime={
  label:string
  summary:string
  detail:string
  tone:MarketRegimeTone
}

type Counts={core:number;candidates:number;turns:number;corrections:number}

const classMeta:Record<HomeLeadershipKey,{eyebrow:string;label:string}> = {
  core:{eyebrow:'CORE',label:'핵심 주도'},
  candidates:{eyebrow:'WATCH',label:'주도 후보'},
  turns:{eyebrow:'TURN',label:'강세 전환'},
  corrections:{eyebrow:'RESET',label:'조정 중'}
}

export function HomeDecision({
  regime,
  counts,
  rows,
  insight,
  onSignal,
  onLeadership,
  onStock,
  labelFor
}:{
  regime:HomeMarketRegime
  counts:Counts
  rows:LeaderRow[]
  insight:string
  onSignal:()=>void
  onLeadership:(key:HomeLeadershipKey)=>void
  onStock:(row:LeaderRow)=>void
  labelFor:(row:LeaderRow)=>string
}){
  return <div className="home-decision-flow">
    <section className={'home-regime '+regime.tone} aria-label="Market regime">
      <div className="home-regime-copy">
        <span>MARKET REGIME</span>
        <h2>{regime.label}</h2>
        <p>{regime.summary}</p>
        <small>{regime.detail}</small>
      </div>
      <button type="button" onClick={onSignal}>Market Signal →</button>
    </section>

    <section className="home-leadership-snapshot" aria-labelledby="home-leadership-title">
      <div className="home-section-head">
        <div><span>LEADERSHIP</span><h2 id="home-leadership-title">지금 시장에서 어디에 힘이 모이는가</h2></div>
        <button type="button" onClick={()=>onLeadership('core')}>Leadership →</button>
      </div>
      <div className="home-class-grid">
        {(Object.keys(classMeta) as HomeLeadershipKey[]).map(key=><button key={key} type="button" onClick={()=>onLeadership(key)} aria-label={\`\${classMeta[key].label} \${counts[key]}종목\`}>
          <span>{classMeta[key].eyebrow}</span>
          <b>{counts[key]}</b>
          <small>{classMeta[key].label}</small>
        </button>)}
      </div>
    </section>

    <section className="home-today" aria-labelledby="home-today-title">
      <div className="home-section-head">
        <div><span>TODAY</span><h2 id="home-today-title">오늘 볼 종목</h2></div>
        <small>{rows.length}개 Focus</small>
      </div>
      <DecisionList
        className="home-today-list"
        items={rows.map((row,index)=>({
          key:row.id||row.market+':'+row.ticker,
          data:row,
          rank:index+1,
          eyebrow:row.market,
          title:row.name||row.ticker,
          meta:row.ticker,
          badge:labelFor(row),
          badgeTone:labelFor(row)==='핵심 주도'?'green':labelFor(row)==='주도 후보'?'blue':labelFor(row)==='강세 전환'?'amber':'gray',
          ariaLabel:\`\${row.name||row.ticker} Stock 단계로 이동\`
        }))}
        onSelect={onStock}
        emptyLabel="현재 Focus 종목이 없습니다."
      />
    </section>

    <section className="home-insight" aria-label="AI Insight">
      <div><span>AI INSIGHT</span><small>STRUCTURED · 규칙 기반</small></div>
      <p>{insight}</p>
    </section>
  </div>
}
