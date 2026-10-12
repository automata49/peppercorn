import { useRef, useState } from 'react'

const resources=['watchlist','portfolio','research','analysis','journal','temperature']
export function migrateLegacyWorkspace(userId?:string){
  // A legacy cache can only be assigned to the account stored at app startup.
  // New signups never inherit another account's or the guest's saved records.
  try{
    if(localStorage.getItem('peppercorn-account-cache-v1')==='1')return
    if(userId)for(const resource of resources){
    const key='peppercorn-'+resource,old=localStorage.getItem(key)
    if(old!==null){if(localStorage.getItem(key+':'+userId)===null)localStorage.setItem(key+':'+userId,old);localStorage.removeItem(key)}
    }
    // Mark guest startups too: a later login must never claim that guest's rows.
    localStorage.setItem('peppercorn-account-cache-v1','1')
  }catch{/* retain original cache if browser storage is unavailable */}
}
export function useAccountRows<T>(base:string,scope:string,initial:T[]){
  const key=scope==='guest'?base:base+':'+scope
  const active=useRef(key);active.current=key
  const read=()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(saved)?saved as T[]:initial}catch{return initial}}
  const [state,setState]=useState(()=>({key,rows:read()}))
  // Derive the new account's rows in the switching render, before effects run.
  const rows=state.key===key?state.rows:read()
  const update=(next:T[])=>{
    if(active.current!==key)return
    setState({key,rows:next});try{localStorage.setItem(key,JSON.stringify(next))}catch{/* in-memory editing remains available */}
  }
  return [rows,update] as const
}
