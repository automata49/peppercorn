import { useEffect, useState } from 'react'
import { loadPremiumInsights, premiumChannel, type PremiumFeed } from '../lib/premiumInsights'

export function PremiumInsights() {
 const [feed, setFeed] = useState<PremiumFeed | null>(null)
 useEffect(() => {
  const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(),8000)
  let active = true
  void loadPremiumInsights(controller.signal).then(p => { if (active) { setFeed(p) } })
  return () => { active = false; controller.abort(); window.clearTimeout(timer) }
 }, [])
 return <section className="home-digest" aria-label="HS아카데미 추천 읽을거리"><h4>HS아카데미</h4>
  {feed?.items.map(i => <article key={i.id}><h5>{i.title}</h5>
   <a href={i.url} target="_blank" rel="noopener noreferrer">HS아카데미 원문 보기 ↗</a>
  </article>)}
  <a href={premiumChannel} target="_blank" rel="noopener noreferrer">HS아카데미 채널 전체 보기 ↗</a>
 </section>
}
