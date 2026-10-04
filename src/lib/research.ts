import {ensureSession,type Session} from './session'

const BASE='https://mhbcchegrbakearqptdr.supabase.co/functions/v1'
const CAPTURE_PREFIX='pepper-capture:'

export type ResearchFeedItem={
  id:string;source:string;source_key:string;external_id:string;source_url:string;linked_url:string|null;linked_type:string|null;
  title:string;excerpt:string|null;published_at:string|null;discovered_at:string
}
export type ResearchCapture={
  id:string;feed_item_id:string|null;source_url:string;title:string;source_type:string;captured_text:string;content_hash:string;
  analysis_status:'provider_unavailable'|'pending'|'ready'|'error';analysis:unknown;captured_at:string;updated_at:string
}
export type CaptureDraft={feed_item_id?:string|null;source_url:string;title:string;captured_text:string}

async function request(session:Session,init:RequestInit={}){
  const active=await ensureSession(session)
  const res=await fetch(BASE+'/research-capture',{...init,headers:{Authorization:'Bearer '+active.access_token,'Content-Type':'application/json',...(init.headers||{})}})
  const payload=await res.json().catch(()=>({}))
  if(!res.ok)throw new Error(String(payload?.error||'research_request_failed'))
  return {active,payload}
}
export async function loadResearchInbox(session:Session){
  const {active,payload}=await request(session)
  return {session:active,feed:(payload.feed||[]) as ResearchFeedItem[],captures:(payload.captures||[]) as ResearchCapture[]}
}
export async function saveResearchCapture(session:Session,draft:CaptureDraft){
  const {active,payload}=await request(session,{method:'POST',body:JSON.stringify(draft)})
  return {session:active,capture:payload.capture as ResearchCapture}
}
export async function deleteResearchCapture(session:Session,id:string){
  const active=await ensureSession(session)
  const res=await fetch(BASE+'/research-capture?id='+encodeURIComponent(id),{method:'DELETE',headers:{Authorization:'Bearer '+active.access_token}})
  const payload=await res.json().catch(()=>({}))
  if(!res.ok)throw new Error(String(payload?.error||'research_delete_failed'))
  return {session:active}
}

export function saveToPepperBookmarklet(appUrl=location.origin+location.pathname){
  const target=new URL(appUrl)
  target.search='';target.hash='';target.searchParams.set('capture','1')
  const destination=JSON.stringify(target.toString()),targetOrigin=JSON.stringify(target.origin)
  return `javascript:(()=>{try{const p={url:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,200000)};const w=window.open(${destination},'pepper_capture');if(!w)throw new Error('popup');let n=0;let t;const ack=e=>{if(e.origin===${targetOrigin}&&e.data&&e.data.type==='pepper-capture-ack'){clearInterval(t);removeEventListener('message',ack)}};addEventListener('message',ack);const send=()=>{try{w.postMessage({type:'pepper-capture',payload:p},${targetOrigin})}catch(e){}if(++n>=15){clearInterval(t);removeEventListener('message',ack)}};t=setInterval(send,400);send()}catch(e){alert('Save to Pepper failed')}})()`
}

export function draftFromCaptureMessage(data:unknown,origin:string):CaptureDraft|null{
  try{
    const envelope=data as {type?:unknown;payload?:any}
    if(envelope?.type!=='pepper-capture')return null
    const raw=envelope.payload||{},source_url=String(raw.url||'').trim(),title=String(raw.title||'').trim().slice(0,500),captured_text=String(raw.text||'').trim().slice(0,200000)
    if(!source_url.startsWith('https://')||!captured_text)return null
    if(new URL(source_url).origin!==origin)return null
    return {source_url,title,captured_text}
  }catch{return null}
}

export function clearCaptureRequest(){
  const params=new URLSearchParams(location.search)
  if(params.get('capture')!=='1')return
  params.delete('capture');const query=params.toString()
  history.replaceState(history.state,'',location.pathname+(query?'?'+query:'')+location.hash)
}
