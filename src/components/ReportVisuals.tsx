import {useState} from 'react'
import type {ReportTable} from '../lib/sourceReports'
import {reportBlocks,reportChart,reportSummary} from '../lib/reportPresentation'

export function ReportSummary({lines}:{lines:string[]}){
 return <div className="source-report-digest" aria-label="리포트 핵심 요약">{lines.map((line,i)=>{
  const part=reportSummary(line)
  return <section className="source-report-digest-item" key={i}><span className="source-report-digest-label">{part.label}</span><p>{part.text}</p></section>
 })}</div>
}
export function ReportBody({text}:{text:string}){
 const blocks=reportBlocks(text)
 const titles={text:'',facts:'사실',outlook:'전망 · 미확정',note:'자료 유의사항'}
 return <div className="source-report-evidence">{blocks.map((block,i)=><div className={'source-report-evidence-block source-report-evidence-'+block.kind} key={i}>
  {titles[block.kind]&&<span className="source-report-evidence-label">{titles[block.kind]}</span>}
  {block.kind==='facts'||block.kind==='outlook'?<ul>{block.text.split('\n').filter(Boolean).map((line,j)=><li key={j}>{line.replace(/^•\s?/,'')}</li>)}</ul>:<p className="source-report-text">{block.text}</p>}
 </div>)}</div>
}
export function ReportTableVisual({table}:{table:ReportTable}){
 const chart=reportChart(table),[mode,setMode]=useState<'chart'|'table'>('chart')
 return <figure className="source-report-data">
  <figcaption>{table.caption}</figcaption>
  {chart&&<div className="source-report-view" role="group" aria-label={table.caption+' 보기'}>
   <button type="button" aria-pressed={mode==='chart'} onClick={()=>setMode('chart')}>차트</button>
   <button type="button" aria-pressed={mode==='table'} onClick={()=>setMode('table')}>표</button>
  </div>}
  {chart&&mode==='chart'?<div className="source-report-bars" role="img" aria-label={table.caption+' · '+table.columns[1]+': '+chart.rows.map(r=>r.label+' '+r.display).join(', ')}>
   <span className="source-report-bar-unit">{table.columns[1]} · 0 기준 비교</span>
   {chart.rows.map((row,i)=><div className="source-report-bar-row" key={i} aria-hidden="true"><span>{row.label}</span><strong>{row.display}</strong><div className="source-report-bar-track"><span style={{width:(row.value/chart.max)*100+'%'}}/></div></div>)}
  </div>:<div className="source-report-table" role="region" aria-label={table.caption} tabIndex={0}><table><caption className="sr-only">{table.caption}</caption><thead><tr>{table.columns.map((c,j)=><th key={j} scope="col">{c}</th>)}</tr></thead><tbody>{table.rows.map((row,j)=><tr key={j}>{row.map((c,k)=><td key={k}>{c}</td>)}</tr>)}</tbody></table></div>}
 </figure>
}
