import {parseInstinctImages,type InstinctImage} from './instinctImages'
/** Sanitized public news from Instinct Drive exports; private PDFs never reach the browser. */
export type InstinctVisual = {
 kind:'illustration';url:string;alt:string;
 credit:'AI 생성 개념 일러스트'|'Folio 편집 일러스트';topic:string
}
type Common={
 headline:string;summary:string;source_name:string;source_url:string;
 published_at:string;visual?:InstinctVisual;images?:InstinctImage[]
}
export type StockNews = Common & {type?:'stock';market:'KR'|'US';ticker:string}
export type TrendNews = Common & {type:'trend';market:'KR'|'US'|'GLOBAL';trend_topic:string}
export type InstinctArticle = StockNews|TrendNews
export type InstinctNewsFeed={version:1;updated_at:string;items:InstinctArticle[]}
const topics=new Set(['semiconductor','ai','energy','industry','finance','health','other'])
const limitAge=7*86400_000
const validDate=(v:unknown)=>typeof v==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))
const text=(v:unknown,min:number,max:number)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max
function readVisual(input:unknown):InstinctVisual|undefined{
 if(!input||typeof input!=='object')return undefined
 const v=input as Record<string,unknown>
 if(v.kind!=='illustration'||typeof v.url!=='string'||!/^data\/news-assets\/[a-f0-9]{20}\.(svg|webp)$/.test(v.url))return undefined
 if(!text(v.alt,10,150)||!String(v.alt).includes('실제 기사 사진 아님'))return undefined
 if(v.credit!=='AI 생성 개념 일러스트'&&v.credit!=='Folio 편집 일러스트')return undefined
 if(!topics.has(String(v.topic)))return undefined
 return {kind:'illustration',url:v.url,alt:String(v.alt),credit:v.credit,topic:String(v.topic)}
}
function publicArticleUrl(value:unknown){
 if(typeof value!=='string'||value.length>2048)return false
 try{
  const u=new URL(value)
  if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')return false
  const host=u.hostname.toLowerCase()
  return host.includes('.')&&!host.endsWith('.local')&&!host.endsWith('.internal')&&
   host!=='localhost'&&!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)&&
   !host.startsWith('[')&&!['drive.google.com','docs.google.com','files.instinct.com'].includes(host)
 }catch{return false}
}
export function parseInstinctNews(value:unknown,now=Date.now()):InstinctNewsFeed|null{
 if(!value||typeof value!=='object')return null
 const feed=value as Record<string,unknown>
 if(feed.version!==1||!validDate(feed.updated_at)||!Array.isArray(feed.items)||feed.items.length>60)return null
 const items:InstinctArticle[]=[]
 const seen=new Set<string>()
 for(const raw of feed.items){
  if(!raw||typeof raw!=='object')continue
  const r=raw as Record<string,unknown>
  if(!text(r.headline,5,120)||!text(r.summary,10,320)||!text(r.source_name,2,100)||!publicArticleUrl(r.source_url)||!validDate(r.published_at))continue
  const age=now-Date.parse(r.published_at as string)
  if(age< -3600_000||age>limitAge)continue
  const common={
   headline:String(r.headline),summary:String(r.summary),source_name:String(r.source_name),
   source_url:String(r.source_url),published_at:String(r.published_at),
   images:parseInstinctImages(r.images),
   ...(readVisual(r.visual)?{visual:readVisual(r.visual)}:{})
  }
  let item:InstinctArticle
  if(r.type==='trend'){
   if(!['KR','US','GLOBAL'].includes(String(r.market))||!text(r.trend_topic,3,80))continue
   item={...common,type:'trend',market:r.market as TrendNews['market'],trend_topic:String(r.trend_topic)}
  }else{
   if(r.type!==undefined&&r.type!=='stock')continue
   if(r.market!=='KR'&&r.market!=='US')continue
   if(typeof r.ticker!=='string'||!(r.market==='KR'?/^\d{6}$/.test(r.ticker):/^[A-Z][A-Z0-9.-]{0,11}$/.test(r.ticker)))continue
   item={...common,market:r.market,ticker:r.ticker}
  }
  const key=(item.type==='trend'?'trend:'+item.trend_topic:'stock:'+item.ticker)+':'+item.market+':'+item.source_url
  if(seen.has(key))continue
  seen.add(key);items.push(item)
 }
 return {version:1,updated_at:String(feed.updated_at),items:items.sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))}
}
export async function loadInstinctNews():Promise<InstinctArticle[]>{
 const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),8000)
 try{
  const response=await fetch(import.meta.env.BASE_URL+'data/instinct-leader-news.json',{signal:controller.signal,cache:'no-cache'})
  if(!response.ok||Number(response.headers.get('content-length')||0)>1_000_000)return []
  const body=await response.text()
  return body.length<=1_000_000?(parseInstinctNews(JSON.parse(body))?.items||[]):[]
 }catch{return []}finally{window.clearTimeout(timer)}
}
