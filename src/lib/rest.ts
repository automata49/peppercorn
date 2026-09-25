import type { LeaderRow } from '../types'
import { demoRows } from '../data/mock'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export async function loadLeaderboard(): Promise<{rows:LeaderRow[];source:'supabase'|'demo'}> {
  if (!url || !key) return {rows:demoRows,source:'demo'}
  try {
    const endpoint = url.replace(/\/$/,'') + '/rest/v1/leaderboard_view?select=*&order=rs_rank.desc'
    const res = await fetch(endpoint,{headers:{apikey:key}})
    if (!res.ok) throw new Error('Supabase HTTP ' + res.status)
    const rows = await res.json() as LeaderRow[]
    return rows.length ? {rows,source:'supabase'} : {rows:demoRows,source:'demo'}
  } catch {
    return {rows:demoRows,source:'demo'}
  }
}
