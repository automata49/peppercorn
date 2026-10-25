import type {InstinctImage} from '../lib/instinctImages'
import {useEffect,useState} from 'react'
import type {LeaderRow,Market} from '../types'
import type {InsightsFeed,InsightImage} from '../lib/leaderInsights'
import {loadInstinctNews,type InstinctArticle,type InstinctVisual} from '../lib/instinctLeaderNews'
import {coverPhoto,useVisualStyle} from './VisualStyle'
import {SourceReports} from './SourceReports'
import {FilterWheel} from './FilterWheel'
import type {ReportController} from '../lib/sourceReports'
import {stockSizes,filterStockSize,type StockSize} from '../lib/stockSize'

const classes=new Set(['핵심 주도','주도 후보','강세 전환','조정 중'])
type NewsStory={
 id:string;market:'KR'|'US'|'GLOBAL';ticker?:string;trend_topic?:string;headline:string;summary:string;
 published_at:string;expires_at:string;publisher:string;url:string;image:InsightImage|null;visual?:InstinctVisual;images?:InstinctImage[];
 kind:'stock'|'trend';summary_kind:'source_excerpt'|'ai_draft'|'instinct';row?:LeaderRow;label:string
}
/** Public story coverage is independent of leader scoring; trend news never gets a made-up ticker. */
export function DiscoveryNews({reports,feed,rows,market,getClass,onSelect}:{reports:ReportController;feed:InsightsFeed|null;rows:LeaderRow[];market:Market|'ALL';getClass:(row:LeaderRow)=>string;onSelect:(row:LeaderRow)=>void}){
 const {photoStyle}=useVisualStyle()
 const [failed,setFailed]=useState<Set<string>>(()=>new Set())
 const [newsMarket,setNewsMarket]=useState<'ALL'|Market>(()=>{try{const v=localStorage.getItem('folio-news-market');return v==='KR'||v==='US'?v:market}catch{return market}})
 const [newsSize,setNewsSize]=useState<StockSize>(()=>{try{const v=localStorage.getItem('folio-news-size');return v==='small'||v==='all'||v==='etf'?v:'large'}catch{return 'large'}})
 useEffect(()=>{try{localStorage.setItem('folio-news-market',newsMarket);localStorage.setItem('folio-news-size',newsSize)}catch{}},[newsMarket,newsSize])
 const [instinct,setInstinct]=useState<InstinctArticle[]>([])
 useEffect(()=>{let active=true;void loadInstinctNews().then(items=>{if(active)setInstinct(items)});return()=>{active=false}},[])
 const now=Date.now(),lookup=new Map(rows.map(r=>[r.market+':'+r.ticker,r]))
 const visible=(m:'KR'|'US'|'GLOBAL')=>newsMarket==='ALL'||m==='GLOBAL'||newsMarket===m
 const fromDrive:NewsStory[]=instinct.flatMap((item,i)=>{
  if(!visible(item.market))return []
  const isTrend=item.type==='trend',row=!isTrend?lookup.get(item.market+':'+item.ticker):undefined
  if(!isTrend&&(!row||row.asset_class!=='Equity'||!classes.has(getClass(row))))return []
  return [{
   id:'instinct:'+i+':'+item.source_url,market:item.market,
   ...(!isTrend?{ticker:item.ticker}:{trend_topic:item.trend_topic}),
   headline:item.headline,summary:item.summary,published_at:item.published_at,
   expires_at:new Date(Date.parse(item.published_at)+7*86400_000).toISOString(),
   publisher:item.source_name,url:item.source_url,image:null,visual:item.visual,images:item.images,
   kind:isTrend?'trend' as const:'stock' as const,summary_kind:'instinct' as const,row,
   label:isTrend?item.trend_topic:(item.market==='KR'?row!.name:item.ticker)
  }]
 })
 const rss:NewsStory[]=(feed?.items||[]).flatMap(item=>{
  const row=lookup.get(item.market+':'+item.ticker)
  if(!row||!visible(item.market))return []
  return [{
   id:item.id,market:item.market,ticker:item.ticker,headline:item.headline,summary:item.summary,
   published_at:item.source.published_at,expires_at:item.expires_at,publisher:item.source.publisher,url:item.source.url,
   image:item.image,kind:'stock' as const,summary_kind:item.summary_kind,row,label:item.market==='KR'?row.name:item.ticker
  }]
 })
 const dedup=new Set<string>()
 const fresh=(arr:NewsStory[])=>arr
  .filter(item=>Date.parse(item.expires_at)>now&&now-Date.parse(item.published_at)<=7*86400_000)
  .sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))
 const unique=(arr:NewsStory[])=>arr.filter(item=>{
  const key=item.kind+':'+item.market+':'+(item.ticker||item.trend_topic)+':'+item.url
  if(dedup.has(key))return false
  dedup.add(key);return true
 })
 // Trend is allocated its own editorial space; a missing ticker never suppresses it.
 const trends=unique(fresh(fromDrive.filter(item=>item.kind==='trend'))).slice(0,2)
 const sizes=stockSizes(rows)
 const newsStock=unique(fresh([...fromDrive.filter(item=>item.kind==='stock'),...rss]))
 const stock=newsStock.filter(item=>item.row&&filterStockSize([item.row],newsSize,sizes).length>0)
 const stories=[...trends,...stock.slice(0,Math.max(0,4-trends.length))]
 // Public news remains visible; private summaries are supplied only by the account controller.
 const date=(value:string)=>new Date(value).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'})
 return <section className="discovery-news" aria-label="시장과 종목의 최신 뉴스">
  <header className="discovery-news-heading"><div><span className="journey-kicker">MARKET & COMPANIES</span><h3>시장과 기업의 새 소식</h3></div><span>뉴스 · 리포트 요약</span></header>
  <div className="catalog-carousel-layout discovery-news-filter-layout">
   <div className="catalog-filter-rails" aria-label="시장과 기업 뉴스 필터">
    <FilterWheel label="시장" value={newsMarket} onChange={v=>{setNewsMarket(v as 'ALL'|Market)}} options={[{value:'ALL',label:'전체'},{value:'KR',label:'KR'},{value:'US',label:'US'}]}/>
    <FilterWheel label="종목 분류" value={newsSize} onChange={v=>{setNewsSize(v as StockSize)}} options={[{value:'large',label:'대형주'},{value:'small',label:'중소형주'},{value:'all',label:'전체'},{value:'etf',label:'ETF'}]}/>
   </div>
  </div>
  {!reports.uid&&<p className="discovery-news-empty" role="status">로그인 후 리포트 요약과 전문도 함께 볼 수 있습니다.</p>}
  {!stories.length&&<p className="discovery-news-empty" role="status">최근 7일에 해당하는 {newsSize==='large'?'대형주':newsSize==='small'?'중소형주':newsSize==='etf'?'ETF':'전체 종목'} 뉴스가 없습니다. 다른 분류를 선택해 보세요.</p>}
  <SourceReports controller={reports} news>{stories.map(item=>{
   const image=item.image&&!failed.has(item.image.url)?item.image:null
   const linked=item.images?.find(v=>!failed.has(v.url))
   const visual=item.visual&&!failed.has(item.visual.url)?item.visual:undefined
   return <article className="discovery-news-story" role="listitem" key={item.id} data-market={item.market} data-kind={item.kind} data-image-kind={linked?.kind}>
    <figure><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={item.headline+' 원문 열기'}><img src={linked?import.meta.env.BASE_URL+linked.url:visual?import.meta.env.BASE_URL+visual.url:image?.url||coverPhoto('discover',photoStyle)} alt={linked?.caption||visual?.alt||image?.alt||''} loading="lazy" referrerPolicy="no-referrer" onError={()=>{if(linked)setFailed(old=>new Set([...old,linked.url]));else if(visual)setFailed(old=>new Set([...old,visual.url]));else if(image)setFailed(old=>new Set([...old,image.url]))}}/></a>
     <figcaption>{linked?<><span>{linked.kind==='chart'?'원문 차트':linked.kind==='illustration'?'출처 일러스트':'출처 사진'}</span><a href={linked.source_url} target="_blank" rel="noopener noreferrer">{linked.credit}</a><a href={linked.license_url} target="_blank" rel="noopener noreferrer">{linked.usage_rights}</a></>:visual?<span>{visual.credit} · 실제 기사 사진 아님</span>:image?<><span>{image.kind==='original'?'원문 사진':'관련 사진 · 원문 사진 아님'}</span><a href={image.page_url} target="_blank" rel="noopener noreferrer">{image.creator}</a><a href={image.license_url} target="_blank" rel="noopener noreferrer">{image.license}</a></>:<span>Folio 이미지 · 원문 사진 아님</span>}</figcaption>
    </figure>
    <div className="discovery-news-copy">
     <span className="discovery-news-instrument">{item.kind==='trend'?<><span className="discovery-news-trend-tag">TREND</span> {item.label} · {item.market==='GLOBAL'?'GLOBAL':item.market}</>:<>{item.label} · {item.summary_kind==='instinct'&&item.row?getClass(item.row)+' · ':''}{item.row?.industry||item.row?.sector||item.market}</>}</span>
     <h4><a href={item.url} target="_blank" rel="noopener noreferrer">{item.headline}</a></h4>
     {item.summary&&<p>{item.summary}</p>}
     <div className="discovery-news-source"><span>{item.publisher}</span><time dateTime={item.published_at}>{date(item.published_at)} KST</time><span>{now-Date.parse(item.published_at)>3*86400_000?'이전 소식 · ':''}{item.summary_kind==='instinct'?'Instinct AI 요약 · 원문 확인':item.summary_kind==='ai_draft'?'AI 요약 초안':'원문 제목'}</span></div>
     <div className="discovery-news-actions"><a href={item.url} target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a>{item.row&&<button type="button" onClick={()=>onSelect(item.row!)}>종목 보기 →</button>}</div>
    </div>
   </article>
  })}</SourceReports>
 </section>
}
