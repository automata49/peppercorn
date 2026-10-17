/** Public editorial summaries exported from explicitly named Instinct news files.
 * Never read Google Drive from the browser or publish source PDFs.
 */
export type InstinctArticle={
 market:'KR'|'US';ticker:string;headline:string;summary:string;
 source_name:string;source_url:string;published_at:string
}
export type InstinctNewsFeed={version:1;updated_at:string;items:InstinctArticle[]}
const limitAge=7*86400_000
const validDate=(v:unknown)=>typeof v==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))
const text=(v:unknown,min:number,max:number)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max
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
  const r=raw as InstinctArticle
  if(r.market!=='KR'&&r.market!=='US')continue
  if(typeof r.ticker!=='string'||!(r.market==='KR'?/^\d{6}$/.test(r.ticker):/^[A-Z][A-Z0-9.-]{0,11}$/.test(r.ticker)))continue
  if(!text(r.headline,5,120)||!text(r.summary,10,320)||!text(r.source_name,2,100)||!publicArticleUrl(r.source_url)||!validDate(r.published_at))continue
  const age=now-Date.parse(r.published_at)
  if(age < -3600_000||age>limitAge)continue
  const key=r.market+':'+r.ticker+':'+r.source_url
  if(seen.has(key))continue
  seen.add(key);items.push(r)
 }
 return {version:1,updated_at:feed.updated_at as string,items:items.sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))}
}
export async function loadInstinctNews():Promise<InstinctArticle[]>{
 const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),8000)
 try{
  const result=await fetch(import.meta.env.BASE_URL+'data/instinct-leader-news.json',{signal:controller.signal,cache:'no-cache'})
  if(!result.ok||Number(result.headers.get('content-length')||0)>100_000)return []
  const data=await result.text()
  return data.length<=100_000?(parseInstinctNews(JSON.parse(data))?.items||[]):[]
 }catch{return []}finally{window.clearTimeout(timer)}
}
