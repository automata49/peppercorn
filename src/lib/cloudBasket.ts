import {useCallback,useEffect,useRef,useState} from 'react'
import {ensureSession,loadStoredSession,type Session} from './session'
import type {LeaderRow} from '../types'
type Item=Pick<LeaderRow,'market'|'ticker'|'name'>
type Change=Item&{removed:boolean;mutation:string}
const key=(item:Item)=>item.market+':'+item.ticker
const endpoint='https://mhbcchegrbakearqptdr.supabase.co/functions/v1/notebook?resource=basket'
export function useCloudBasket(session:Session|null,scope:string){
 const cacheKey='folio-stock-basket'+(scope==='guest'?'':':'+scope),pendingKey=cacheKey+':pending'
 const read=()=>{try{return JSON.parse(localStorage.getItem(cacheKey)||'[]') as Item[]}catch{return []}}
 const readPending=()=>{try{return JSON.parse(localStorage.getItem(pendingKey)||'{}') as Record<string,Change>}catch{return {}}}
 const [state,setState]=useState(()=>({scope,rows:read(),error:''}))
 const current=useRef(scope);current.current=scope
 const authRef=useRef(session);authRef.current=session
 const serial=useRef(Promise.resolve())
 const sync=useCallback(()=>{
  const run=async()=>{
   const session=authRef.current;if(!session||session.user.id!==scope||current.current!==scope)return
   const request=async(changes?:Change[])=>{
    const active=await ensureSession(session)
    if(current.current!==scope||loadStoredSession()?.user.id!==scope)throw Error('계정이 변경되었습니다.')
    const response=await fetch(endpoint,{method:changes?'POST':'GET',headers:{Authorization:'Bearer '+active.access_token,...(changes?{'Content-Type':'application/json'}:{})},...(changes?{body:JSON.stringify({changes})}:{}),signal:AbortSignal.timeout(15000)})
    if(!response.ok)throw Error('장바구니를 기기에 보관했습니다. 연결 후 계정 동기화를 다시 시도합니다.')
    return await response.json() as {items:Item[];known?:string[]}
   }
   try{
    const remote=await request();if(current.current!==scope)return
    const pending=readPending()
    if(!localStorage.getItem(cacheKey+':cloud-v1')){
     // Migrate earlier device-only items once; later pulls cannot resurrect removals.
     for(const item of read())if(!pending[key(item)]&&!(remote.known||remote.items.map(key)).includes(key(item)))pending[key(item)]={...item,removed:false,mutation:crypto.randomUUID()}
     localStorage.setItem(pendingKey,JSON.stringify(pending));localStorage.setItem(cacheKey+':cloud-v1','1')
    }
    const changes=Object.values(pending)
    let items=remote.items
    if(changes.length){items=(await request(changes)).items;if(current.current!==scope)return;const latest=readPending();for(const change of changes)if(latest[key(change)]?.mutation===change.mutation)delete latest[key(change)];localStorage.setItem(pendingKey,JSON.stringify(latest))}
    const merged=new Map(items.map(item=>[key(item),item]))
    for(const change of Object.values(readPending())){if(change.removed)merged.delete(key(change));else merged.set(key(change),{market:change.market,ticker:change.ticker,name:change.name})}
    const rows=[...merged.values()];localStorage.setItem(cacheKey,JSON.stringify(rows));setState(s=>current.current===scope?{scope,rows,error:''}:s)
   }catch(error){if(current.current===scope)setState(s=>({...s,scope,error:(error as Error).message}))}
  }
  const result=serial.current.then(run);serial.current=result.catch(()=>{});return result
 },[scope,cacheKey,pendingKey])
 useEffect(()=>{
  setState({scope,rows:read(),error:''});void sync()
  const refresh=()=>{if(document.visibilityState!=='hidden')void sync()}
  const storage=(event:StorageEvent)=>{if(event.key===cacheKey&&current.current===scope)setState({scope,rows:read(),error:''})}
  window.addEventListener('storage',storage);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh)
  const timer=window.setInterval(refresh,30000)
  return()=>{window.clearInterval(timer);window.removeEventListener('storage',storage);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh)}
 },[scope,sync])
 const rows=state.scope===scope?state.rows:read()
 const setRows=(next:Item[])=>{
  if(current.current!==scope)return
  const pending=readPending(),before=new Map(read().map(item=>[key(item),item])),after=new Map(next.map(item=>[key(item),item]))
  for(const [id,item] of before)if(!after.has(id))pending[id]={...item,removed:true,mutation:crypto.randomUUID()}
  for(const [id,item] of after)if(!before.has(id))pending[id]={...item,removed:false,mutation:crypto.randomUUID()}
  try{localStorage.setItem(cacheKey,JSON.stringify(next));if(scope!=='guest')localStorage.setItem(pendingKey,JSON.stringify(pending))}catch{setState({scope,rows:read(),error:'장바구니를 저장할 공간이 부족합니다. 브라우저 저장 공간을 확인해주세요.'});return}
  setState({scope,rows:next,error:''});void sync()
 }
 return {rows,setRows,error:state.scope===scope?state.error:'',retry:sync}
}
