import { useEffect, useState } from 'react'

// MOMENTUM-LINES-1 (display only): daily closes from price_daily via the public `price-history` function.
const endpoint='https://mhbcchegrbakearqptdr.supabase.co/functions/v1/price-history?client=peppercorn-public-read-v1'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
type Close=[string,number]
// Publication age and trading dates are separate: never substitute a retrieval date for a close date.
export function parseStaticHistory(payload:unknown,id:string,now=Date.now()):Close[]|null{
  if(!payload||typeof payload!=='object')return null
  const p=payload as {version?:number;published_at?:string;as_of?:string|null;series?:Record<string,unknown>}
  const age=now-Date.parse(p.published_at||'')
  const series=p.series?.[id]
  if(p.version!==1||!(age>=0&&age<=20*3600_000)||!Array.isArray(series)||series.length>253)return null
  let previous=''
  for(const point of series){
    if(!Array.isArray(point)||point.length!==2||typeof point[0]!=='string'||
      !/^\d{4}-\d{2}-\d{2}$/.test(point[0])||!Number.isFinite(Date.parse(point[0]))||
      new Date(point[0]).toISOString().slice(0,10)!==point[0]||point[0]<=previous||
      point[0]>new Date(now).toISOString().slice(0,10)||typeof point[1]!=='number'||!Number.isFinite(point[1])||point[1]<=0)return null
    previous=point[0]
  }
  if(p.as_of!==(previous||null))return null
  return series as Close[]
}
async function staticHistory(id:string):Promise<Close[]|null>{
  if(!UUID.test(id))return null
  try{
    const res=await fetch(import.meta.env.BASE_URL+`data/price-history/${id}.json`,{cache:'no-cache',signal:AbortSignal.timeout(15_000)})
    return res.ok?parseStaticHistory(await res.json(),id):null
  }catch{return null}
}
export type History={dates:string[];closes:number[]}
const cache=new Map<string,History>()
const errors=new Map<string,string>()
const inFlight=new Map<string,Promise<void>>()
// Refresh: drop cached closes and tell mounted charts to refetch.
let version=0
const listeners=new Set<()=>void>()
export function invalidatePriceHistory(){cache.clear();errors.clear();inFlight.clear();version++;listeners.forEach(f=>f())}

async function load(ids:string[]){
  const generation=version
  const missing=[...new Set(ids)].filter(id=>!cache.has(id)&&!inFlight.has(id))
  const tasks=new Set<Promise<void>>(ids.map(id=>inFlight.get(id)).filter((p):p is Promise<void>=>!!p))
  // The public endpoint accepts at most ten IDs; preserve cached history across list/detail.
  for(let offset=0;offset<missing.length;offset+=10){
    const chunk=missing.slice(offset,offset+10)
    for(const id of chunk)errors.delete(id)
    let task!:Promise<void>
    task=(async()=>{try{
      const saved=await Promise.all(chunk.map(async id=>({id,series:await staticHistory(id)})))
      if(generation!==version)return
      for(const {id,series}of saved)if(series!==null)cache.set(id,{dates:series.map(x=>x[0]),closes:series.map(x=>x[1])})
      const fallback=saved.filter(x=>x.series===null).map(x=>x.id)
      if(!fallback.length)return
      const res=await fetch(`${endpoint}&ids=${encodeURIComponent(fallback.join(','))}`,{signal:AbortSignal.timeout(15_000)})
      if(!res.ok)throw new Error('HTTP '+res.status)
      const {series}=await res.json() as {series:Record<string,[string,number][]>}
      if(generation!==version)return
      for(const id of fallback){const s=series[id]??[];cache.set(id,{dates:s.map(x=>x[0]),closes:s.map(x=>x[1])})}
    }catch(e){
      if(generation===version)for(const id of chunk)if(!cache.has(id))errors.set(id,String((e as Error)?.message??e))
      throw e
    }finally{for(const id of chunk)if(inFlight.get(id)===task)inFlight.delete(id)}})()
    for(const id of chunk)inFlight.set(id,task)
    tasks.add(task)
  }
  const results=await Promise.allSettled(tasks)
  const failed=results.find((r):r is PromiseRejectedResult=>r.status==='rejected')
  // A shared batch can contain another chart's failed ID. Keep confirmed histories usable;
  // existing renderers explain a missing benchmark instead of hiding valid stock closes.
  if(failed&&ids.every(id=>!cache.has(id)))throw failed.reason
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
  return {...state,get:(id:string)=>cache.get(id),getError:(id:string)=>errors.get(id)}
}

// Last `sessions`+1 closes rebased so the first is 100 (same base as the period return).
export function rebased(h:History|undefined,sessions:number){
  if(!h||h.closes.length<2)return null
  const n=Math.min(sessions+1,h.closes.length),closes=h.closes.slice(-n),base=closes[0]
  return base>0?{dates:h.dates.slice(-n),values:closes.map(c=>c/base*100),complete:h.closes.length>=sessions+1}:null
}
