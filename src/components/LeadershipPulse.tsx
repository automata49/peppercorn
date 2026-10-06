import type {CSSProperties} from 'react'

type Counts={core:number;candidates:number;turns:number}

export function LeadershipPulse({counts,label='Leadership'}:{counts:Counts;label?:string}){
  const total=counts.core+counts.candidates+counts.turns
  const safe=Math.max(1,total)
  const core=counts.core/safe*100
  const candidate=counts.candidates/safe*100
  const turn=counts.turns/safe*100
  const style={
    '--lead-core':core+'%',
    '--lead-candidate':candidate+'%',
    '--lead-turn':turn+'%',
  } as CSSProperties
  return <section className="leadership-pulse" aria-label={label}>
    <div className="leadership-orbit-wrap" aria-hidden="true">
      <div className="leadership-orbit" style={style}/>
      <div className="leadership-orbit-center"><strong>{total}</strong><span>LEADING</span></div>
    </div>
    <div className="leadership-pulse-stats">
      <div><i className="core"/><span>핵심</span><b>{counts.core}</b></div>
      <div><i className="candidate"/><span>후보</span><b>{counts.candidates}</b></div>
      <div><i className="turn"/><span>전환</span><b>{counts.turns}</b></div>
    </div>
  </section>
}
