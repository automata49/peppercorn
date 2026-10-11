import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import type { EditableRow, LeaderRow } from '../types'
import type { JournalEntry } from '../lib/lifetimeJournal'
import { entryPhotos } from '../lib/lifetimeJournal'
import type { LeaderInsight, InsightsFeed } from '../lib/leaderInsights'
import { Button } from './ui/button'
import { AppIcon } from './AppIcon'
import { leaderObservation } from './TodayLeaders'

type Section = 'today' | 'discover' | 'journal' | 'journey'
type Props = { entries: JournalEntry[]; leaders: LeaderRow[]; research: EditableRow[]; theses: EditableRow[]; trades: EditableRow[]; insights: InsightsFeed | null; source: string; navigate: (page: string) => void; onSelect: (row: LeaderRow) => void }
const art = (file: string) => `${import.meta.env.BASE_URL}${file}`
const oneLine = (text: unknown, fallback: string) => String(text || '').trim().replace(/\s+/g, ' ').slice(0, 72) || fallback
const instrumentName = (r: LeaderRow) => r.market === 'KR' ? r.name : r.ticker

function SourceStory({item}:{item:LeaderInsight}){
 const [failed,setFailed]=useState(false)
 const image=item.image&&!failed?item.image:null
 return <article className="source-digest-item" data-ticker={item.ticker}>{image&&<img src={image.url} alt={image.alt} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>}<h5>{item.headline}</h5><p>{item.summary||item.source.title}</p>{item.evidence&&<blockquote>원문 발췌 · {item.evidence}</blockquote>}<a href={item.source.url} target="_blank" rel="noopener noreferrer">원문 보기 · {item.source.publisher} · {item.source.published_at.slice(0,10)} · {item.summary_kind==='ai_draft'?'AI 요약 초안 · 사실 확인 필요':'원문 제목'}{Date.now()-Date.parse(item.source.published_at)>3*86400000?' · 이전 자료':''} ↗</a>{image?<p className="note">{image.kind==='original'?'원문 사진':'관련 사진 · 기사 원문 사진 아님'} · {image.creator} · {image.license}<br/><a href={image.page_url} target="_blank" rel="noopener noreferrer">사진 원본 ↗</a> · <a href={image.license_url} target="_blank" rel="noopener noreferrer">이용 조건 ↗</a></p>:<p className="note">사진 미연결 · 홈 표지의 Folio 이미지는 원문 사진이 아닙니다.</p>}</article>
}

/** The fixed home is an overview of the user's journey. Public drafts never edit private records. */
export function LifestyleHome({ entries, leaders, research, theses, trades, insights, source, navigate, onSelect }: Props) {
 const [selected, setSelected] = useState<Section | null>(null)
 const focus = useRef<HTMLElement | null>(null), reduce = useReducedMotion()
 const transition = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 280, damping: 32 }
 const sorted = entries.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
 const investment = sorted.filter(e => e.kind === 'investment')
 const today = new Date().toLocaleDateString('sv-SE')
 const due = investment.filter(e => e.reviewDate && e.reviewDate <= today)
 const currentSources = (insights?.items || []).filter(i => Date.parse(i.expires_at) > Date.now()).filter(i => leaders.some(r => r.market === i.market && r.ticker === i.ticker))
 const relatedRecords = investment.filter(e => leaders.some(r => e.ticker.toUpperCase() === r.ticker.toUpperCase() || e.ticker.toUpperCase() === `${r.market}:${r.ticker}`.toUpperCase()))
 const ownPhoto = sorted.flatMap(entryPhotos)[0]
 const covers: { key: Section; label: string; summary: string; image: string; position: string }[] = [
  { key: 'today', label: '오늘', summary: oneLine(currentSources[0]?.headline, relatedRecords[0] ? `세상의 변화와 ${relatedRecords[0].title}` : '변화하는 세상을 읽다'), image: art('folio-brand-photography.webp'), position: 'center 48%' },
  { key: 'discover', label: '발견', summary: leaders.length ? `${leaders.slice(0, 3).map(instrumentName).join(' · ')}에서 발견하는 흐름` : '새로운 기업, 새로운 가능성', image: art('folio-brand-launch.webp'), position: 'center 24%' },
  { key: 'journal', label: '저널', summary: oneLine(sorted[0]?.title, '기록, 일상, 투자 — 나의 생각을 남기다'), image: ownPhoto || art('folio-lifestyle-journal.webp'), position: 'left 70%' },
  { key: 'journey', label: '여정', summary: due.length ? `다시 살펴볼 ${due.length}개의 생각` : '가설을 돌아보고, 다음 방향을 찾다', image: art('folio-lifestyle-journey.webp'), position: 'center 50%' },
 ]
 const active = covers.find(c => c.key === selected)
 function go(page: string) { setSelected(null); navigate(page) }
 function cover(c: typeof covers[number]) { return <><motion.img layoutId={`home-image-${c.key}`} src={c.image} style={{ objectPosition: c.position }} alt=""/><div className="home-cover-copy"><motion.h3 layoutId={`home-title-${c.key}`}>{c.label}</motion.h3><p title={c.summary}>{c.summary}</p></div></> }
 return <LayoutGroup id="lifestyle-home"><section className="lifetime-workspace lifetime-today lifestyle-home" aria-label="나의 여정 한눈에">
  <header className="lifetime-heading home-heading"><time>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</time><h2>나의 여정</h2><p>세상을 발견하고, 나의 시간을 기록하다.</p></header>
  <div className="home-motion-cards">{covers.map(c => <motion.button key={c.key} layoutId={`home-frame-${c.key}`} transition={transition} className={`home-motion-card home-${c.key}`} type="button" aria-label={`${c.label} 카드 열기`} onClick={() => { focus.current = document.activeElement as HTMLElement; setSelected(c.key) }}>{cover(c)}</motion.button>)}</div>
  <p className="home-journey-state">{entries.length ? `${entries.length}개의 기록 · 투자 가설 ${theses.filter(t => t.ticker).length}개 · 다시 볼 생각 ${due.length}개` : '사진 한 장, 작은 발견 하나에서 시작하는 나의 여정.'}</p>
  <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}><Dialog.Portal forceMount><AnimatePresence onExitComplete={() => focus.current?.isConnected && focus.current.focus({preventScroll:true})}>
   {active && <Dialog.Overlay forceMount asChild><motion.div className="story-dialog-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .2 }}/></Dialog.Overlay>}
   {active && <Dialog.Content forceMount asChild onOpenAutoFocus={e => { e.preventDefault(); document.querySelector<HTMLButtonElement>('.home-detail-close')?.focus() }} onCloseAutoFocus={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()}><motion.section className="story-dialog home-detail" layoutId={`home-frame-${active.key}`} layoutScroll transition={transition}>
    <Button className="journal-dialog-close home-detail-close" variant="secondary" size="icon" aria-label="카드 닫기" onClick={() => setSelected(null)}><AppIcon name="close"/></Button>
    <div className={`home-detail-cover home-${active.key}`}>{cover(active)}</div>
    <div className="story-detail-body"><Dialog.Title>{active.label === '오늘' ? '변화하는 세상을 읽다' : active.label === '저널' ? '기록, 일상, 투자' : active.label === '여정' ? '가설을 다시 읽고, 방향을 점검하다' : '오늘의 주도주'}</Dialog.Title><Dialog.Description>새로운 관찰과 나의 기록을 연결합니다.</Dialog.Description>
     {selected === 'today' && <><section className="home-digest"><h4>여러 채널에서 온 변화</h4>{currentSources.length ? currentSources.map(i => <SourceStory key={i.market+i.ticker} item={i}/>) : <p>현재 주도주에 연결된 최신 수집 자료가 없습니다.</p>}{leaders.map(r => { const note = leaderObservation(r, research); return note ? <article key={r.id}><h5>{String(note.title || instrumentName(r))}</h5><p>{String(note.fact)}</p>{note.interpretation&&<p>나의 해석 · {String(note.interpretation)}</p>}<a href={String(note.source)} target="_blank" rel="noopener noreferrer">내 리서치 · {String(note.date || '기준일 미제공')} · {String(note.verification || '미검증')}{!Number.isFinite(Date.parse(String(note.date)))?' · 날짜 확인 필요':Date.now()-Date.parse(String(note.date))>30*86400000?' · 오래된 자료 · 출처 재확인 필요':''} ↗</a></article> : null })}<p className="note">{insights?.ai_status === 'enabled' ? '공개 자료의 AI 초안입니다. 원문과 함께 확인하세요.' : insights?.ai_status==='not_configured'?'AI 요약 미활성 · 수집된 원문과 저장된 기록을 정리했습니다.':'수집된 원문과 저장된 기록을 정리했습니다. AI 요약 활성 여부는 자료별 표시를 확인하세요.'}</p></section><section className="home-digest"><h4>주도주와 연결된 나의 기록</h4>{relatedRecords.slice(0, 5).map(e => <article key={e.id}><h5>{e.title}</h5><p>{oneLine(e.hypothesis || e.text, '사진과 생각이 담긴 기록')}</p><time>{e.updatedAt.slice(0, 10)}</time></article>)}{!relatedRecords.length && <p>현재 주도주와 연결한 투자 기록이 없습니다.</p>}<Button variant="secondary" onClick={() => go('notebook')}>저널에서 이어 쓰기 →</Button></section></>}
     {selected === 'discover' && <><p className="note">{source === 'demo' ? '예시 데이터 · 실제 오늘의 주도주가 아닙니다.' : '기존 시장 선별 기준과 순서를 유지합니다.'}</p><div className="home-leader-preview">{leaders.map(r => <Button key={r.id} variant="ghost" onClick={() => { setSelected(null); onSelect(r) }}><span>{instrumentName(r)}</span><small>{r.action_guide || '주도 근거 확인'}</small><AppIcon name="arrow"/></Button>)}</div>{!leaders.length && <p>선별된 종목이 없습니다.</p>}<Button onClick={() => go('analysis')}>발견에서 전체 보기 →</Button></>}
     {selected === 'journal' && <><section className="home-digest"><h4>최근 남긴 생각</h4>{sorted.slice(0, 3).map(e => <article key={e.id}><h5>{e.title}</h5><p>{oneLine(e.hypothesis || e.text || e.answer, '사진으로 남긴 기억')}</p><time>{e.updatedAt.slice(0, 10)} · {e.kind === 'life' ? '일상' : '투자'}</time></article>)}{!sorted.length && <p>아직 남긴 기록이 없습니다.</p>}</section><section className="home-digest"><h4>Thesis · 투자일지의 최근 판단</h4>{theses.filter(r=>r.ticker).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,2).map(r=><article key={'thesis'+r.id}><h5>{String(r.name||r.ticker)} · Thesis</h5><p>{String(r.conclusion||r.growth_driver||r.competitive_advantage||'아직 투자 근거를 작성하지 않았습니다.')}</p><time>{String(r.date||'날짜 미제공')}</time></article>)}{trades.filter(r=>r.ticker).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,2).map(r=><article key={'trade'+r.id}><h5>{String(r.name||r.ticker)} · 투자일지</h5><p>{String(r.thesis||r.review_note||r.lesson||'아직 매매 판단을 작성하지 않았습니다.')}</p><time>{String(r.date||'날짜 미제공')}</time></article>)}</section><section className="home-digest"><h4>AI Insights · 연결된 변화</h4>{currentSources.filter(i=>i.summary_kind==='ai_draft').slice(0,2).map(i=><article key={i.market+i.ticker}><h5>{i.headline}</h5><p>{i.summary}</p><a href={i.source.url} target="_blank" rel="noopener noreferrer">{i.source.publisher} · AI 요약 초안 ↗</a></article>)}{!currentSources.some(i=>i.summary_kind==='ai_draft')&&<p>연결된 AI 요약 초안이 없습니다. 기업 상세에서 규칙 기반 Insights를 확인할 수 있습니다.</p>}</section><div className="home-record-links"><Button variant="secondary" onClick={() => go('thesis')}>Thesis · {theses.filter(t => t.ticker).length}개</Button><Button variant="secondary" onClick={() => go('journal')}>투자일지 · {trades.filter(t => t.ticker).length}개</Button></div><p className="note">AI Insights는 기업 상세의 분석에서 확인합니다. 나의 기록은 AI가 자동으로 변경하지 않습니다.</p><Button onClick={() => go('notebook')}>사진과 기록 모아보기 →</Button></>}
     {selected === 'journey' && <><section className="home-digest"><h4>다음에 다시 확인할 생각</h4>{[...due, ...investment.filter(e => !due.some(d => d.id === e.id))].slice(0, 5).map(e => <article key={e.id}><h5>{e.title}</h5><p>{oneLine(e.hypothesis || e.text, '내 가설을 기록해보세요.')}</p><p className="note">{e.reviewDate ? `다음 점검 ${e.reviewDate}` : '점검일 미설정'} · 생각의 변화 {e.revisions.length}회</p></article>)}{!investment.length && <p>새로운 가설을 저널에 남기고, 여정에서 증거와 방향을 다시 살펴보세요.</p>}</section><Button onClick={() => go('tracking')}>회고와 대응 이어가기 →</Button></>}
    </div>
   </motion.section></Dialog.Content>}
  </AnimatePresence></Dialog.Portal></Dialog.Root>
 </section></LayoutGroup>
}
