import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LeaderRow } from '../types'

// LIVE-QUOTE-1: display-only current prices. Daily metrics (returns, RS, MA gaps, stage)
// still come from the scheduled recalculation; only the 현재가 display is overlaid.
const QUOTES_URL='https://mhbcchegrbakearqptdr.supabase.co/functions/v1/quotes?client=peppercorn-public-read-v1'
export const LIVE_QUOTE_INTERVAL_MS=30_000
const MAX_SYMBOLS=200
const CHUNK=60

export type LiveQuote={price:number;time:number|null;previous_close:number|null;currency:string|null}
type QuoteRow=Pick<LeaderRow,'market'|'ticker'|'exchange'>

export function yahooSymbol(row:QuoteRow){
  const ticker=String(row.ticker||'').trim().toUpperCase()
  if(!ticker)return ''
  if(row.market==='KR')return ticker+(String(row.exchange||'').toUpperCase().includes('KOSDAQ')?'.KQ':'.KS')
  return ticker.replace(/\./g,'-')
}

type Ctx={quotes:ReadonlyMap<string,LiveQuote>;register:(symbols:string[])=>()=>void}
const LiveQuoteContext=createContext<Ctx>({quotes:new Map(),register:()=>()=>{}})

async function fetchChunk(symbols:string[]){
  const response=await fetch(QUOTES_URL+'&symbols='+encodeURIComponent(symbols.join(',')),{signal:AbortSignal.timeout(10_000)})
  if(!response.ok)throw new Error('quotes_'+response.status)
  const body=await response.json() as {quotes?:Record<string,LiveQuote>}
  return body.quotes||{}
}

export function LiveQuoteProvider({enabled,children}:{enabled:boolean;children:ReactNode}){
  const [quotes,setQuotes]=useState<ReadonlyMap<string,LiveQuote>>(new Map())
  const registrations=useRef(new Map<number,string[]>())
  const nextId=useRef(0)
  const [version,setVersion]=useState(0)
  const register=useMemo(()=>(symbols:string[])=>{
    const id=nextId.current++
    registrations.current.set(id,symbols)
    setVersion(v=>v+1)
    return()=>{registrations.current.delete(id)}
  },[])
  useEffect(()=>{
    if(!enabled)return
    let stopped=false
    const poll=async()=>{
      if(document.visibilityState!=='visible')return
      const symbols=[...new Set([...registrations.current.values()].flat().filter(Boolean))].slice(0,MAX_SYMBOLS)
      if(!symbols.length)return
      const merged:Record<string,LiveQuote>={}
      for(let i=0;i<symbols.length;i+=CHUNK){
        try{Object.assign(merged,await fetchChunk(symbols.slice(i,i+CHUNK)))}catch{/* keep the last known price */}
      }
      if(stopped||!Object.keys(merged).length)return
      setQuotes(previous=>{const next=new Map(previous);for(const [s,q] of Object.entries(merged))next.set(s,q);return next})
    }
    const first=window.setTimeout(()=>void poll(),300)
    const interval=window.setInterval(()=>void poll(),LIVE_QUOTE_INTERVAL_MS)
    const onVisible=()=>{if(document.visibilityState==='visible')void poll()}
    document.addEventListener('visibilitychange',onVisible)
    return()=>{stopped=true;window.clearTimeout(first);window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisible)}
  },[enabled,version])
  const value=useMemo(()=>({quotes,register}),[quotes,register])
  return <LiveQuoteContext.Provider value={value}>{children}</LiveQuoteContext.Provider>
}

/** Registers rows for polling while mounted and returns a lookup for their live quote. */
export function useLiveQuotes(rows:QuoteRow[],limit=40){
  const {quotes,register}=useContext(LiveQuoteContext)
  const key=rows.slice(0,limit).map(yahooSymbol).join(',')
  useEffect(()=>key?register(key.split(',')):undefined,[key,register])
  return (row:QuoteRow)=>quotes.get(yahooSymbol(row))??null
}
