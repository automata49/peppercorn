import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { ensureSession, loadStoredSession, type Session } from './session'
export type InkPoint={x:number;y:number;pressure?:number;color?:'ink'|'blue'|'red'|'green'|'yellow';size?:number;tool?:'pen'|'pencil'|'highlighter'}
export type InkStroke=InkPoint[]
export type NotebookNote={body:JSONContent;text:string;ink:InkStroke[];photos:string[];paper?:'plain'|'ruled'|'grid'}
export type Reflection={judgement?:string;previousJudgement?:string;trigger?:string;nextReviewDate?:string;note?:NotebookNote;at:string;outcome:'maintain'|'revise'|'close';result:string;lesson:string;nextAction:string}
export type EntrySnapshot={paper?:'plain'|'ruled'|'grid';title:string;body:JSONContent;text:string;question:string;answer:string;hypothesis?:string;counterEvidence?:string;reflections?:Reflection[];photo?:string;photos?:string[];ink:InkStroke[];kind:'life'|'investment';ticker:string;reviewDate:string;place:string;expense:string;currency:string}
export type JournalEntry=EntrySnapshot&{id:string;createdAt:string;updatedAt:string;revisions:{at:string;snapshot:EntrySnapshot}[]}
export const questions=[
 '오늘 새롭게 발견한 것은 무엇인가요?',
 '현재 가격이 정당화되려면 무엇이 실현되어야 할까요?',
 '내 판단을 가장 강하게 반박하는 증거는 무엇인가요?',
 '내 매수가를 모른다면 오늘도 같은 판단을 할까요?',
 '다른 결과는 무엇이며, 각각 얼마나 가능할까요?',
 '결과를 보기 전에도 좋은 결정이었다고 평가할 수 있나요?'
]
export const blankSnapshot=():EntrySnapshot=>({title:'',body:{type:'doc',content:[{type:'paragraph'}]},text:'',question:questions[0],answer:'',hypothesis:'',counterEvidence:'',photos:[],ink:[],kind:'life',ticker:'',reviewDate:'',place:'',expense:'',currency:'KRW'})
export const snapshot=(e:EntrySnapshot):EntrySnapshot=>({...((e.paper)?{paper:e.paper}:{}),title:e.title,body:e.body,text:e.text,question:e.question,answer:e.answer,hypothesis:e.hypothesis||'',counterEvidence:e.counterEvidence||'',...(e.reflections?.length?{reflections:e.reflections}:{}),photo:e.photo,photos:e.photos||[],ink:e.ink,kind:e.kind,ticker:e.ticker,reviewDate:e.reviewDate,place:e.place,expense:e.expense,currency:e.currency})
export const entryPhotos=(e:EntrySnapshot):string[]=>e.photos?.length?e.photos:e.photo?[e.photo]:[]
let database:Promise<IDBDatabase>|undefined
function db(){
 return database??=new Promise<IDBDatabase>((resolve,reject)=>{
  const r=indexedDB.open('folio-lifetime-journal',1)
  r.onupgradeneeded=()=>r.result.createObjectStore('notebooks')
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>{database=undefined;reject(r.error)}
 })
}
async function read(scope:string):Promise<JournalEntry[]>{const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('notebooks').objectStore('notebooks').get(scope);r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
// One read/write transaction merges only changed records: other tabs cannot lose unrelated pages.
async function write(scope:string,updates:JournalEntry[],importOnly=false){
 const d=await db();return new Promise<JournalEntry[]>((resolve,reject)=>{
  const t=d.transaction('notebooks','readwrite'),store=t.objectStore('notebooks'),r=store.get(scope)
  let result:JournalEntry[]=[],failure:Error|undefined
  r.onsuccess=()=>{
   try{
    const current:JournalEntry[]=r.result||[],merged=new Map(current.map(e=>[e.id,e]))
    for(const entry of updates){
     const existing=merged.get(entry.id)
     if(existing&&(importOnly||JSON.stringify(existing)===JSON.stringify(entry)))continue
     if(existing&&entry.revisions.at(-1)?.at!==existing.updatedAt)throw Error('다른 창에서 이 기록이 변경되었습니다. 현재 글을 복사한 뒤 다시 열어주세요.')
     merged.set(entry.id,entry)
    }
    result=[...merged.values()]
    if(result.length>1000||new Blob([JSON.stringify({format:'folio-journal',version:1,entries:result},null,2)]).size>18000000)throw Error('저널 저장 한도에 도달했습니다. 백업을 내보내고 사진 크기를 줄여주세요.')
    store.put(result,scope)
    if(scope!=='guest'){const pendingRequest=store.get(scope+'::pending');pendingRequest.onsuccess=()=>{const pending:Record<string,JournalEntry>=pendingRequest.result||{};for(const entry of updates){if(!importOnly||!current.some(e=>e.id===entry.id))pending[entry.id]=entry}store.put(pending,scope+'::pending')}}
   }catch(e){failure=e as Error;t.abort()}
  }
  t.oncomplete=()=>resolve(result);t.onerror=()=>reject(failure||t.error);t.onabort=()=>reject(failure||t.error)
 })
}
const notebookEndpoint='https://mhbcchegrbakearqptdr.supabase.co/functions/v1/notebook'
export async function notebookRequest(session:Session,updates?:JournalEntry[]){
 const active=await ensureSession(session)
 if(loadStoredSession()?.user.id!==session.user.id)throw Error('계정이 변경되었습니다.')
 const response=await fetch(notebookEndpoint,{method:updates?'POST':'GET',headers:{Authorization:'Bearer '+active.access_token,...(updates?{'Content-Type':'application/json'}:{})},...(updates?{body:JSON.stringify({entries:updates})}:{}),signal:AbortSignal.timeout(30000)})
 const payload=await response.json().catch(()=>({}))
 if(!response.ok)throw Error(response.status===409?'다른 기기에서 이 기록이 변경되었습니다. 현재 글은 기기에 보관했습니다. 백업을 내보낸 뒤 최신 기록과 비교해주세요.':'기기에 저장했습니다. 계정 동기화를 완료하지 못했습니다. 연결 후 다시 시도하세요.')
 return parseNotebook(JSON.stringify({format:'folio-journal',version:1,entries:payload.entries||[]}))
}
// Merge under one IDB transaction so an in-flight pull cannot overwrite a new local edit.
async function mergeCloud(scope:string,remote:JournalEntry[],acknowledged:JournalEntry[]=[]){
 const d=await db()
 return new Promise<JournalEntry[]>((resolve,reject)=>{
  const t=d.transaction('notebooks','readwrite'),store=t.objectStore('notebooks'),localRequest=store.get(scope),pendingRequest=store.get(scope+'::pending')
  let result:JournalEntry[]=[]
  pendingRequest.onsuccess=()=>{
   const local:JournalEntry[]=localRequest.result||[],pending:Record<string,JournalEntry>=pendingRequest.result||{}
   for(const entry of acknowledged)if(JSON.stringify(pending[entry.id])===JSON.stringify(entry))delete pending[entry.id]
   const merged=new Map(local.map(e=>[e.id,e]))
   for(const entry of remote)if(!pending[entry.id])merged.set(entry.id,entry)
   result=[...merged.values()];store.put(result,scope);store.put(pending,scope+'::pending')
  }
  t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)
 })
}
function equalEntries(a:JournalEntry,b:JournalEntry){
 const clean=(entry:JournalEntry)=>parseNotebook(JSON.stringify({format:'folio-journal',version:1,entries:[entry]}))[0]
 return JSON.stringify(clean(a))===JSON.stringify(clean(b))
}
// Reconcile legacy devices and concurrent branches atomically, retaining both versions.
async function prepareSync(scope:string,remote:JournalEntry[]){
 const d=await db()
 return new Promise<{entries:JournalEntry[];updates:JournalEntry[];recovered:boolean}>((resolve,reject)=>{
  const t=d.transaction('notebooks','readwrite'),store=t.objectStore('notebooks'),localRequest=store.get(scope),pendingRequest=store.get(scope+'::pending'),marker=store.get(scope+'::cloud-v1')
  let result:{entries:JournalEntry[];updates:JournalEntry[];recovered:boolean}
  marker.onsuccess=()=>{
   const local:JournalEntry[]=localRequest.result||[],pending:Record<string,JournalEntry>=pendingRequest.result||{},merged=new Map(local.map(e=>[e.id,e])),cloud=new Map(remote.map(e=>[e.id,e]))
   let recovered=false
   for(const page of local){
    const server=cloud.get(page.id),dirty=pending[page.id]
    if(!server){pending[page.id]=page;continue}
    if(equalEntries(page,server)){delete pending[page.id];merged.set(page.id,server);continue}
    if(!dirty&&marker.result)continue
    if(page.revisions.some(r=>r.at===server.updatedAt)){pending[page.id]=page;continue}
    if(!dirty&&server.revisions.some(r=>r.at===page.updatedAt))continue
    const copy={...page,id:crypto.randomUUID(),title:page.title+' · 기기에서 복원'}
    merged.set(copy.id,copy);pending[copy.id]=copy;delete pending[page.id];recovered=true
   }
   for(const page of remote)if(!pending[page.id])merged.set(page.id,page)
   result={entries:[...merged.values()],updates:Object.values(pending),recovered}
   store.put(result.entries,scope);store.put(pending,scope+'::pending');store.put(true,scope+'::cloud-v1')
  }
  t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)
 })
}
export function useLifetimeJournal(scope:string,session:Session|null=null){
 const [state,setState]=useState<{scope:string;entries:JournalEntry[];ready:boolean;error:string;syncing:boolean}>({scope,entries:[],ready:false,error:'',syncing:false})
 const active=useRef(scope);active.current=scope
 const sessionRef=useRef(session);sessionRef.current=session
 const queue=useRef(Promise.resolve())
 const publish=useCallback((entries:JournalEntry[],error='',syncing=false)=>{if(active.current===scope)setState({scope,entries,ready:true,error,syncing})},[scope])
 const sync=useCallback(()=>{
  const run=async()=>{
   const auth=sessionRef.current
   if(!auth||auth.user.id!==scope||active.current!==scope)return
   setState(s=>s.scope===scope?{...s,syncing:true}:s)
   try{
    const remote=await notebookRequest(auth)
    if(active.current!==scope)return
    const prepared=await prepareSync(scope,remote)
    // Publish other-device changes even when an unrelated pending upload fails.
    publish(prepared.entries,'',true)
    let confirmed=remote
    if(prepared.updates.length){const acknowledged=await notebookRequest(auth,prepared.updates);confirmed=[...remote.filter(e=>!acknowledged.some(a=>a.id===e.id)),...acknowledged];if(active.current!==scope)return}
    const entries=await mergeCloud(scope,confirmed,prepared.updates)
    publish(entries,prepared.recovered?'두 기기의 다른 수정본을 모두 보관했습니다. «기기에서 복원» 페이지를 비교해주세요.':'')
    if('BroadcastChannel' in window){const c=new BroadcastChannel('folio-notebook');c.postMessage(scope);c.close()}
   }catch(error){if(active.current===scope)publish(await read(scope),(error as Error).message)}
  }
  const result=queue.current.then(run);queue.current=result.catch(()=>{});return result
 },[scope,publish])
 useEffect(()=>{
  let live=true
  setState({scope,entries:[],ready:false,error:'',syncing:!!sessionRef.current})
  void read(scope).then(entries=>{if(live){publish(entries,'',!!sessionRef.current);void sync()}}).catch(()=>{if(live)setState({scope,entries:[],ready:false,error:'기기 저장소를 열 수 없습니다. 브라우저 저장 권한을 확인하세요.',syncing:false})})
  const refresh=()=>{if(document.visibilityState!=='hidden')void sync()}
  window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh)
  const interval=window.setInterval(refresh,30000)
  return()=>{live=false;window.clearInterval(interval);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh)}
 },[scope,publish,sync])
 const replace=useCallback(async(updates:JournalEntry[],importOnly=false)=>{
  if(active.current!==scope)throw Error('계정이 변경되었습니다.')
  const entries=await write(scope,updates,importOnly);publish(entries,'',!!sessionRef.current)
  if('BroadcastChannel' in window){const c=new BroadcastChannel('folio-notebook');c.postMessage(scope);c.close()}
  await sync()
  // A durable local save succeeds even offline. The archive keeps a visible sync error
  // and retries the same IDs on reconnect instead of duplicating editor submissions.
 },[scope,publish,sync])
 useEffect(()=>{if(!('BroadcastChannel' in window))return;const c=new BroadcastChannel('folio-notebook');c.onmessage=e=>{if(e.data===scope)void read(scope).then(entries=>setState(s=>s.scope===scope?{...s,entries}:s))};return()=>c.close()},[scope])
 return {entries:state.scope===scope?state.entries:[],ready:state.scope===scope&&state.ready,error:state.scope===scope?state.error:'',syncing:state.scope===scope&&state.syncing,storageLabel:session?(state.error?'기기 보관 · 동기화 필요':state.syncing?'계정 동기화 중…':'계정에 동기화됨'):'이 기기에 보관한 기록',replace,retry:sync}
}
export function downloadNotebook(entries:JournalEntry[]){
 const url=URL.createObjectURL(new Blob([JSON.stringify({format:'folio-journal',version:1,entries},null,2)],{type:'application/json'}))
 const a=document.createElement('a');a.href=url;a.download='folio-journal-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export function validPhoto(value:unknown):value is string{return typeof value==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<3000000}
// Imports and rich content are untrusted: use only the supported JSON nodes, never raw HTML.
export function cleanDocument(raw:unknown,depth=0):JSONContent{
 if(depth>100||!raw||typeof raw!=='object')throw Error('문서 구조를 확인할 수 없습니다.')
 const n=raw as JSONContent
 const allowed=['doc','paragraph','text','heading','bulletList','orderedList','listItem','blockquote','hardBreak','horizontalRule','codeBlock']
 const type=allowed.includes(n.type||'')?n.type!:'paragraph'
 return {type,...(type==='text'?{text:String(n.text||''),marks:n.marks?.filter(m=>['bold','italic','strike','code','underline'].includes(m.type)).map(m=>({type:m.type}))}:{}),...(type==='heading'?{attrs:{level:Math.min(6,Math.max(1,Number(n.attrs?.level)||2))}}:{}),...(type==='orderedList'&&n.attrs?.start!=null?{attrs:{start:Math.min(1000000,Math.max(1,Math.trunc(Number(n.attrs.start)||1)))}}:{}),...(Array.isArray(n.content)?{content:n.content.map(c=>cleanDocument(c,depth+1))}:{})}
}
export function cleanInk(raw:unknown):InkStroke[]{
 if(!Array.isArray(raw))throw Error('필기 형식을 확인할 수 없습니다.')
 return raw.map(s=>Array.isArray(s)?s.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1000&&p.y>=0&&p.y<=100000).map(p=>({x:p.x,y:p.y,...(Number.isFinite(p.pressure)?{pressure:Math.max(0,Math.min(1,p.pressure))}:{}),...(['ink','blue','red','green','yellow'].includes(p.color)?{color:p.color}:{}),...(Number.isFinite(p.size)?{size:Math.max(1,Math.min(60,p.size))}:{}),...(['pen','pencil','highlighter'].includes(p.tool)?{tool:p.tool}:{})})):[])
}
function cleanPaper(paper:unknown):{paper?:EntrySnapshot['paper']}{return ['plain','ruled','grid'].includes(String(paper))?{paper:paper as EntrySnapshot['paper']}:{} }
function cleanNote(raw:any):NotebookNote{
 if(!raw||!Array.isArray(raw.photos)||raw.photos.length>4||!raw.photos.every(validPhoto))throw Error('회고 노트 형식을 확인할 수 없습니다.')
 return {body:cleanDocument(raw.body),text:String(raw.text||''),ink:cleanInk(raw.ink),photos:raw.photos,...cleanPaper(raw.paper)}
}
export function parseNotebook(text:string):JournalEntry[]{
 if(text.length>20000000)throw Error('백업 파일은 20MB 이하로 가져올 수 있습니다.')
 const data=JSON.parse(text)
 if(data.format!=='folio-journal'||data.version!==1||!Array.isArray(data.entries)||data.entries.length>1000)throw Error('Folio 저널 백업 파일을 선택하세요.')
 const clean=(e:any):EntrySnapshot=>{
  if(!e||typeof e.title!=='string'||!Array.isArray(e.ink)||(e.photo&&!validPhoto(e.photo))||(e.photos!=null&&(!Array.isArray(e.photos)||e.photos.length>4||!e.photos.every(validPhoto))))throw Error('기록 형식을 확인할 수 없습니다.')
  return {...cleanPaper(e.paper),title:e.title,body:cleanDocument(e.body),text:String(e.text||''),question:String(e.question||''),answer:String(e.answer||''),hypothesis:String(e.hypothesis||''),counterEvidence:String(e.counterEvidence||''),...(Array.isArray(e.reflections)&&e.reflections.length?{reflections:e.reflections.map((r:any)=>{if(!r||!Number.isFinite(Date.parse(r.at))||!['maintain','revise','close'].includes(r.outcome))throw Error('회고 형식을 확인할 수 없습니다.');return {at:r.at,outcome:r.outcome,result:String(r.result||''),lesson:String(r.lesson||''),nextAction:String(r.nextAction||''),...(typeof r.judgement==='string'?{judgement:r.judgement}:{}),...(typeof r.previousJudgement==='string'?{previousJudgement:r.previousJudgement}:{}),...(typeof r.trigger==='string'?{trigger:r.trigger}:{}),...(typeof r.nextReviewDate==='string'&&(r.nextReviewDate===''||/^\d{4}-\d{2}-\d{2}$/.test(r.nextReviewDate))?{nextReviewDate:r.nextReviewDate}:{}),...(r.note?{note:cleanNote(r.note)}:{})}})}:{}),photos:e.photos||[],photo:validPhoto(e.photo)?e.photo:undefined,ink:cleanInk(e.ink),kind:e.kind==='investment'?'investment':'life',ticker:String(e.ticker||''),reviewDate:/^\d{4}-\d{2}-\d{2}$/.test(e.reviewDate||'')?e.reviewDate:'',place:String(e.place||''),expense:String(e.expense||''),currency:['KRW','USD','EUR'].includes(e.currency)?e.currency:'KRW'}
 }
 return data.entries.map((e:any)=>{
  if(typeof e.id!=='string'||!Number.isFinite(Date.parse(e.createdAt))||!Number.isFinite(Date.parse(e.updatedAt)))throw Error('기록 날짜 또는 식별자를 확인할 수 없습니다.')
  return {...clean(e),id:e.id,createdAt:e.createdAt,updatedAt:e.updatedAt,revisions:(Array.isArray(e.revisions)?e.revisions:[]).map((r:any)=>({at:String(r.at),snapshot:clean(r.snapshot)}))}
 })
}
