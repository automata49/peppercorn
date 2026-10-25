import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import type { ReportController, ReportDetail, ReportPage } from '../lib/sourceReports'
import {ReportSummary,ReportBody,ReportTableVisual} from './ReportVisuals'
import {splitReportShelf} from '../lib/reportPresentation'
import './source-reports.css'

function ReportImage({src,page,index}:{src:string;page:ReportPage;index:number}){
 const [failed,setFailed]=useState(false)
 const meta=page.image_meta?.find(m=>m.image_index===index)
 return <figure className="source-report-figure">
  {failed?<p role="status">이미지를 불러오지 못했습니다.</p>:<img className="source-report-image" src={src} alt={meta?.caption||`리포트 ${page.number}페이지 원본 ${index+1}`} loading="lazy" onError={()=>setFailed(true)}/>}
  {meta&&<figcaption>{meta.caption} · <a href={meta.source_url} target="_blank" rel="noopener noreferrer">{meta.credit}</a> · <a href={meta.license_url} target="_blank" rel="noopener noreferrer">{meta.usage_rights}</a></figcaption>}
 </figure>
}
function ReportReader({report,controller}:{report:ReportController['items'][number];controller:ReportController}){
 const version=report.content_hash+'/'+report.imported_at
 const [state,setState]=useState<{hash:string;value?:ReportDetail;error?:string}>({hash:''})
 useEffect(()=>{
  const abort=new AbortController();let active=true
  void controller.detail(report.drive_file_id,abort.signal).then(value=>{if(active)setState({hash:version,value})}).catch(()=>{if(active)setState({hash:version,error:'전문을 불러오지 못했습니다. 잠시 후 다시 열어주세요.'})})
  return()=>{active=false;abort.abort()}
 },[report.drive_file_id,version,controller.detail])
 const detail=state.hash===version?state.value:undefined
 if(!detail)return <p role="status">{state.error||'리포트 전문을 불러오는 중…'}</p>
 const structured=detail.pages[0]?.format==='instinct-json-v1'
 const links=detail.links.filter(l=>!['drive.google.com','docs.google.com'].includes(new URL(l.url).hostname))
 return <div className="source-report-reading">
  {structured&&<p className="source-report-dates"><time>발행 {new Date(detail.pages[0].published_at!).toLocaleString('ko-KR')}</time>{detail.pages[0].updated_at&&<time>수정 {new Date(detail.pages[0].updated_at).toLocaleString('ko-KR')}</time>}</p>}
  {structured&&detail.pages.length>1&&<nav className="source-report-toc" aria-label="리포트 목차">{detail.pages.map((p,i)=><button type="button" key={p.number} onClick={()=>{const section=document.getElementById('report-'+report.drive_file_id+'-'+p.number);section?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});section?.focus({preventScroll:true})}}><span>{String(i+1).padStart(2,'0')}</span>{p.heading||p.number+'페이지'}</button>)}</nav>}
  {!structured&&<details><summary>원본 이미지·차트 보기</summary>{detail.pages.flatMap(p=>p.images.map((src,i)=><ReportImage key={`${p.number}-${i}`} src={src} page={p} index={i}/>))}</details>}
  <div aria-label="리포트 전문">{detail.pages.map(p=><section className="source-report-section" tabIndex={-1} key={p.number} id={'report-'+report.drive_file_id+'-'+p.number}>
   {p.heading?<h6 className="source-report-section-title">{p.heading}</h6>:detail.pages.length>1&&<h6>{p.number}페이지</h6>}
   <ReportBody text={p.text}/>
   {p.tables?.map((table,i)=><ReportTableVisual table={table} key={i}/>)}
   {structured&&p.images.map((src,i)=><ReportImage key={i} src={src} page={p} index={i}/>)}
  </section>)}</div>
  {!!links.length&&<details><summary>리포트 출처 · {links.length}개</summary><ul>{links.map((l,i)=><li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label||l.url} ↗</a></li>)}</ul></details>}
 </div>
}
export function SourceReports({controller}:{controller:ReportController}){
 const [open,setOpen]=useState<string|null>(null)
 useEffect(()=>setOpen(null),[controller.uid])
 if(!controller.uid)return null
 if(!controller.items.length&&!controller.error)return null
 const {latest,history}=splitReportShelf(controller.items)
 const render=(r:ReportController['items'][number],isLatest=false)=><article key={r.drive_file_id} data-report={isLatest?'latest':'archived'}>
  {isLatest&&<span className="source-report-latest">최신 리포트</span>}
  <h5>{r.title}</h5><time dateTime={r.source_modified_at}>{new Date(r.source_modified_at).toLocaleString('ko-KR')} · 자료 갱신</time>
  <ReportSummary lines={r.summary}/>
  <div className="source-report-actions"><Button variant="ghost" aria-expanded={open===r.drive_file_id} onClick={()=>setOpen(open===r.drive_file_id?null:r.drive_file_id)}>{open===r.drive_file_id?'전문 접기':'전문·차트 읽기'}</Button></div>
  {open===r.drive_file_id&&<ReportReader key={controller.uid+r.drive_file_id} report={r} controller={controller}/>}
 </article>
 return <section className="home-digest source-reports" aria-label="Folio 리서치 리포트">
  {controller.error&&<p role="status">{controller.error} <Button variant="ghost" onClick={controller.refresh}>다시 시도</Button></p>}
  {latest&&render(latest,true)}
  {!!history.length&&<details className="source-report-archive" onToggle={e=>{if(!e.currentTarget.open&&open&&history.some(r=>r.drive_file_id===open))setOpen(null)}}><summary>이전 리포트 · {history.length}개</summary>{history.map(r=>render(r))}</details>}
 </section>
}
