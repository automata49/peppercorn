import { useEffect, useState } from 'react'

// MOMENTUM-LINES-1 (display only): daily closes from price_daily via the public `price-history` function.
const endpoint='https://mhbcchegrbakearqptdr.supabase.co/functions/v1/price-history?client=peppercorn-public-read-v1'
export type History={dates:string[];closes:number[]}
const cache=new Map<string,History>()
const inFlight=new Map<string,Promise<void>>()
// Refresh: drop cached closes and tell mounted charts to refetch.
let version=0
const listeners=new Set<()=>void>()
export function invalidatePriceHistory(){cache.clear();inFlight.clear();version++;listeners.forEach(f=>f())}

async function load(ids:string[]){
  const generation=version
  const missing=[...new Set(ids)].filter(id=>!cache.has(id)&&!inFlight.has(id))
  const tasks=new Set<Promise<void>>(ids.map(id=>inFlight.get(id)).filter((p):p is Promise<void>=>!!p))
  // The public endpoint accepts at most ten IDs; preserve cached history across list/detail.
  for(let offset=0;offset<missing.length;offset+=10){
    const chunk=missing.slice(offset,offset+10)
    let task!:Promise<void>
    task=(async()=>{try{
      const res=await fetch(`${endpoint}&ids=${encodeURIComponent(chunk.join(','))}`,{signal:AbortSignal.timeout(15_000)})
      if(!res.ok)throw new Error('HTTP '+res.status)
      const {series}=await res.json() as {series:Record<string,[string,number][]>}
      if(generation!==version)return
      for(const id of chunk){const s=series[id]??[];cache.set(id,{dates:s.map(x=>x[0]),closes:s.map(x=>x[1])})}
    }finally{for(const id of chunk)if(inFlight.get(id)===task)inFlight.delete(id)}})()
    for(const id of chunk)inFlight.set(id,task)
    tasks.add(task)
  }
  const results=await Promise.allSettled(tasks)
  const failed=results.find((r):r is PromiseRejectedResult=>r.status==='rejected')
  if(failed)throw failed.reason
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
