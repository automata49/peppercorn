import type { PositionRow } from '../types'

const endpoint =
  'https://mhbcchegrbakearqptdr.supabase.co/functions/v1/position-public?client=peppercorn-public-read-v1'

export type PositionLoad = { rows: Map<string, PositionRow>; status: 'live' | 'unavailable'; updatedAt: string | null }

export const positionKey = (market: string, ticker: string) => `${market}:${ticker}`

/** Latest Position snapshot per company. Failure leaves the map empty: the screen then shows — and a notice, never zeros. */
export async function loadPosition(signal?: AbortSignal): Promise<PositionLoad> {
  try {
    const response = await fetch(endpoint, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error(String(response.status))
    const body = await response.json()
    const rows = new Map<string, PositionRow>()
    for (const row of (body.rows ?? []) as PositionRow[]) {
      if (row && row.market && row.ticker) rows.set(positionKey(row.market, row.ticker), row)
    }
    return { rows, status: 'live', updatedAt: body.updated_at ?? null }
  } catch {
    return { rows: new Map(), status: 'unavailable', updatedAt: null }
  }
}
