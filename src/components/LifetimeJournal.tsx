import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { AppIcon } from './AppIcon'
import { InkPreview } from './InkPad'
import { downloadNotebook, parseNotebook, questions, type JournalEntry } from '../lib/lifetimeJournal'
const JournalEditor = lazy(() => import('./JournalEditor'))
type Props = { mode: 'today' | 'journal' | 'journey'; entries: JournalEntry[]; ready: boolean; error: string; replace: (e: JournalEntry[], importOnly?: boolean) => Promise<void>; navigate: (p: string) => void }
type Story = { key: string; title: string; kicker: string; caption: string; tone: 'photo' | 'paper' | 'type' | 'sunset'; image?: string; entry?: JournalEntry; action: 'edit' | 'market' | 'journey'; label: string }
const day = (value: string) => new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
const brandPhoto = `${import.meta.env.BASE_URL}folio-brand-photography.webp`
const brandType = `${import.meta.env.BASE_URL}folio-brand-typography.webp`

function StoryCover({ story, expanded = false }: { story: Story; expanded?: boolean }) {
 return <>
  {story.image && <motion.img layoutId={`cover-${story.key}`} src={story.image} alt="" loading="eager" />}
  <div className="story-cover-copy">
   <span className="story-kicker">{story.kicker}</span>
   <motion.h3 layoutId={`title-${story.key}`}>{story.title}</motion.h3>
  </div>
  {story.tone === 'paper' && <div className="story-paper-art" aria-hidden="true">{story.entry?.ink.length ? <InkPreview strokes={story.entry.ink} /> : <span>생각은<br />계속 자랍니다.</span>}</div>}
  {story.tone === 'sunset' && <div className="story-journey-art" aria-hidden="true"><span>어제의 생각,<br />오늘의 시선.</span></div>}
  {!expanded && <div className="story-cover-footer"><span>{story.caption}</span><span className="story-open" aria-hidden="true">↗</span></div>}
 </>
}

export function LifetimeJournal({ mode, entries, ready, error, replace, navigate }: Props) {
 const [selected, setSelected] = useState<Story | undefined>(), [open, setOpen] = useState(false), [dirty, setDirty] = useState(false), [filter, setFilter] = useState('all'), [query, setQuery] = useState(''), [notice, setNotice] = useState('')
 const importRef = useRef<HTMLInputElement>(null), returnFocus = useRef<HTMLElement | null>(null), reduce = useReducedMotion()
 const sorted = entries.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
 const today = new Date().toLocaleDateString('sv-SE')
 const due = sorted.find(e => e.reviewDate && e.reviewDate <= today), latest = sorted[0]
 const transition = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 280, damping: 32 }
 useEffect(() => {
  if (!dirty) return
  const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
  addEventListener('beforeunload', handler)
  return () => removeEventListener('beforeunload', handler)
 }, [dirty])
 function show(story?: Story) {
  returnFocus.current = document.activeElement as HTMLElement
  setSelected(story); setDirty(false); setOpen(true)
 }
 function close() {
  if (dirty && !window.confirm('저장하지 않은 변경이 있습니다. 닫을까요?')) return
  setOpen(false); setDirty(false)
 }
 function entryStory(e: JournalEntry, key = e.id): Story {
  return { key, entry: e, action: 'edit', title: e.title, kicker: `${day(e.createdAt)} · ${e.kind === 'life' ? '일상' : '투자'}`, caption: '나의 페이지 펼치기', image: e.photo, tone: e.photo ? 'photo' : 'paper', label: `${e.title} 기록 열기` }
 }
 const stories: Story[] = [
  latest ? entryStory(latest, 'today-page') : { key: 'today-page', title: '나의 기록으로\n시작하는 투자 여정', kicker: 'YOUR FIRST PAGE', caption: '첫 페이지 쓰기', image: brandPhoto, tone: 'photo', action: 'edit', label: '첫 페이지 쓰기' },
  due ? { ...entryStory(due, 'today-question'), kicker: '다시 살펴볼 생각', caption: '그때의 판단 다시 읽기' } : { key: 'today-question', title: questions[2], kicker: '이어갈 생각', caption: '질문에 한 줄 남기기', tone: 'paper', action: 'edit', label: '오늘의 질문 기록하기' },
  { key: 'today-market', title: '세상의 흐름을\n나의 관점으로', kicker: 'DISCOVER', caption: '오늘의 시장과 주도주', image: brandType, tone: 'type', action: 'market', label: '시장 발견 카드 열기' },
  { key: 'today-journey', title: '그때의 나,\n지금의 나', kicker: 'A LIFETIME IN PAGES', caption: entries.length ? `${entries.length}개의 페이지로 이어지는 여정` : '한 페이지씩 쌓이는 나의 시간', tone: 'sunset', action: 'journey', label: '나의 여정 카드 열기' },
 ]
 function card(e: JournalEntry) {
  const story = entryStory(e)
  return <motion.button type="button" layoutId={`frame-${story.key}`} transition={transition} className="journal-story" onClick={() => show(story)} key={e.id} aria-label={story.label}>
   {e.photo && <img src={e.photo} alt="" loading="lazy" />}
   <div className="journal-story-copy"><time>{story.kicker}</time><h3>{e.title}</h3>{e.ink.length ? <InkPreview strokes={e.ink} /> : <p>{e.text.slice(0, 180) || e.answer || '생각을 이어 써보세요.'}</p>}<span>페이지 펼치기 →</span></div>
  </motion.button>
 }
 const list = sorted.filter(e => (filter === 'all' || e.kind === filter) && `${e.title} ${e.text} ${e.answer} ${e.ticker} ${e.place}`.toLowerCase().includes(query.toLowerCase()))
 function go(page: string) { setOpen(false); navigate(page) }
 return <LayoutGroup id={`folio-${mode}`}><div className={`lifetime-workspace lifetime-${mode}`}>
  {mode === 'today' ? <>
   <header className="lifetime-heading today-heading"><div><time>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</time><h2>오늘</h2></div><p>발견하고, 기록하고, 다시 생각하다.</p></header>
   <div className="today-stories">{stories.map((story, i) => <motion.button key={story.key} type="button" layoutId={`frame-${story.key}`} transition={transition} className={`today-story story-${story.tone}${i === 0 ? ' journal-story-hero' : ''}`} aria-label={story.label} disabled={!ready && story.action === 'edit'} onClick={() => show(story)}><StoryCover story={story} /></motion.button>)}</div>
   <div className="today-write"><p>오늘 발견한 작은 변화도, 아직 정리되지 않은 생각도.</p><Button variant="secondary" disabled={!ready} onClick={() => show()}>새 페이지 쓰기</Button></div>
  </> : mode === 'journal' ? <>
   <header className="lifetime-heading"><span className="journey-kicker">MY PAGES</span><h2>나의 생각이 쌓이는 곳</h2><p>관찰, 판단, 그리고 일상의 아름다움.</p><Button disabled={!ready} onClick={() => show()}>새 페이지</Button></header>
   <div className="journal-links"><Button variant="ghost" onClick={() => navigate('thesis')}>종목별 Thesis →</Button><Button variant="ghost" onClick={() => navigate('journal')}>매매 기록 →</Button><Button variant="ghost" onClick={() => navigate('research')}>리서치 노트 →</Button></div>
   <Tabs value={filter} onValueChange={setFilter}><TabsList aria-label="저널 분류"><TabsTrigger value="all">전체</TabsTrigger><TabsTrigger value="life">일상</TabsTrigger><TabsTrigger value="investment">투자</TabsTrigger></TabsList><input className="journal-search" aria-label="내 기록 검색" placeholder="내 기록 검색" value={query} onChange={e => setQuery(e.target.value)} />{['all', 'life', 'investment'].map(key => <TabsContent key={key} value={key}><div className="journal-gallery">{list.map(e => card(e))}</div>{!list.length && <p className="journal-empty">{entries.length ? '조건에 맞는 기록이 없습니다.' : '아직 남긴 페이지가 없습니다. 사진 한 장이나 문장 하나로 시작해보세요.'}</p>}</TabsContent>)}</Tabs>
   <div className="journal-backup"><span>이 기기 저장 · 클라우드 동기화 전</span><Button variant="ghost" disabled={!ready || !entries.length} onClick={() => downloadNotebook(entries)}>백업 내보내기</Button><Button variant="ghost" disabled={!ready} onClick={() => importRef.current?.click()}>백업 가져오기</Button><input ref={importRef} type="file" accept="application/json,.json" className="sr-only" aria-label="저널 백업 파일" onChange={async e => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
    try { if (file.size > 20000000) throw Error('20MB 이하 파일을 선택하세요.'); const incoming = parseNotebook(await file.text()); const ids = new Set(entries.map(x => x.id)); const additions = incoming.filter(x => !ids.has(x.id)); await replace(additions, true); setNotice(`${additions.length}개 기록을 가져왔습니다. 기존 기록은 유지했습니다.`) } catch (err) { setNotice((err as Error).message) }
   }} /></div>
  </> : <>
   <header className="lifetime-heading"><span className="journey-kicker">A LIFETIME IN PAGES</span><h2>그때의 나, 지금의 나</h2><p>결과와 판단을 나란히 놓고, 다음 결정을 준비합니다.</p></header>
   <div className="journal-timeline">{sorted.map(e => <article key={e.id}><time>{day(e.createdAt)}</time>{card(e)}<p>{e.revisions.length ? `생각의 변화 ${e.revisions.length}회 · 처음 쓴 판단부터 다시 읽어보세요.` : '처음 남긴 생각'}</p></article>)}</div>{!entries.length && <div className="journal-empty"><p>저널에 남긴 기록이 이곳에서 시간의 흐름으로 이어집니다.</p><Button variant="secondary" onClick={() => navigate('notebook')}>나의 첫 기록 남기기</Button></div>}
  </>}
  {error && <p role="alert">{error}</p>}{!ready && !error && <p role="status">나의 기록을 불러오는 중…</p>}{notice && <p role="status">{notice}</p>}
  <DialogPrimitive.Root open={open} onOpenChange={value => { if (!value) close() }}>
   <DialogPrimitive.Portal forceMount><AnimatePresence onExitComplete={() => returnFocus.current?.isConnected && returnFocus.current.focus()}>
    {open && <DialogPrimitive.Overlay forceMount asChild><motion.div className="story-dialog-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .2 }} /></DialogPrimitive.Overlay>}
    {open && <DialogPrimitive.Content forceMount asChild onOpenAutoFocus={e => { e.preventDefault(); document.querySelector<HTMLButtonElement>('.journal-dialog-close')?.focus() }} onCloseAutoFocus={e => e.preventDefault()} onEscapeKeyDown={e => { e.preventDefault(); close() }} onPointerDownOutside={e => e.preventDefault()}>
     <motion.section layoutId={selected ? `frame-${selected.key}` : undefined} layoutScroll transition={transition} className="journal-dialog story-dialog" initial={selected ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={selected ? { opacity: 1 } : { opacity: 0, y: 16 }}>
      <Button variant="secondary" size="icon" className="journal-dialog-close" aria-label="기록 닫기" onClick={close}><AppIcon name="close" /></Button>
      {selected && <div className={`story-detail-cover story-${selected.tone}`}><StoryCover story={selected} expanded /></div>}
      <motion.div className="story-detail-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .18, delay: reduce ? 0 : .15 }}>
       <div className="journal-dialog-header"><div><DialogPrimitive.Title>{selected?.action === 'market' ? '세상의 흐름 발견하기' : selected?.action === 'journey' ? '나의 투자 여정' : selected?.entry ? '나의 페이지' : '새 페이지'}</DialogPrimitive.Title><DialogPrimitive.Description>{selected?.action === 'edit' || !selected ? '기기 저장 · 사진과 손글씨, 판단의 흔적' : '관찰과 판단을 이어가는 Folio'}</DialogPrimitive.Description></div></div>
       {selected?.action === 'market' ? <div className="story-reading"><p>시장의 움직임을 살펴보고, 무엇을 발견했는지 나의 말로 남겨보세요.</p><div className="story-destinations"><Button onClick={() => go('analysis')}>오늘의 주도주 →</Button><Button variant="secondary" onClick={() => go('dashboard')}>시장 요약 →</Button><Button variant="secondary" onClick={() => go('signal')}>시장 신호 →</Button></div></div> : selected?.action === 'journey' ? <div className="story-reading"><p>그때 보았던 증거와 지금의 결과를 나란히 읽어보세요. 생각이 바뀌어도 처음 남긴 판단은 수정 이력에 남습니다.</p><Button onClick={() => go('tracking')}>나의 여정 돌아보기 →</Button></div> : <Suspense fallback={<p role="status">편집기를 여는 중…</p>}><JournalEditor key={selected?.entry?.id || 'new'} entry={selected?.entry} initialQuestion={selected?.key === 'today-question' ? questions[2] : undefined} onDirty={setDirty} onSave={async e => { await replace([e]); setDirty(false); setOpen(false) }} /></Suspense>}
      </motion.div>
     </motion.section>
    </DialogPrimitive.Content>}
   </AnimatePresence></DialogPrimitive.Portal>
  </DialogPrimitive.Root>
 </div></LayoutGroup>
}
