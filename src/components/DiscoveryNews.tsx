import {useState} from 'react'
import type {LeaderRow,Market} from '../types'
import type {InsightsFeed,LeaderInsight} from '../lib/leaderInsights'
import {coverPhoto,useVisualStyle} from './VisualStyle'

/** Public, validated issuer news; independent of screening/RS ordering and private notebooks. */
export function DiscoveryNews({feed,rows,market,onSelect}:{feed:InsightsFeed|null;rows:LeaderRow[];market:Market|'ALL';onSelect:(row:LeaderRow)=>void}){
 const {photoStyle}=useVisualStyle()
 const [failed,setFailed]=useState<Set<string>>(()=>new Set())
 const now=Date.now(),rowByKey=new Map(rows.map(r=>[r.market+':'+r.ticker,r]))
 const stories=(feed?.items||[]).filter(item=>(market==='ALL'||item.market===market)&&rowByKey.has(item.market+':'+item.ticker)&&Date.parse(item.expires_at)>now&&now-Date.parse(item.source.published_at)<=7*86400_000).slice().sort((a,b)=>Date.parse(b.source.published_at)-Date.parse(a.source.published_at)).slice(0,4)
 if(!stories.length)return null
 const date=(item:LeaderInsight)=>new Date(item.source.published_at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'})
 return <section className="discovery-news" aria-label="시장과 종목의 최신 뉴스">
  <header className="discovery-news-heading"><div><span className="journey-kicker">MARKET & COMPANIES</span><h3>시장과 기업의 새 소식</h3></div><span>최근 7일 · 공식 뉴스룸</span></header>
  <div className="discovery-news-stories" role="list">{stories.map(item=>{
   const row=rowByKey.get(item.market+':'+item.ticker)!,image=item.image&&!failed.has(item.image.url)?item.image:null
   return <article className="discovery-news-story" role="listitem" key={item.id} data-market={item.market}>
    <figure><a href={item.source.url} target="_blank" rel="noopener noreferrer" aria-label={`${item.headline} 원문 열기`}><img src={image?.url||coverPhoto('discover',photoStyle)} alt={image?.alt||''} loading="lazy" referrerPolicy="no-referrer" onError={()=>{if(image)setFailed(old=>new Set([...old,image.url]))}}/></a>
     <figcaption>{image?<><span>{image.kind==='original'?'원문 사진':'관련 사진 · 원문 사진 아님'}</span><a href={image.page_url} target="_blank" rel="noopener noreferrer">{image.creator}</a><a href={image.license_url} target="_blank" rel="noopener noreferrer">{image.license}</a></>:<span>Folio 이미지 · 원문 사진 아님</span>}</figcaption>
    </figure>
    <div className="discovery-news-copy"><span className="discovery-news-instrument">{item.market==='KR'?row.name:item.ticker} · {row.industry||row.sector||item.market}</span>
     <h4><a href={item.source.url} target="_blank" rel="noopener noreferrer">{item.headline}</a></h4>
     {item.summary&&<p>{item.summary}</p>}
     <div className="discovery-news-source"><span>{item.source.publisher}</span><time dateTime={item.source.published_at}>{date(item)} KST</time><span>{now-Date.parse(item.source.published_at)>3*86400_000?'이전 소식 · ':''}{item.summary_kind==='ai_draft'?'AI 요약 초안':'원문 제목'}</span></div>
     <div className="discovery-news-actions"><a href={item.source.url} target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a><button type="button" onClick={()=>onSelect(row)}>종목 보기 →</button></div>
    </div>
   </article>
  })}</div>
 </section>
}
