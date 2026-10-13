import { useVisualStyle, coverPhoto } from './VisualStyle'
import type { EditableRow, LeaderRow } from '../types'
import { Button } from './ui/button'

function sourceUrl(value:unknown){
 try{const url=new URL(String(value||''));return ['http:','https:'].includes(url.protocol)?url:null}catch{return null}
}

/** Editorial observations are the user's sourced research, never invented news. */
export function DiscoveryTopics({research,match,onSelect,onResearch}:{research:EditableRow[];match:(r:EditableRow)=>LeaderRow|null;onSelect:(r:LeaderRow)=>void;onResearch:()=>void}){
 const {photoStyle}=useVisualStyle()
 const observations=research.filter(r=>sourceUrl(r.source)&&String(r.fact||'').trim()).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,3)
 return <section className="discovery-topics" aria-label="출처가 있는 주제">
  {observations.length?observations.map((note,i)=>{
   const url=sourceUrl(note.source)!,company=match(note),date=String(note.date||'')
   const parsed=Date.parse(date),stale=Number.isFinite(parsed)&&Date.now()-parsed>30*86400000
   return <article className={`discovery-topic${i===0?' discovery-topic-cover':''}`} key={String(note.id)}>
    {i===0&&<img src={coverPhoto('discover',photoStyle)} alt=""/>}
    <div className="discovery-topic-copy"><span className="journey-kicker">관찰에서 기업으로</span><h3>{String(note.title||note.target||'나의 리서치')}</h3><p className="discovery-observation">{String(note.fact)}</p>
     {note.interpretation&&<p>나의 해석 · {String(note.interpretation)}</p>}
     <p className="discovery-provenance"><time>{date||'기준일 미제공'}</time> · {String(note.verification||'미검증')}{stale?' · 오래된 관찰 · 출처 재확인 필요':''}<br/><a href={url.href} target="_blank" rel="noopener noreferrer">출처 확인 · {url.hostname}</a></p>
     {company?<Button variant="secondary" onClick={()=>onSelect(company)}>{company.market==='KR'?company.name:company.ticker} · 기업 살펴보기 →</Button>:<p className="note">현재 유니버스에 연결된 기업이 없습니다. 리서치 노트에서 관련 종목을 확인하세요.</p>}
    </div>
   </article>
  }):<div className="discovery-topic-empty"><span className="journey-kicker">관찰에서 기업으로</span><h3>출처가 있는 발견을 모아보세요.</h3><p>아직 출처 링크와 관찰 사실이 함께 기록된 주제가 없습니다. 리서치 노트에 사실과 해석을 나누어 남기면 이곳에서 기업으로 이어집니다.</p></div>}
  <Button variant="ghost" onClick={onResearch}>리서치 노트에 관찰 남기기 →</Button>
 </section>
}
