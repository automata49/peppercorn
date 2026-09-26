import type { LeaderRow } from '../types'
import { demoRows } from '../data/mock'

const endpoint =
  'https://mhbcchegrbakearqptdr.supabase.co/functions/v1/leaderboard?client=peppercorn-public-read-v1'

const numericFields = [
  'price','return_1w','return_1m','return_3m','return_6m','return_12m',
  'return_5d','return_20d','return_50d','return_120d','return_200d',
  'rs_1w','rs_1m','rs_3m','rs_6m','rs_12m','rs_rank',
  'rs_5d','rs_20d','rs_50d','rs_120d','rs_200d',
  'high_52w_distance','volume_ratio','adr20_pct','rsi14','atr_multiple',
  'ma50','ma200'
] as const

const textFields = [
  'ticker','name','asset_class','sector','industry','stage','verdict','action_guide',
  'leadership_class','exchange','classification_scheme','classification_source',
  'classification_as_of','data_status'
] as const

const toNumber=(value:unknown)=>{
  if(value==null||value==='') return null
  const n=Number(value)
  return Number.isFinite(n)?n:null
}

const toBool=(value:unknown)=>{
  if(typeof value==='boolean') return value
  if(typeof value==='string') return value.toLowerCase()==='true'
  return Boolean(value)
}

const toStringArray=(value:unknown):string[]=>{
  if(Array.isArray(value)) return value.map(v=>String(v))
  if(value==null||value==='') return []
  if(typeof value==='string'){
    const trimmed=value.trim()
    if(trimmed.startsWith('[')){
      try{
        const parsed=JSON.parse(trimmed)
        if(Array.isArray(parsed)) return parsed.map(v=>String(v))
      }catch{}
    }
    if(trimmed.startsWith('{')&&trimmed.endsWith('}')){
      return trimmed.slice(1,-1).split(',').map(v=>v.replace(/^"|"$/g,'').trim()).filter(Boolean)
    }
    return [trimmed]
  }
  return [String(value)]
}

function normalizeRow(raw:unknown,index:number):LeaderRow{
  const src=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>
  const row:Record<string,unknown>={...src}
  for(const field of numericFields) row[field]=toNumber(src[field])
  for(const field of textFields){
    const value=src[field]
    row[field]=value==null?'':String(value)
  }
  row.id=String(src.id??`row-${index}`)
  row.market=src.market==='KR'?'KR':'US'
  row.asset_class=row.asset_class||'Equity'
  row.sector=row.sector||'분류 확인'
  row.industry=row.industry||'분류 확인'
  row.stage=row.stage||'○ 관찰'
  row.verdict=row.verdict||'—'
  row.action_guide=row.action_guide||'추가 데이터 확인'
  row.data_status=row.data_status||'정상'
  row.leader_tt=toBool(src.leader_tt)
  row.index_memberships=toStringArray(src.index_memberships)
  row.index_statuses=toStringArray(src.index_statuses)
  return row as unknown as LeaderRow
}

const normalizeRows=(rows:unknown[])=>rows.map(normalizeRow)

export async function loadLeaderboard(): Promise<{rows:LeaderRow[];source:'supabase'|'demo'}> {
  try {
    const res = await fetch(endpoint)
    if (!res.ok) throw new Error('Peppercorn API HTTP ' + res.status)
    const payload = await res.json() as { rows?: unknown[] }
    return payload.rows?.length
      ? { rows: normalizeRows(payload.rows), source: 'supabase' }
      : { rows: normalizeRows(demoRows), source: 'demo' }
  } catch {
    return { rows: normalizeRows(demoRows), source: 'demo' }
  }
}
