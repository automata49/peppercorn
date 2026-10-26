import { useEffect, useState, type ReactNode } from 'react'
import {coverPhoto,useVisualStyle} from './VisualStyle'
import { Button } from './ui/button'
import type { ReportController, ReportDetail, ReportPage } from '../lib/sourceReports'
import {ReportSummary,ReportBody,ReportTableVisual} from './ReportVisuals'
import type {LeaderRow} from '../types'
import {NewsStockMetrics} from './NewsStockMetrics'
import {NewsCoverFlow} from './NewsCoverFlow'
import {ResearchText} from './ResearchText'
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
function ReportReader({report,controller,preloaded}:{report:ReportController['items'][number];controller:ReportController;preloaded?:ReportDetail}){
 const version=report.content_hash+'/'+report.imported_at
 const [state,setState]=useState<{hash:string;value?:ReportDetail;error?:string}>({hash:''})
 useEffect(()=>{
  if(preloaded)return
  const abort=new AbortController();let active=true
  void controller.detail(report.drive_file_id,abort.signal).then(value=>{if(active)setState({hash:version,value})}).catch(()=>{if(active)setState({hash:version,error:'전문을 불러오지 못했습니다. 잠시 후 다시 열어주세요.'})})
  return()=>{active=false;abort.abort()}
 },[report.drive_file_id,version,controller.detail,preloaded])
 const detail=preloaded||(state.hash===version?state.value:undefined)
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
export function SourceReports({controller,news=false,children,rows=[],onSelect}:{controller:ReportController;news?:boolean;children?:ReactNode;rows?:LeaderRow[];onSelect?:(row:LeaderRow)=>void}){
 const [open,setOpen]=useState<string|null>(null)
 const {photoStyle}=useVisualStyle()
 const {latest,history}=splitReportShelf(controller.uid?controller.items:[])
 const [preview,setPreview]=useState<{key:string;value:ReportDetail}|null>(null)
 const [failed,setFailed]=useState<Set<string>>(()=>new Set())
 const previewKey=controller.uid+'/'+latest?.drive_file_id+'/'+latest?.content_hash+'/'+latest?.imported_at
 useEffect(()=>{setOpen(null);setPreview(null);setFailed(new Set())},[controller.uid])
 // Covers use only validated, owner-scoped stored images; never hotlink a supplied URL.
 useEffect(()=>{
  if(!news||!controller.uid||!latest)return
  const abort=new AbortController();let active=true
  void controller.detail(latest.drive_file_id,abort.signal).then(value=>{if(active)setPreview({key:previewKey,value})}).catch(()=>{})
  return()=>{active=false;abort.abort()}
 },[news,previewKey,controller.detail])
 const preloaded=preview?.key===previewKey?preview.value:undefined
 const cover=preloaded?.pages.flatMap(p=>(p.image_meta||[]).map(m=>({...m,url:p.images[m.image_index]}))).find(m=>m.url&&!failed.has(m.url))
 const related=(preloaded?.pages[0]?.tickers||[]).map(t=>rows.find(r=>r.market===t.market&&r.ticker===t.ticker)).filter((r):r is LeaderRow=>!!r).filter((r,i,list)=>list.findIndex(v=>v.market===r.market&&v.ticker===r.ticker)===i).slice(0,3)
 const render=(r:ReportController['items'][number],isLatest=false)=><article key={r.drive_file_id} data-report={isLatest?'latest':'archived'}>
  {isLatest&&<span className="source-report-latest">최신 리포트</span>}
  <h5>{r.title}</h5><time dateTime={r.source_modified_at}>{new Date(r.source_modified_at).toLocaleString('ko-KR')} · 자료 갱신</time>
  <ReportSummary lines={r.summary}/>
  <div className="source-report-actions"><Button variant="ghost" aria-expanded={open===r.drive_file_id} onClick={()=>setOpen(open===r.drive_file_id?null:r.drive_file_id)}>{open===r.drive_file_id?'전문 접기':'전문·차트 읽기'}</Button></div>
  {open===r.drive_file_id&&<ReportReader key={controller.uid+r.drive_file_id} report={r} controller={controller}/>}
 </article>
 const errors=controller.uid&&controller.error&&<p role="status">{controller.error} <Button variant="ghost" onClick={controller.refresh}>다시 시도</Button></p>
 const archive=!!history.length&&<details className="source-report-archive" onToggle={e=>{if(!e.currentTarget.open&&open&&history.some(r=>r.drive_file_id===open))setOpen(null)}}><summary>이전 리포트 · {history.length}개</summary>{history.map(r=>render(r))}</details>
 if(news)return <section className="source-reports source-reports-news" aria-label="뉴스와 리포트 요약">
  {errors}
  <NewsCoverFlow>
   {latest&&<article className="discovery-news-story" role="listitem" data-kind="report" data-report="latest" data-image-kind={cover?.kind}>
    <figure><button className="discovery-news-cover" type="button" aria-label={latest.title+' 전문 열기'} onClick={()=>setOpen(latest.drive_file_id)}><img src={cover?.url||coverPhoto('discover',photoStyle)} alt={cover?.caption||''} loading="lazy" onError={()=>{if(cover)setFailed(old=>new Set([...old,cover.url]))}}/></button>
     <figcaption>{cover?<><span>{cover.kind==='chart'?'원문 차트':cover.kind==='illustration'?'출처 일러스트':'출처 사진'}</span><a href={cover.source_url} target="_blank" rel="noopener noreferrer">{cover.credit}</a><a href={cover.license_url} target="_blank" rel="noopener noreferrer">{cover.usage_rights}</a></>:<span>Folio 이미지 · 원문 사진 아님</span>}</figcaption>
    </figure>
    <div className="discovery-news-copy">
     <span className="discovery-news-instrument">REPORT · 최신 리포트 · 계정 전용</span>
     <h4><button type="button" onClick={()=>setOpen(latest.drive_file_id)}>{latest.title}</button></h4>
     {!!related.length&&<details className="news-report-instruments"><summary>연결 종목 · {related.length}개</summary>{related.map(row=><div key={row.market+row.ticker}><NewsStockMetrics row={row}/>{onSelect&&<div className="discovery-news-actions"><button type="button" onClick={()=>onSelect(row)}>{row.market==='KR'?row.name:row.ticker} 종목 보기</button></div>}</div>)}</details>}
     {latest.summary.map((line,i)=><p key={i}><ResearchText text={line}/></p>)}
     <div className="discovery-news-source"><span>Instinct · 리포트 요약</span><time dateTime={latest.source_modified_at}>{new Date(latest.source_modified_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST · 자료 갱신</time></div>
     <div className="discovery-news-actions"><button type="button" aria-expanded={open===latest.drive_file_id} aria-controls="report-news-reader" onClick={()=>setOpen(open===latest.drive_file_id?null:latest.drive_file_id)}>{open===latest.drive_file_id?'전문 접기':'전문·차트 읽기'}</button></div>
    </div>
   </article>}
   {children}
  </NewsCoverFlow>
  {latest&&open===latest.drive_file_id&&<section id="report-news-reader" aria-label="리포트 전문 읽기"><h4>{latest.title}</h4><ReportReader key={controller.uid+latest.drive_file_id} report={latest} controller={controller} preloaded={preloaded}/></section>}
  {archive}
 </section>
 if(!controller.uid||(!latest&&!controller.error))return null
 return <section className="home-digest source-reports" aria-label="Folio 리서치 리포트">{errors}{latest&&render(latest,true)}{archive}</section>
}
