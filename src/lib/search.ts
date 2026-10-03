import type { LeaderRow } from '../types'

// ANALYSIS-SEARCH-1: one search box for ticker, name and Korean initial consonants (ㄷㄷㅈㅈ → 대덕전자).
const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
const isJamo = (ch: string) => ch >= 'ㄱ' && ch <= 'ㅎ'

export function choseong(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xac00
    out += code >= 0 && code < 11172 ? CHOSEONG[Math.floor(code / 588)] : ch
  }
  return out
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/** Match strength (higher first); 0 = no match. */
export function matchScore(row: Pick<LeaderRow, 'ticker' | 'name'>, query: string): number {
  const q = norm(query)
  if (!q) return 0
  const ticker = norm(row.ticker), name = norm(row.name || '')
  if (ticker === q) return 100
  if (ticker.startsWith(q)) return 80
  if (name.startsWith(q)) return 70
  if (name.includes(q)) return 50
  if ([...q].every(isJamo)) {
    const initials = choseong(name)
    if (initials.startsWith(q)) return 60
    if (initials.includes(q)) return 40
  }
  if (ticker.includes(q)) return 30
  return 0
}

export function searchRows<T extends Pick<LeaderRow, 'ticker' | 'name' | 'rs_rank'>>(rows: T[], query: string, limit = 30): T[] {
  return rows
    .map(row => ({ row, score: matchScore(row, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.row.rs_rank ?? -1) - (a.row.rs_rank ?? -1))
    .slice(0, limit)
    .map(x => x.row)
}

// Recently opened stocks, per device (a convenience: an unavailable storage simply starts empty).
const RECENT_KEY = 'peppercorn-recent-stocks-v1'
export type RecentStock = { market: string; ticker: string; name: string }
export function readRecent(): RecentStock[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(x => x && typeof x.ticker === 'string').slice(0, 8) : []
  } catch { return [] }
}
export function pushRecent(item: RecentStock): RecentStock[] {
  const next = [item, ...readRecent().filter(x => !(x.market === item.market && x.ticker === item.ticker))].slice(0, 8)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
  return next
}
