import type { LeaderRow } from '../types'
import { demoRows } from '../data/mock'

const endpoint =
  'https://mhbcchegrbakearqptdr.supabase.co/functions/v1/leaderboard?client=peppercorn-public-read-v1'

export async function loadLeaderboard(): Promise<{rows:LeaderRow[];source:'supabase'|'demo'}> {
  try {
    const res = await fetch(endpoint)
    if (!res.ok) throw new Error('Peppercorn API HTTP ' + res.status)
    const payload = await res.json() as { rows?: LeaderRow[] }
    return payload.rows?.length
      ? { rows: payload.rows, source: 'supabase' }
      : { rows: demoRows, source: 'demo' }
  } catch {
    return { rows: demoRows, source: 'demo' }
  }
}
