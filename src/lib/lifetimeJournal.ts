import { useCallback, useEffect, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
export type InkPoint={x:number;y:number}
export type InkStroke=InkPoint[]
export type EntrySnapshot={title:string;body:JSONContent;text:string;question:string;answer:string;photo?:string;ink:InkStroke[];kind:'life'|'investment';ticker:string;reviewDate:string;place:string;expense:string;currency:string}
export type JournalEntry=EntrySnapshot&{id:string;createdAt:string;updatedAt:string;revisions:{at:string;snapshot:EntrySnapshot}[]}
export const questions=[
 '오늘 새롭게 발견한 것은 무엇인가요?',
 '현재 가격이 정당화되려면 무엇이 실현되어야 할까요?',
 '내 판단을 가장 강하게 반박하는 증거는 무엇인가요?',
 '내 매수가를 모른다면 오늘도 같은 판단을 할까요?',
 '다른 결과는 무엇이며, 각각 얼마나 가능할까요?',
 '결과를 보기 전에도 좋은 결정이었다고 평가할 수 있나요?'
]
export const blankSnapshot=():EntrySnapshot=>({title:'',body:{type:'doc',content:[{type:'paragraph'}]},text:'',question:questions[0],answer:'',ink:[],kind:'life',ticker:'',reviewDate:'',place:'',expense:'',currency:'KRW'})
export const snapshot=(e:EntrySnapshot):EntrySnapshot=>({title:e.title,body:e.body,text:e.text,question:e.question,answer:e.answer,photo:e.photo,ink:e.ink,kind:e.kind,ticker:e.ticker,reviewDate:e.reviewDate,place:e.place,expense:e.expense,currency:e.currency})
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
     if(existing&&importOnly)continue
     if(existing&&entry.revisions.at(-1)?.at!==existing.updatedAt)throw Error('다른 창에서 이 기록이 변경되었습니다. 현재 글을 복사한 뒤 다시 열어주세요.')
     merged.set(entry.id,entry)
    }
    result=[...merged.values()]
    if(result.length>1000||new Blob([JSON.stringify({format:'folio-journal',version:1,entries:result},null,2)]).size>18000000)throw Error('저널 저장 한도에 도달했습니다. 백업을 내보내고 사진 크기를 줄여주세요.')
    store.put(result,scope)
   }catch(e){failure=e as Error;t.abort()}
  }
  t.oncomplete=()=>resolve(result);t.onerror=()=>reject(failure||t.error);t.onabort=()=>reject(failure||t.error)
 })
}
export function useLifetimeJournal(scope:string){
 const [state,setState]=useState<{scope:string;entries:JournalEntry[];ready:boolean;error:string}>({scope,entries:[],ready:false,error:''})
 useEffect(()=>{let active=true;setState({scope,entries:[],ready:false,error:''});read(scope).then(entries=>{if(active)setState({scope,entries,ready:true,error:''})}).catch(()=>{if(active)setState({scope,entries:[],ready:false,error:'기기 저장소를 열 수 없습니다. 브라우저 저장 권한을 확인하세요.'})});return()=>{active=false}},[scope])
 const replace=useCallback(async(updates:JournalEntry[],importOnly=false)=>{const entries=await write(scope,updates,importOnly);setState(s=>s.scope===scope?{scope,entries,ready:true,error:''}:s);if('BroadcastChannel' in window){const c=new BroadcastChannel('folio-notebook');c.postMessage(scope);c.close()}},[scope])
 useEffect(()=>{if(!('BroadcastChannel' in window))return;const c=new BroadcastChannel('folio-notebook');c.onmessage=e=>{if(e.data===scope)void read(scope).then(entries=>setState(s=>s.scope===scope?{...s,entries}:s))};return()=>c.close()},[scope])
 return {entries:state.scope===scope?state.entries:[],ready:state.scope===scope&&state.ready,error:state.scope===scope?state.error:'',replace}
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
export function parseNotebook(text:string):JournalEntry[]{
 if(text.length>20000000)throw Error('백업 파일은 20MB 이하로 가져올 수 있습니다.')
 const data=JSON.parse(text)
 if(data.format!=='folio-journal'||data.version!==1||!Array.isArray(data.entries)||data.entries.length>1000)throw Error('Folio 저널 백업 파일을 선택하세요.')
 const clean=(e:any):EntrySnapshot=>{
  if(!e||typeof e.title!=='string'||!Array.isArray(e.ink)||(e.photo&&!validPhoto(e.photo)))throw Error('기록 형식을 확인할 수 없습니다.')
  return {title:e.title,body:cleanDocument(e.body),text:String(e.text||''),question:String(e.question||''),answer:String(e.answer||''),photo:validPhoto(e.photo)?e.photo:undefined,ink:e.ink.map((s:any)=>Array.isArray(s)?s.filter((p:any)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1000&&p.y>=0&&p.y<=400).map((p:any)=>({x:p.x,y:p.y})):[]),kind:e.kind==='investment'?'investment':'life',ticker:String(e.ticker||''),reviewDate:/^\d{4}-\d{2}-\d{2}$/.test(e.reviewDate||'')?e.reviewDate:'',place:String(e.place||''),expense:String(e.expense||''),currency:['KRW','USD','EUR'].includes(e.currency)?e.currency:'KRW'}
 }
 return data.entries.map((e:any)=>{
  if(typeof e.id!=='string'||!Number.isFinite(Date.parse(e.createdAt))||!Number.isFinite(Date.parse(e.updatedAt)))throw Error('기록 날짜 또는 식별자를 확인할 수 없습니다.')
  return {...clean(e),id:e.id,createdAt:e.createdAt,updatedAt:e.updatedAt,revisions:(Array.isArray(e.revisions)?e.revisions:[]).map((r:any)=>({at:String(r.at),snapshot:clean(r.snapshot)}))}
 })
}
