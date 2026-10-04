import { ensureSession, type Session } from './session'

const BASE='https://mhbcchegrbakearqptdr.supabase.co/functions/v1'
export const CAPTURE_MESSAGE='pepper-research-capture-v1'

export type ResearchDraft={
  source_kind:'manual_capture'|'bookmarklet'|'file_upload'
  source_name:string
  source_url:string
  title:string
  content:string
  published_at?:string|null
  metadata?:Record<string,string|number|boolean|null>
}

export type ExternalResearchItem=ResearchDraft&{
  id:string
  captured_at:string
  analysis_status:'pending'|'provider_unavailable'|'analyzed'|'error'|'archived'
  analysis:Record<string,unknown>|null
  created_at:string
  updated_at:string
}

async function request(session:Session,init:RequestInit={}){
  const active=await ensureSession(session)
  const res=await fetch(BASE+'/research-ingest',{...init,headers:{Authorization:'Bearer '+active.access_token,'Content-Type':'application/json',...(init.headers||{})}})
  const payload=await res.json().catch(()=>({}))
  if(!res.ok)throw new Error(String(payload?.error||'research_ingest_failed'))
  return {session:active,payload}
}

export async function loadExternalResearch(session:Session){
  const {session:active,payload}=await request(session)
  return {session:active,rows:(payload?.rows||[]) as ExternalResearchItem[]}
}

export async function saveExternalResearch(session:Session,draft:ResearchDraft){
  const {session:active,payload}=await request(session,{method:'POST',body:JSON.stringify(draft)})
  return {session:active,row:payload?.row as ExternalResearchItem}
}

export function draftFromMessage(event:MessageEvent):ResearchDraft|null{
  const data=event.data
  if(!data||data.type!==CAPTURE_MESSAGE||typeof data.source_url!=='string'||typeof data.title!=='string'||typeof data.content!=='string')return null
  let url:URL
  try{url=new URL(data.source_url)}catch{return null}
  if(url.protocol!=='https:'||url.origin!==event.origin)return null
  const content=data.content.replace(/\u0000/g,'').trim().slice(0,120000)
  if(!content)return null
  return {source_kind:'bookmarklet',source_name:String(data.source_name||url.hostname).slice(0,160),source_url:url.href.slice(0,2048),title:data.title.trim().slice(0,500)||url.hostname,content,metadata:{capture_origin:event.origin,selection:!!data.selection}}
}

export function buildBookmarklet(targetHref=window.location.href){
  const target=new URL('./?capture=1',targetHref)
  const origin=target.origin
  const code=`(()=>{const s=window.getSelection?String(window.getSelection()).trim():'';const n=document.querySelector('article')||document.querySelector('main')||document.querySelector('[role="main"]');const c=(s||(n&&n.innerText)||'').trim();if(!c){alert('저장할 본문을 찾지 못했습니다. 필요한 텍스트를 선택한 뒤 다시 실행하세요.');return}const w=window.open(${JSON.stringify(target.href)},'pepper-save');if(!w)return;const p={type:${JSON.stringify(CAPTURE_MESSAGE)},source_url:location.href,title:document.title,content:c.slice(0,120000),source_name:location.hostname,selection:!!s};let i=0;const t=setInterval(()=>{try{w.postMessage(p,${JSON.stringify(origin)})}catch{}if(++i>=20)clearInterval(t)},500)})()`
  return 'javascript:'+code
}
