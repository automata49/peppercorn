export const premiumChannel = 'https://contents.premium.naver.com/hsacademy/hsacademy1'
export type PremiumStory = { id: string; url: string; title: string; summary: string; summary_kind: 'title_only' | 'public_preview_draft'; evidence?: string; model?: string }
export type PremiumFeed = { version: 1; collected_at: string; state: 'collected' | 'empty' | 'unavailable'; ai_status: 'ready' | 'no_drafts' | 'unavailable' | 'not_configured'; items: PremiumStory[] }
const text = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max
export function premiumArticleUrl(v: unknown) {
 try { const u = new URL(String(v)); return u.protocol === 'https:' && u.hostname === 'contents.premium.naver.com' && !u.username && !u.password && !u.port && !u.search && !u.hash && /^\/hsacademy\/hsacademy1\/contents\/[A-Za-z0-9]+$/.test(u.pathname) } catch { return false }
}
export function parsePremiumInsights(value: unknown, now = Date.now()): PremiumFeed | null {
 if (!value || typeof value !== 'object') return null
 const p = value as PremiumFeed, age = now - Date.parse(p.collected_at)
 if (p.version !== 1 || typeof p.collected_at !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(p.collected_at) || !(age >= -3600000 && age <= 48*3600000) || !['collected','empty','unavailable'].includes(p.state) || !['ready','no_drafts','unavailable','not_configured'].includes(p.ai_status) || !Array.isArray(p.items) || p.items.length > 3) return null
 const seen = new Set<string>()
 const items = p.items.filter(i => {
  if (!i || !premiumArticleUrl(i.url) || seen.has(i.url) || !text(i.id,40) || !text(i.title,120) || typeof i.summary !== 'string') return false
  if (i.summary_kind === 'public_preview_draft') {
   if (!['gemini-3.5-flash-lite','gemini-2.5-flash-lite'].includes(String(i.model)) || !text(i.summary,180) || !text(i.evidence,100) || i.evidence!.length < 8) return false
  } else if (i.summary_kind !== 'title_only' || i.summary !== '') return false
  seen.add(i.url); return true
 })
 return {...p,items}
}
export async function loadPremiumInsights(signal: AbortSignal): Promise<PremiumFeed | null> {
 try { const r = await fetch(import.meta.env.BASE_URL+'data/premium-insights.json',{signal,cache:'no-cache'}); if (!r.ok || Number(r.headers.get('content-length') || 0)>20000) return null
  const body = await r.text(); return body.length<=20000 ? parsePremiumInsights(JSON.parse(body)) : null
 } catch { return null }
}
