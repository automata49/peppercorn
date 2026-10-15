import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import type { ReportController, ReportDetail } from '../lib/sourceReports'
import './source-reports.css'

function ReportReader({report,controller}:{report:ReportController['items'][number];controller:ReportController}){
 const version=report.content_hash+'/'+report.imported_at
 const [state,setState]=useState<{hash:string;value?:ReportDetail;error?:string}>({hash:''})
 useEffect(()=>{
  const abort=new AbortController();let active=true
  void controller.detail(report.drive_file_id,abort.signal).then(value=>{if(active)setState({hash:version,value})}).catch(()=>{if(active)setState({hash:version,error:'전문을 불러오지 못했습니다. 원본 PDF를 확인해주세요.'})})
  return()=>{active=false;abort.abort()}
 },[report.drive_file_id,version,controller.detail])
 const detail=state.hash===version?state.value:undefined
 if(!detail)return <p role="status">{state.error||'리포트 전문을 불러오는 중…'}</p>
 return <div className="source-report-reading">
  <details><summary>원본 이미지·차트 보기</summary>{detail.pages.flatMap(p=>p.images.map((src,i)=><img className="source-report-image" key={`${p.number}-${i}`} src={src} alt={`리포트 ${p.number}페이지 원본 ${i+1}`} loading="lazy"/>))}</details>
  <div aria-label="리포트 전문">{detail.pages.map(p=><section key={p.number}>{detail.pages.length>1&&<h6>{p.number}페이지</h6>}<div className="source-report-text">{p.text}</div></section>)}</div>
  {!!detail.links.length&&<details><summary>리포트 출처 · {detail.links.length}개</summary><ul>{detail.links.map((l,i)=><li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label||l.url} ↗</a></li>)}</ul></details>}
 </div>
}
export function SourceReports({controller,view}:{controller:ReportController;view:'summary'|'journal'}){
 const [open,setOpen]=useState<string|null>(null)
 useEffect(()=>setOpen(null),[controller.uid])
 if(!controller.uid)return null
 if(!controller.items.length&&!controller.error)return null
 const items=view==='summary'?controller.items.slice(0,1):controller.items
 return <section className="home-digest source-reports" aria-label={view==='summary'?'오늘의 리서치 리포트':'저널 리서치 리포트'}>
  <h4>{view==='summary'?'오늘의 리서치':'리서치 리포트'}</h4>
  {controller.error&&<p role="status">{controller.error} <Button variant="ghost" onClick={controller.refresh}>다시 시도</Button></p>}
  {items.map(r=><article key={r.drive_file_id}>
   <h5>{r.title}</h5><time>{new Date(r.source_modified_at).toLocaleString('ko-KR')} · PDF 수정 시각</time>
   <ul>{r.summary.map((line,i)=><li key={i}>{line}</li>)}</ul>
   <div className="source-report-actions"><Button variant="ghost" aria-expanded={open===r.drive_file_id} onClick={()=>setOpen(open===r.drive_file_id?null:r.drive_file_id)}>{open===r.drive_file_id?'전문 접기':'전문·차트 읽기'}</Button><a href={r.source_url} target="_blank" rel="noopener noreferrer">원본 PDF ↗</a></div>
   {open===r.drive_file_id&&<ReportReader key={controller.uid+r.drive_file_id} report={r} controller={controller}/>}
  </article>)}
 </section>
}
