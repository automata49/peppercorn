import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import type { ReportController, ReportDetail, ReportPage } from '../lib/sourceReports'
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
  void controller.detail(report.drive_file_id,abort.signal).then(value=>{if(active)setState({hash:version,value})}).catch(()=>{if(active)setState({hash:version,error:'전문을 불러오지 못했습니다. 원본 파일을 확인해주세요.'})})
  return()=>{active=false;abort.abort()}
 },[report.drive_file_id,version,controller.detail])
 const detail=state.hash===version?state.value:undefined
 if(!detail)return <p role="status">{state.error||'리포트 전문을 불러오는 중…'}</p>
 const structured=detail.pages[0]?.format==='instinct-json-v1'
 return <div className="source-report-reading">
  {structured&&<p className="source-report-dates"><time>발행 {new Date(detail.pages[0].published_at!).toLocaleString('ko-KR')}</time>{detail.pages[0].updated_at&&<time>수정 {new Date(detail.pages[0].updated_at).toLocaleString('ko-KR')}</time>}</p>}
  {!structured&&<details><summary>원본 이미지·차트 보기</summary>{detail.pages.flatMap(p=>p.images.map((src,i)=><ReportImage key={`${p.number}-${i}`} src={src} page={p} index={i}/>))}</details>}
  <div aria-label="리포트 전문">{detail.pages.map(p=><section key={p.number}>
   {p.heading?<h6 className="source-report-section-title">{p.heading}</h6>:detail.pages.length>1&&<h6>{p.number}페이지</h6>}
   <div className="source-report-text">{p.text}</div>
   {p.tables?.map((t,i)=><div className="source-report-table" role="region" aria-label={t.caption} tabIndex={0} key={i}><table><caption>{t.caption}</caption><thead><tr>{t.columns.map((c,j)=><th key={j} scope="col">{c}</th>)}</tr></thead><tbody>{t.rows.map((row,j)=><tr key={j}>{row.map((c,k)=><td key={k}>{c}</td>)}</tr>)}</tbody></table></div>)}
   {structured&&p.images.map((src,i)=><ReportImage key={i} src={src} page={p} index={i}/>)}
  </section>)}</div>
  {!!detail.links.length&&<details><summary>리포트 출처 · {detail.links.length}개</summary><ul>{detail.links.map((l,i)=><li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label||l.url} ↗</a></li>)}</ul></details>}
  {structured&&detail.pages[0].original_url&&<a href={detail.pages[0].original_url} target="_blank" rel="noopener noreferrer">원본 JSON ↗</a>}
 </div>
}
export function SourceReports({controller}:{controller:ReportController}){
 const [open,setOpen]=useState<string|null>(null)
 useEffect(()=>setOpen(null),[controller.uid])
 if(!controller.uid)return null
 if(!controller.items.length&&!controller.error)return null
 return <section className="home-digest source-reports" aria-label="Folio 리서치 리포트">
  {controller.error&&<p role="status">{controller.error} <Button variant="ghost" onClick={controller.refresh}>다시 시도</Button></p>}
  {controller.items.map(r=><article key={r.drive_file_id}>
   <h5>{r.title}</h5><time>{new Date(r.source_modified_at).toLocaleString('ko-KR')} · 원본 수정 시각</time>
   <ul>{r.summary.map((line,i)=><li key={i}>{line}</li>)}</ul>
   <div className="source-report-actions"><Button variant="ghost" aria-expanded={open===r.drive_file_id} onClick={()=>setOpen(open===r.drive_file_id?null:r.drive_file_id)}>{open===r.drive_file_id?'전문 접기':'전문·차트 읽기'}</Button><a href={r.source_url} target="_blank" rel="noopener noreferrer">원본 파일 ↗</a></div>
   {open===r.drive_file_id&&<ReportReader key={controller.uid+r.drive_file_id} report={r} controller={controller}/>}
  </article>)}
 </section>
}
