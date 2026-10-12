import registry from '../../config/leader-sources.json' with { type: 'json' }

export type InsightImage = {url:string;page_url:string;license:string;license_url:string;creator:string;kind:'original'|'related';permission_url?:string;alt:string}
export type LeaderInsight = {
 id:string;market:'KR'|'US';ticker:string;headline:string;summary:string;summary_kind:'source_excerpt'|'ai_draft';
 collected_at:string;expires_at:string;generated_at?:string;model?:string;prompt_version?:string;evidence?:string;
 source:{id:string;url:string;title:string;publisher:string;published_at:string};image:InsightImage|null;
}
export type InsightsFeed = {version:1;published_at:string;ai_status:'enabled'|'not_configured'|'unavailable';items:LeaderInsight[]}
const maxAge=48*3600_000, articleAge=14*86400_000
const licenses=new Set(['CC BY 4.0','CC BY-SA 4.0','CC BY 3.0','CC BY-SA 3.0','CC BY 2.0','CC BY-SA 2.0','CC BY 2.5','CC BY-SA 2.5','CC0','Public domain'])
type Permission={license:string;creator:string;license_url:string;evidence_url:string;image_hosts:string[]}
function url(value:unknown,hosts:string[]){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&hosts.includes(u.hostname)?u:null}catch{return null}}
const text=(value:unknown,max:number)=>typeof value==='string'&&value.length>0&&value.length<=max
const date=(value:unknown)=>typeof value==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN
/** Fail closed: a public feed must never override rankings, identities or user records. */
export function parseInsights(value:unknown,now=Date.now()):InsightsFeed|null {
 if(!value||typeof value!=='object')return null
 const p=value as Record<string,unknown>,published=date(p.published_at)
 if(p.version!==1||!['enabled','not_configured','unavailable'].includes(String(p.ai_status))||!(now-published>=-3600_000&&now-published<=maxAge)||!Array.isArray(p.items)||p.items.length>20)return null
 const items:LeaderInsight[]=[]
 const seen=new Set<string>()
 for(const raw of p.items){
  if(!raw||typeof raw!=='object')continue
  const i=raw as LeaderInsight,config=registry.sources.find(c=>c.market===i.market&&c.ticker===i.ticker)
  if(!config||!i.source||!text(i.headline,70)||typeof i.summary!=='string'||i.summary.length>180||!text(i.id,120)||!text(i.source.id,40)||!text(i.source.title,120)||i.source.publisher!==config.publisher)continue
  const publishedAt=date(i.source.published_at),collected=date(i.collected_at),expires=date(i.expires_at)
  if(!(now-publishedAt>=-3600_000&&now-publishedAt<=articleAge&&now-collected>=-3600_000&&now-collected<=maxAge&&expires>now&&expires<=collected+maxAge&&expires<=publishedAt+articleAge))continue
  if(!url(i.source.url,[new URL(config.feed).hostname]))continue
  if(i.summary_kind==='ai_draft'){
   if(!['gemini-3.5-flash-lite','gemini-2.5-flash-lite'].includes(String(i.model))||i.prompt_version!=='folio-news-1'||!text(i.evidence,100)||i.evidence!.length<8||!text(i.summary,180)||!(date(i.generated_at)<=now+3600_000&&date(i.generated_at)>=publishedAt))continue
  }else if(i.summary_kind!=='source_excerpt')continue
  let image:InsightImage|null=null
  const candidate=i.image
  // Original reuse requires a separately reviewed permission config, absent in the initial registry.
  if(candidate&&text(candidate.creator,180)&&text(candidate.alt,180)){
   const normalized=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
   const related=config.image_terms.some(term=>/^[A-Za-z0-9]{1,3}$/.test(term)?candidate.alt.replaceAll('_',' ').split(/[^A-Za-z0-9]+/).some(word=>word.toLowerCase()===term.toLowerCase()):normalized(candidate.alt).includes(normalized(term)))
   if(candidate.kind==='related'&&licenses.has(candidate.license)&&url(candidate.license_url,['creativecommons.org','commons.wikimedia.org'])&&url(candidate.url,['upload.wikimedia.org','thumb.wikimedia.org'])&&url(candidate.page_url,['commons.wikimedia.org'])&&related)image=candidate
   const permission=(config as typeof config&{image_permission?:Permission}).image_permission
   if(candidate.kind==='original'&&permission&&(licenses.has(candidate.license)||candidate.license==='Publisher permission')&&candidate.page_url===i.source.url&&candidate.permission_url===permission.evidence_url&&candidate.license===permission.license&&candidate.license_url===permission.license_url&&candidate.creator===permission.creator&&url(permission.license_url,['creativecommons.org',new URL(config.feed).hostname])&&url(permission.evidence_url,[new URL(config.feed).hostname])&&url(candidate.url,permission.image_hosts.filter(h=>registry.sources.some(c=>new URL(c.feed).hostname===h))))image=candidate
  }
  const identity=`${i.market}:${i.ticker}`
  if(seen.has(identity))continue
  seen.add(identity);items.push({...i,image})
 }
 return {version:1,published_at:p.published_at as string,ai_status:p.ai_status as InsightsFeed['ai_status'],items}
}
export async function loadLeaderInsights():Promise<InsightsFeed|null>{
 const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),8000)
 try{const response=await fetch(import.meta.env.BASE_URL+'data/leader-insights.json',{signal:controller.signal,cache:'no-cache'});if(!response.ok)return null
  if(Number(response.headers.get('content-length')||0)>100_000)return null
  const body=await response.text();return body.length<=100_000?parseInsights(JSON.parse(body)):null
 }catch{return null}finally{window.clearTimeout(timeout)}
}
