import type {InstinctImage} from '../lib/instinctImages'
import {useEffect,useState} from 'react'
import {NewsStockMetrics} from './NewsStockMetrics'
import {ResearchText} from './ResearchText'
import type {LeaderRow} from '../types'
import {loadInstinctNews,diverseInstinctNews,type InstinctArticle,type InstinctVisual} from '../lib/instinctLeaderNews'
import {coverPhoto,useVisualStyle} from './VisualStyle'
import {SourceReports} from './SourceReports'
import type {ReportController} from '../lib/sourceReports'

type NewsStory={
 id:string;market:'KR'|'US'|'GLOBAL';ticker?:string;trend_topic?:string;headline:string;summary:string;
 published_at:string;publisher:string;url:string;visual?:InstinctVisual;images?:InstinctImage[];
 kind:'stock'|'trend';row?:LeaderRow;label:string
}
/** Public story coverage is independent of leader scoring; trend news never gets a made-up ticker. */
export function DiscoveryNews({reports,rows,onSelect}:{reports:ReportController;rows:LeaderRow[];onSelect:(row:LeaderRow)=>void}){
 const {photoStyle}=useVisualStyle()
 const [failed,setFailed]=useState<Set<string>>(()=>new Set())
 const [visibleCount,setVisibleCount]=useState(4)
 const [instinct,setInstinct]=useState<InstinctArticle[]>([])
 useEffect(()=>{let active=true;void loadInstinctNews().then(items=>{if(active)setInstinct(items)});return()=>{active=false}},[])
 const now=Date.now(),lookup=new Map(rows.map(r=>[r.market+':'+r.ticker,r]))
 const fromDrive:NewsStory[]=diverseInstinctNews(instinct).map((item,i)=>{
  const isTrend=item.type==='trend',row=!isTrend?lookup.get(item.market+':'+item.ticker):undefined
  return {
   id:'instinct:'+i+':'+item.source_url,market:item.market,
   ...(!isTrend?{ticker:item.ticker}:{trend_topic:item.trend_topic}),
   headline:item.headline,summary:item.summary,published_at:item.published_at,
   publisher:item.source_name,url:item.source_url,visual:item.visual,images:item.images,
   kind:isTrend?'trend' as const:'stock' as const,row,
   label:isTrend?item.trend_topic:(item.market==='KR'?row?.name||item.ticker:item.ticker)
  }
 })
 const stories=fromDrive.slice(0,visibleCount)
 // Public news remains visible; private summaries are supplied only by the account controller.
 const date=(value:string)=>new Date(value).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'})
 return <section className="discovery-news" aria-label="시장과 종목의 최신 뉴스">
  <header className="discovery-news-heading"><div><span className="journey-kicker">MARKET & COMPANIES</span><h3>시장과 기업의 새 소식</h3></div><span>뉴스 · 리포트 요약</span></header>
  {!reports.uid&&<p className="discovery-news-empty" role="status">로그인 후 리포트 요약과 전문도 함께 볼 수 있습니다.</p>}
  {!stories.length&&<p className="discovery-news-empty" role="status">최근 7일의 Instinct 뉴스가 없습니다.</p>}
  <SourceReports controller={reports} news rows={rows} onSelect={onSelect}>{stories.map(item=>{
   const linked=item.images?.find(v=>!failed.has(v.url))
   const visual=item.visual&&!failed.has(item.visual.url)?item.visual:undefined
   return <article className="discovery-news-story" role="listitem" key={item.id} data-market={item.market} data-kind={item.kind} data-image-kind={linked?.kind}>
    <figure><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={item.headline+' 원문 열기'}><img src={linked?import.meta.env.BASE_URL+linked.url:visual?import.meta.env.BASE_URL+visual.url:coverPhoto('discover',photoStyle)} alt={linked?.caption||visual?.alt||''} loading="lazy" referrerPolicy="no-referrer" onError={()=>{if(linked)setFailed(old=>new Set([...old,linked.url]));else if(visual)setFailed(old=>new Set([...old,visual.url]))}}/></a>
     <figcaption>{linked?<><span>{linked.kind==='chart'?'원문 차트':linked.kind==='illustration'?'출처 일러스트':'출처 사진'}</span><a href={linked.source_url} target="_blank" rel="noopener noreferrer">{linked.credit}</a><a href={linked.license_url} target="_blank" rel="noopener noreferrer">{linked.usage_rights}</a></>:visual?<span>{visual.credit} · 실제 기사 사진 아님</span>:<span>Folio 이미지 · 원문 사진 아님</span>}</figcaption>
    </figure>
    <div className="discovery-news-copy">
     <span className="discovery-news-instrument">{item.kind==='trend'?<><span className="discovery-news-trend-tag">TREND</span> {item.label} · {item.market==='GLOBAL'?'GLOBAL':item.market}</>:<>{item.label} · {item.row?.industry||item.row?.sector||item.market}</>}</span>
     {item.row&&<NewsStockMetrics row={item.row}/>}
     <h4><a href={item.url} target="_blank" rel="noopener noreferrer">{item.headline}</a></h4>
     {item.summary&&<p><ResearchText text={item.summary} market={item.market}/></p>}
     <div className="discovery-news-source"><span>{item.publisher}</span><time dateTime={item.published_at}>{date(item.published_at)} KST</time><span>{now-Date.parse(item.published_at)>3*86400_000?'이전 소식 · ':''}Instinct AI 요약 · 원문 확인</span></div>
     <div className="discovery-news-actions"><a href={item.url} target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a>{item.row&&<button type="button" onClick={()=>onSelect(item.row!)}>종목 보기 →</button>}</div>
    </div>
   </article>
  })}</SourceReports>
  {visibleCount<fromDrive.length&&<div className="discovery-news-actions"><button type="button" onClick={()=>setVisibleCount(count=>count+4)}>뉴스 더 보기</button></div>}
 </section>
}
