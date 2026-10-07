import {useState} from 'react'
import type {LeaderRow} from '../types'
import {usePriceHistory} from '../lib/priceHistory'
const pct=(v:number|null|undefined)=>v==null||!Number.isFinite(v)?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%'
import {miniTrend} from '../lib/miniTrend'
export function StockTrendList({rows,onSelect,getClass,className='',emptyLabel='선택한 범위와 필터에 맞는 종목이 없습니다.'}:{rows:LeaderRow[];onSelect:(row:LeaderRow)=>void;getClass:(row:LeaderRow)=>string;className?:string;emptyLabel?:string}){
 const [limit,setLimit]=useState(20)
 const shown=rows.slice(0,limit)
 const hist=usePriceHistory(shown.map(r=>r.id),shown.length>0)
 return <><div className={'stock-trend-list decision-list '+className} role="list" aria-label="분석 종목 목록">{shown.map(row=>{
  const trend=miniTrend(hist.get(row.id))
  const change=row.return_20d
  const price=row.price==null?'—':new Intl.NumberFormat(row.market==='US'?'en-US':'ko-KR',{minimumFractionDigits:row.market==='US'?2:0,maximumFractionDigits:row.market==='US'?2:0}).format(row.price)
  return <button key={row.id} type="button" role="listitem" className="stock-trend-row decision-row" aria-label={`${row.name||row.ticker} 종목 상세 보기`} onClick={()=>onSelect(row)}>
   <span className="stock-avatar" aria-hidden="true">{row.market==='KR'?(row.name||row.ticker).slice(0,1):row.ticker.slice(0,2)}</span>
   <span className="stock-trend-copy decision-main"><b>{row.ticker}</b><small className="decision-eyebrow">{row.name||row.ticker}</small><span className="stock-trend-tags"><i>{getClass(row)}</i><small>RS {row.rs_rank==null?'—':Math.round(row.rs_rank)}</small></span></span>
   <span className="stock-mini-trend">{trend?<><svg viewBox="0 0 100 48" role="img" aria-label={`${row.ticker} ${trend.complete?'20거래일':'확보된 기간'} 일간 종가 추세`} className={trend.up?'positive':'negative'}><title>{trend.start} ~ {trend.end} · 일간 종가{trend.complete?'':' · 20D 이력 부족'}</title><path d={trend.path}/></svg><small>{trend.complete?'20D':'이력 부족'}</small></>:<span className="stock-trend-missing">{hist.status==='loading'?'이력 로딩':'이력 없음'}</span>}</span>
   <span className="stock-trend-price decision-value"><b>{row.market==='US'?'$':'₩'}{price}</b><small className={(change??0)>0?'positive':(change??0)<0?'negative':''}>20D {pct(change)}</small></span>
  </button>
 })}{!rows.length&&<p className="empty">{emptyLabel}</p>}</div>{limit<rows.length&&<button type="button" className="secondary-action stock-trend-more" onClick={()=>setLimit(n=>n+20)}>더 보기 · {Math.min(20,rows.length-limit)}종목</button>}</>
}
