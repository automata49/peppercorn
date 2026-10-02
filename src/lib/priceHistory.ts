import { useEffect, useState } from 'react'

// MOMENTUM-LINES-1 (display only): daily closes from price_daily via the public `price-history` function.
const endpoint='https://mhbcchegrbakearqptdr.supabase.co/functions/v1/price-history?client=peppercorn-public-read-v1'
export type History={dates:string[];closes:number[]}
const cache=new Map<string,History>()
// Refresh: drop cached closes and tell mounted charts to refetch.
let version=0
const listeners=new Set<()=>void>()
export function invalidatePriceHistory(){cache.clear();version++;listeners.forEach(f=>f())}

async function load(ids:string[]){
  const missing=ids.filter(id=>!cache.has(id))
  if(!missing.length)return
  const res=await fetch(`${endpoint}&ids=${missing.join(',')}`)
  if(!res.ok)throw new Error('HTTP '+res.status)
  const {series}=await res.json() as {series:Record<string,[string,number][]>}
  for(const id of missing){const s=series[id]??[];cache.set(id,{dates:s.map(x=>x[0]),closes:s.map(x=>x[1])})}
}

export function usePriceHistory(ids:string[],enabled:boolean){
  const key=ids.join(',')
  const [state,setState]=useState<{status:'idle'|'loading'|'ok'|'error';error?:string}>({status:'idle'})
  const [v,setV]=useState(version)
  useEffect(()=>{const f=()=>setV(version);listeners.add(f);return()=>{listeners.delete(f)}},[])
  useEffect(()=>{
    if(!enabled||!ids.length)return
    let live=true
    setState({status:'loading'})
    load(ids).then(()=>{if(live)setState({status:'ok'})}).catch(e=>{if(live)setState({status:'error',error:String(e?.message??e)})})
    return()=>{live=false}
  },[key,enabled,v])
  return {...state,get:(id:string)=>cache.get(id)}
}

// Last `sessions`+1 closes rebased so the first is 100 (same base as the period return).
export function rebased(h:History|undefined,sessions:number){
  if(!h||h.closes.length<2)return null
  const n=Math.min(sessions+1,h.closes.length),closes=h.closes.slice(-n),base=closes[0]
  return base>0?{dates:h.dates.slice(-n),values:closes.map(c=>c/base*100),complete:h.closes.length>=sessions+1}:null
}
