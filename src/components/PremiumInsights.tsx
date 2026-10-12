import { useEffect, useState } from 'react'
import { loadPremiumInsights, premiumChannel, type PremiumFeed } from '../lib/premiumInsights'

export function PremiumInsights() {
 const [feed, setFeed] = useState<PremiumFeed | null>(null), [loading, setLoading] = useState(true)
 useEffect(() => {
  const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(),8000)
  let active = true
  void loadPremiumInsights(controller.signal).then(p => { if (active) { setFeed(p); setLoading(false) } })
  return () => { active = false; controller.abort(); window.clearTimeout(timer) }
 }, [])
 return <section className="home-digest" aria-label="HS아카데미 추천 읽을거리"><h4>HS아카데미 · 추천 읽을거리</h4>
  <p className="note">채널의 공개 자료 최대 3개 · 수집 순서 · 개인화 투자 추천 아님</p>
  {feed?.items.map(i => <article key={i.id}><h5>{i.title}</h5>
   {i.summary_kind === 'public_preview_draft' ? <><p>{i.summary}</p><p className="note">Gemini · 공개 미리보기 요약 초안 · 유료 본문 요약 아님 · 사실 확인 필요</p></> : <p className="note">제목·링크만 확인 · 본문 요약 미제공</p>}
   <a href={i.url} target="_blank" rel="noopener noreferrer">HS아카데미 원문 보기 ↗</a><p className="note">게시일 미제공 · 구독이 필요할 수 있습니다.</p>
  </article>)}
  {!feed?.items.length && <p role="status">{loading ? '공개 자료 확인 중…' : '현재 공개 글 정보를 가져오지 못했습니다. 채널에서 원문을 확인하세요.'}</p>}
  {feed && <p className="note">수집 {new Date(feed.collected_at).toLocaleString('ko-KR')} · {feed.ai_status === 'not_configured' ? 'Gemini 키 미설정' : feed.ai_status === 'unavailable' ? 'Gemini 요약 실행 실패' : feed.items.some(i=>i.summary_kind==='public_preview_draft') ? '공개 미리보기 AI 초안 포함' : '생성된 AI 요약 없음'}</p>}
  <a href={premiumChannel} target="_blank" rel="noopener noreferrer">HS아카데미 채널 전체 보기 ↗</a>
 </section>
}
