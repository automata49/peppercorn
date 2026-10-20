import {useEffect,useState} from 'react'
import type {LeaderRow,Market} from '../types'
import type {InsightsFeed,InsightImage} from '../lib/leaderInsights'
import {loadInstinctNews,type InstinctArticle,type InstinctVisual} from '../lib/instinctLeaderNews'
import {coverPhoto,useVisualStyle} from './VisualStyle'
import {SourceReports} from './SourceReports'
import type {ReportController} from '../lib/sourceReports'
import {stockSizes,filterStockSize,type StockSize} from '../lib/stockSize'

const classes=new Set(['핵심 주도','주도 후보','강세 전환','조정 중'])
type NewsStory={
 id:string;market:'KR'|'US'|'GLOBAL';ticker?:string;trend_topic?:string;headline:string;summary:string;
 published_at:string;expires_at:string;publisher:string;url:string;image:InsightImage|null;visual?:InstinctVisual;
 kind:'stock'|'trend';summary_kind:'source_excerpt'|'ai_draft'|'instinct';row?:LeaderRow;label:string
}
/** Public story coverage is independent of leader scoring; trend news never gets a made-up ticker. */
export function DiscoveryNews({reports,feed,rows,market,getClass,onSelect}:{reports:ReportController;feed:InsightsFeed|null;rows:LeaderRow[];market:Market|'ALL';getClass:(row:LeaderRow)=>string;onSelect:(row:LeaderRow)=>void}){
 const {photoStyle}=useVisualStyle()
 const [failed,setFailed]=useState<Set<string>>(()=>new Set())
 // A signed-in user's PDF research reports are the default editorial view.
 const [newsTab,setNewsTab]=useState<'reports'|Extract<StockSize,'large'|'small'|'all'>>('reports')
 const [instinct,setInstinct]=useState<InstinctArticle[]>([])
 useEffect(()=>{let active=true;void loadInstinctNews().then(items=>{if(active)setInstinct(items)});return()=>{active=false}},[])
 const now=Date.now(),lookup=new Map(rows.map(r=>[r.market+':'+r.ticker,r]))
 const visible=(m:'KR'|'US'|'GLOBAL')=>market==='ALL'||m==='GLOBAL'||market===m
 const fromDrive:NewsStory[]=instinct.flatMap((item,i)=>{
  if(!visible(item.market))return []
  const isTrend=item.type==='trend',row=!isTrend?lookup.get(item.market+':'+item.ticker):undefined
  if(!isTrend&&(!row||row.asset_class!=='Equity'||!classes.has(getClass(row))))return []
  return [{
   id:'instinct:'+i+':'+item.source_url,market:item.market,
   ...(!isTrend?{ticker:item.ticker}:{trend_topic:item.trend_topic}),
   headline:item.headline,summary:item.summary,published_at:item.published_at,
   expires_at:new Date(Date.parse(item.published_at)+7*86400_000).toISOString(),
   publisher:item.source_name,url:item.source_url,image:null,visual:item.visual,
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
 const stock=newsStock.filter(item=>item.row&&filterStockSize([item.row],newsTab==='reports'?'large':newsTab,sizes).length>0)
 const stories=[...trends,...stock.slice(0,Math.max(0,4-trends.length))]
 if(!stories.length&&!newsStock.length&&!reports.uid)return null
 const date=(value:string)=>new Date(value).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'})
 return <section className="discovery-news" aria-label="시장과 종목의 최신 뉴스">
  <header className="discovery-news-heading"><div><span className="journey-kicker">MARKET & COMPANIES</span><h3>시장과 기업의 새 소식</h3></div><span>{newsTab==='reports'?'Google Drive · PDF 리포트':'최근 7일 · 출처 확인'}</span></header>
  <div className="discovery-news-size" role="group" aria-label="MARKET & COMPANIES 종목 규모">
   {([['reports','리포트'],['large','대형주'],['small','중소형주'],['all','전체']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={newsTab===value} onClick={()=>setNewsTab(value)}>{label}</button>)}
  </div>
  {newsTab==='reports'?<div className="discovery-news-report-content">
   {!reports.uid?<p className="discovery-news-empty" role="status">로그인 후 Folio 리서치 리포트를 볼 수 있습니다.</p>:!reports.items.length&&!reports.error?<p className="discovery-news-empty" role="status">등록된 리서치 리포트가 없습니다.</p>:<SourceReports controller={reports}/>}
  </div>:<>
  {!stories.length&&<p className="discovery-news-empty" role="status">최근 7일에 해당하는 {newsTab==='large'?'대형주':newsTab==='small'?'중소형주':'전체 종목'} 뉴스가 없습니다. 다른 분류를 선택해 보세요.</p>}
  <div className="discovery-news-stories" role="list">{stories.map(item=>{
   const image=item.image&&!failed.has(item.image.url)?item.image:null
   const visual=item.visual&&!failed.has(item.visual.url)?item.visual:undefined
   return <article className="discovery-news-story" role="listitem" key={item.id} data-market={item.market} data-kind={item.kind}>
    <figure><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={item.headline+' 원문 열기'}><img src={visual?import.meta.env.BASE_URL+visual.url:image?.url||coverPhoto('discover',photoStyle)} alt={visual?.alt||image?.alt||''} loading="lazy" referrerPolicy="no-referrer" onError={()=>{if(visual)setFailed(old=>new Set([...old,visual.url]));else if(image)setFailed(old=>new Set([...old,image.url]))}}/></a>
     <figcaption>{visual?<span>{visual.credit} · 실제 기사 사진 아님</span>:image?<><span>{image.kind==='original'?'원문 사진':'관련 사진 · 원문 사진 아님'}</span><a href={image.page_url} target="_blank" rel="noopener noreferrer">{image.creator}</a><a href={image.license_url} target="_blank" rel="noopener noreferrer">{image.license}</a></>:<span>Folio 이미지 · 원문 사진 아님</span>}</figcaption>
    </figure>
    <div className="discovery-news-copy">
     <span className="discovery-news-instrument">{item.kind==='trend'?<><span className="discovery-news-trend-tag">TREND</span> {item.label} · {item.market==='GLOBAL'?'GLOBAL':item.market}</>:<>{item.label} · {item.summary_kind==='instinct'&&item.row?getClass(item.row)+' · ':''}{item.row?.industry||item.row?.sector||item.market}</>}</span>
     <h4><a href={item.url} target="_blank" rel="noopener noreferrer">{item.headline}</a></h4>
     {item.summary&&<p>{item.summary}</p>}
     <div className="discovery-news-source"><span>{item.publisher}</span><time dateTime={item.published_at}>{date(item.published_at)} KST</time><span>{now-Date.parse(item.published_at)>3*86400_000?'이전 소식 · ':''}{item.summary_kind==='instinct'?'Instinct AI 요약 · 원문 확인':item.summary_kind==='ai_draft'?'AI 요약 초안':'원문 제목'}</span></div>
     <div className="discovery-news-actions"><a href={item.url} target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a>{item.row&&<button type="button" onClick={()=>onSelect(item.row!)}>종목 보기 →</button>}</div>
    </div>
   </article>
  })}</div></>}
 </section>
}
