import {AppIcon} from './AppIcon'
import {unifiedPages} from '../lib/unifiedJournal'
import type {FinancialReference} from './JournalEditor'
import type {Session} from '../lib/session'
import {ReflectionPanel} from './ReflectionPanel'
import {DecisionQueue} from './DecisionQueue'
import {reviewStatus,reviewLabels,reviewOrder,decisionSearch,decisionActivityDate} from '../lib/decisionReview'
import { instrumentLabel } from '../lib/instrumentLabel'
import { SectionHeading, editorialPageHeadings } from './SectionHeading'
import { useVisualStyle, coverPhoto } from './VisualStyle'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import type { EditableRow } from '../types'
import type { InsightsFeed } from '../lib/leaderInsights'
import { calendarDate, calendarGroup, matchesCalendar } from '../lib/journalGallery'
import { useCardDismiss } from '../lib/useCardDismiss'
import { InkPreview } from './InkPad'
import { NotebookReadOnly } from './NotebookReadOnly'
import { downloadNotebook, entryPhotos, parseNotebook, questions, type JournalEntry } from '../lib/lifetimeJournal'
const JournalEditor = lazy(() => import('./JournalEditor'))
type Props = { session?:Session|null;financials?:FinancialReference[];mode: 'today' | 'journal' | 'journey'; storageLabel?:string;retry?:()=>Promise<void>; entries: JournalEntry[]; ready: boolean; error: string; replace: (e: JournalEntry[], importOnly?: boolean) => Promise<void>; navigate: (p: string) => void; assetFlow?:ReactNode; linkedRecords?:{theses:EditableRow[];trades:EditableRow[];insights:InsightsFeed|null}; openLinked?:(kind:'thesis'|'trade',row:EditableRow)=>void }
type Story = { key: string; title: string; kicker: string; caption: string; tone: 'photo' | 'paper' | 'type' | 'sunset'; image?: string; entry?: JournalEntry; action: 'edit' | 'market' | 'journey' | 'reflect'; label: string }
const day = (value: string) => new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
const brandPhoto = `${import.meta.env.BASE_URL}folio-brand-photography.webp`
const brandType = `${import.meta.env.BASE_URL}folio-brand-typography.webp`
type ViewMode = 'card' | 'list'
function readViewMode(section:'journal'|'journey'):ViewMode {
 const fallback = section==='journal' ? 'card' : 'list'
 try { const value=localStorage.getItem(`folio-${section}-view`); return value==='card'||value==='list'?value:fallback }
 catch { return fallback }
}
function ViewSelector({section,view,onChange}:{section:'journal'|'journey';view:ViewMode;onChange:(next:ViewMode)=>void}) {
 return <div className="journal-view-toggle" role="group" aria-label={section==='journal'?'저널 보기 방식':'재검토 보기 방식'}>
  <button type="button" aria-label="카드형 보기" title="카드형 보기" aria-pressed={view==='card'} onClick={()=>onChange('card')}><AppIcon name="sectors" size={18}/><span>카드형</span></button>
  <button type="button" aria-label="목록형 보기" title="목록형 보기" aria-pressed={view==='list'} onClick={()=>onChange('list')}><AppIcon name="menu" size={18}/><span>목록형</span></button>
 </div>
}

function StoryCover({ story, expanded = false }: { story: Story; expanded?: boolean }) {
 return <>
  {story.image && <motion.img layoutId={`cover-${story.key}`} src={story.image} alt="" draggable={false} loading="eager" />}
  <div className="story-cover-copy">
   <span className="story-kicker">{story.kicker}</span>
   <motion.h3 layoutId={`title-${story.key}`}>{story.title}</motion.h3>
  </div>
  {story.tone === 'paper' && <div className="story-paper-art" aria-hidden="true">{story.entry?.ink.length ? <InkPreview strokes={story.entry.ink} /> : <span>생각은<br />계속 자랍니다.</span>}</div>}
  {story.tone === 'sunset' && <div className="story-journey-art" aria-hidden="true"><span>어제의 생각,<br />오늘의 시선.</span></div>}
  {!expanded && <div className="story-cover-footer"><span>{story.caption}</span><span className="story-open" aria-hidden="true">↗</span></div>}
 </>
}

export function LifetimeJournal({ mode, entries, ready, error, replace, navigate, assetFlow, linkedRecords, openLinked, storageLabel='이 기기에 보관한 기록',retry,session=null,financials=[] }: Props) {
 const {photoStyle}=useVisualStyle()
 const [selected, setSelected] = useState<Story | undefined>(), [open, setOpen] = useState(false), [editing,setEditing] = useState(false), [dirty, setDirty] = useState(false), [filter, setFilter] = useState('all'), [query, setQuery] = useState(''), [notice, setNotice] = useState('')
 const [year,setYear]=useState(''),[month,setMonth]=useState(''),[date,setDate]=useState(''),[scale,setScale]=useState<'year'|'month'|'day'>('month'),[limit,setLimit]=useState(40)
 const [reviewFilter,setReviewFilter]=useState('all')
 const [journalView,setJournalView]=useState<ViewMode>(()=>readViewMode('journal'))
 const [reviewView,setReviewView]=useState<ViewMode>(()=>readViewMode('journey'))
 const activeView=mode==='journey'?reviewView:journalView
 function selectView(next:ViewMode){
  if(mode==='journey')setReviewView(next);else setJournalView(next)
  try { localStorage.setItem(`folio-${mode==='journey'?'journey':'journal'}-view`,next) } catch { /* Storage may be unavailable in private mode. */ }
 }
 const [calendarOpen,setCalendarOpen]=useState(false)
 const importRef = useRef<HTMLInputElement>(null), returnFocus = useRef<HTMLElement | null>(null), reduce = useReducedMotion()
 const sorted = unifiedPages(entries,linkedRecords?.theses||[],linkedRecords?.trades||[]).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
 const investmentPages = sorted.filter(e=>e.kind==='investment')
 const today = new Date().toLocaleDateString('sv-SE')
 const due = sorted.find(e => e.kind==='investment'&&reviewStatus(e)==='due'), latest = sorted[0]
 const transition = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 280, damping: 32 }
 useEffect(() => {
  if (!dirty) return
  const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
  addEventListener('beforeunload', handler)
  return () => removeEventListener('beforeunload', handler)
 }, [dirty])
 function show(story?: Story) {
  returnFocus.current = document.activeElement as HTMLElement
  setSelected(story);setEditing(!story?.entry||story.action==='reflect'); setDirty(false); setOpen(true)
 }
 function close() {
  if (dirty && !window.confirm('저장하지 않은 변경이 있습니다. 닫을까요?')) return
  if(dismiss.ref.current)dismiss.ref.current.scrollTop=0
  setOpen(false); setDirty(false)
 }
 const dismiss = useCardDismiss(open, close)
 function entryStory(e: JournalEntry, key = e.id): Story {
  return { key, entry: e, action: 'edit', title: e.title, kicker: `${day(e.createdAt)} · ${e.kind === 'life' ? '일상' : '투자'}`, caption: '나의 페이지 펼치기', image: entryPhotos(e)[0], tone: entryPhotos(e).length ? 'photo' : 'paper', label: `${e.title} 기록 열기` }
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
   {journalView==='card'&&(entryPhotos(e).length>0?<motion.img layoutId={`cover-${story.key}`} src={entryPhotos(e)[0]} alt="" loading="lazy"/>:<div className="journal-thumbnail-paper" aria-hidden="true">{e.ink.length?<InkPreview strokes={e.ink}/>:<span>{e.kind==='life'?'LIFE':'THOUGHTS'}</span>}</div>)}
   <div className="journal-story-copy"><time>{story.kicker}</time>{journalView==='list'&&e.ticker&&<small className="journal-list-instrument">{e.ticker.replace(/^US:/,'')}</small>}<motion.h3 layoutId={`title-${story.key}`}>{e.title}</motion.h3><p>{(e.hypothesis || e.text || e.answer).slice(0, 180) || '생각을 이어 써보세요.'}</p>{journalView==='card'&&<span>페이지 펼치기</span>}</div>
  </motion.button>
 }
 const list = sorted.filter(e => (mode!=='journey'||reviewFilter==='all'||reviewStatus(e)===reviewFilter) && (mode!=='journey'||e.kind==='investment') && matchesCalendar(mode==='journey'?decisionActivityDate(e):e.createdAt,year,month,date) && (filter === 'all' || e.kind === filter) && `${e.title} ${e.text} ${e.answer} ${e.hypothesis||''} ${e.counterEvidence||''} ${e.ticker} ${e.place} ${mode==='journey'?decisionSearch(e):''}`.toLowerCase().includes(query.toLowerCase())).sort(mode==='journey'?reviewOrder:()=>0)
 const dates = [...sorted.filter(e=>mode!=='journey'||e.kind==='investment').map(e=>calendarDate(mode==='journey'?decisionActivityDate(e):e.createdAt))].filter(Boolean)
 const years = [...new Set(dates.map(d=>d.slice(0,4)))].sort().reverse()
 const months = [...new Set(dates.filter(d=>!year||d.startsWith(year)).map(d=>d.slice(5,7)))].sort()
 const days = [...new Set(dates.filter(d=>(!year||d.startsWith(year))&&(!month||d.slice(5,7)===month)).map(d=>d.slice(8,10)))].sort()
 useEffect(()=>setLimit(40),[query,filter,year,month,date,scale,reviewFilter])
 const calendarControls = <div className="journal-calendar" aria-label="기록 날짜 분류">
  <label>연도<select aria-label="기록 연도" value={year} onChange={e=>{setYear(e.target.value);setMonth('');setDate('')}}><option value="">모든 연도</option>{years.map(v=><option key={v} value={v}>{v}년</option>)}</select></label>
  <label>월<select aria-label="기록 월" value={month} onChange={e=>{setMonth(e.target.value);setDate('')}}><option value="">모든 월</option>{months.map(v=><option key={v} value={v}>{Number(v)}월</option>)}</select></label>
  <label>일<select aria-label="기록 일" value={date} onChange={e=>setDate(e.target.value)}><option value="">모든 일</option>{days.map(v=><option key={v} value={v}>{Number(v)}일</option>)}</select></label>
  {mode!=='journey'&&<label>모아보기<select aria-label="기록 묶음" value={scale} onChange={e=>setScale(e.target.value as typeof scale)}><option value="year">연도별</option><option value="month">월별</option><option value="day">일별</option></select></label>}
 </div>
 const search = <input className="journal-search" aria-label="내 기록 검색" placeholder={mode==='journey'?'Thesis, 종목, 판단, 새 증거 검색':'제목, 종목, 기록으로 검색'} value={query} onChange={e=>setQuery(e.target.value)}/>
 const collectionFilters = <aside className="journal-collection-filters" data-dates-open={calendarOpen} aria-label="기록 검색 및 날짜 필터"><h3>{mode==='journey'?'판단 찾기':'기록 찾기'}</h3>{search}<Button className="journal-date-toggle" variant="ghost" aria-expanded={calendarOpen} onClick={()=>setCalendarOpen(v=>!v)}>{year?`${year}년${month?` · ${Number(month)}월`:''}${date?` · ${Number(date)}일`:''}`:mode==='journey'?'날짜':'날짜 · 모아보기'}</Button>{calendarControls}{(query||year||month||date)&&<Button variant="ghost" onClick={()=>{setQuery('');setYear('');setMonth('');setDate('')}}>검색·날짜 초기화</Button>}<p className="journal-collection-hint">{mode==='journey'?'점검일이나 최근 판단일로 찾습니다. 원본 글은 저널에 보관됩니다.':<>날짜별로 모으고,<br/>그때의 생각을 다시 읽습니다.</>}</p></aside>
 function gallery(items:JournalEntry[]){
  const groups = new Map<string,JournalEntry[]>()
  for(const item of items.slice(0,limit)){const key=calendarGroup(item.createdAt,scale);groups.set(key,[...(groups.get(key)||[]),item])}
  return <><div className="journal-albums">{[...groups].map(([group,records])=><section key={group} className="journal-album"><h4>{group.replace(/-/g,' · ')} <small>{records.length}개의 기록</small></h4><div className={`journal-gallery journal-gallery--${journalView}`}>{records.map(card)}</div></section>)}</div>{items.length>limit&&<Button variant="secondary" onClick={()=>setLimit(v=>v+40)}>기록 더 보기 · {items.length-limit}개</Button>}</>
 }
 function go(page: string) { setOpen(false); navigate(page) }
 return <LayoutGroup id={`folio-${mode}`}><div className={`lifetime-workspace lifetime-${mode}`}>
  {mode === 'today' ? <>
   <header className="lifetime-heading today-heading"><div><time>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</time><h2>오늘,<br/>어떤 생각이 남았나요?</h2></div><Button variant="secondary" disabled={!ready} onClick={()=>show()}>새 페이지 쓰기</Button></header>
   <div className="today-stories">{stories.map((story, i) => <motion.button key={story.key} type="button" layoutId={`frame-${story.key}`} transition={transition} className={`today-story story-${story.tone}${i === 0 ? ' journal-story-hero' : ''}`} aria-label={story.label} disabled={!ready && story.action === 'edit'} onClick={() => show(story)}><StoryCover story={story} /></motion.button>)}</div>
   <div className="today-write"><p>오늘 발견한 작은 변화도, 아직 정리되지 않은 생각도.</p></div>
  </> : mode === 'journal' ? <>
   <SectionHeading kind="journal" {...editorialPageHeadings.journal}><Button disabled={!ready} onClick={() => show()}>새 페이지</Button></SectionHeading>
   <Tabs value={filter} onValueChange={setFilter}>
    <TabsList className="journal-magazine-tabs" aria-label="저널 분류"><TabsTrigger value="all">전체</TabsTrigger><TabsTrigger value="life">일상</TabsTrigger><TabsTrigger value="investment">투자</TabsTrigger></TabsList>
    <div className="journal-collection">{collectionFilters}<div className="journal-collection-content">
     <header className="journal-collection-heading"><h3>나의 페이지 <span>{list.length}개</span></h3><div className="journal-heading-actions"><p role="status">{storageLabel}</p><ViewSelector section="journal" view={journalView} onChange={selectView}/></div></header>
     {['all', 'life', 'investment'].map(key => <TabsContent key={key} value={key}>{gallery(list)}{!list.length && (entries.length?<p className="journal-empty">조건에 맞는 기록이 없습니다.</p>:<div className="journal-empty journal-empty-cover"><img src={coverPhoto('journal',photoStyle)} alt=""/><div><span className="journey-kicker">YOUR FIRST PAGE</span><h3>생각은 한 페이지에서 시작됩니다.</h3><p>아직 남긴 페이지가 없습니다. 사진 한 장이나 문장 하나로 시작해보세요.</p><Button variant="secondary" disabled={!ready} onClick={()=>show()}>첫 페이지 쓰기</Button></div></div>)}</TabsContent>)}
    </div></div>
   </Tabs>
   <details className="journal-linked-tools"><summary>AI Insights · 연결된 관찰</summary>{linkedRecords?.insights?.items.filter(i=>Date.parse(i.expires_at)>Date.now()).slice(0,5).map(i=><article key={i.market+i.ticker}><h4>{i.headline}</h4><p>{i.summary||i.source.title}</p><a href={i.source.url} target="_blank" rel="noopener noreferrer">{i.source.publisher} · {i.summary_kind==='ai_draft'?'AI 요약 초안':'원문 제목'} ↗</a></article>)}{!linkedRecords?.insights?.items.length&&<p className="note">연결된 자동 수집 자료가 없습니다. 기업 상세에서 규칙 기반 Insights를 확인할 수 있습니다.</p>}</details>
   <details className="journal-backup"><summary>저장 및 백업</summary><div className="journal-backup-actions"><span>{storageLabel}</span><Button variant="ghost" disabled={!ready || !entries.length} onClick={() => downloadNotebook(entries)}>백업 내보내기</Button><Button variant="ghost" disabled={!ready} onClick={() => importRef.current?.click()}>백업 가져오기</Button><input ref={importRef} type="file" accept="application/json,.json" className="sr-only" aria-label="저널 백업 파일" onChange={async e => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
    try { if (file.size > 20000000) throw Error('20MB 이하 파일을 선택하세요.'); const incoming = parseNotebook(await file.text()); const ids = new Set(entries.map(x => x.id)); const additions = incoming.filter(x => !ids.has(x.id)); await replace(additions, true); setNotice(`${additions.length}개 기록을 가져왔습니다. 기존 기록은 유지했습니다.`) } catch (err) { setNotice((err as Error).message) }
   }} /></div></details>
  </> : <>
   <section className="journey-review">
    <header className="journal-review-heading"><div><span className="journey-kicker">DECISION REVIEW</span><h3>지금 점검할 판단</h3></div><p>새 증거를 확인하고, 판단을 유지·수정·종료한 뒤 다음 점검을 정합니다.</p></header>
    <div className="journal-collection">{collectionFilters}<div className="journal-collection-content">
     <div className="reflection-filters" role="group" aria-label="회고 상태">{[['all','전체'],['due',reviewLabels.due],['planned',reviewLabels.planned],['done',reviewLabels.done],['closed',reviewLabels.closed]].map(([key,label])=><Button key={key} variant="ghost" aria-pressed={reviewFilter===key} onClick={()=>setReviewFilter(key)}>{label} · {key==='all'?investmentPages.length:investmentPages.filter(e=>reviewStatus(e)===key).length}</Button>)}</div><header className="journal-collection-heading"><h3>점검 대기열 <span>{list.length}개</span></h3><div className="journal-heading-actions"><p>우선 점검할 판단부터 표시합니다.</p><ViewSelector section="journey" view={reviewView} onChange={selectView}/></div></header>
     <DecisionQueue entries={list} view={reviewView} limit={limit} onMore={()=>setLimit(v=>v+40)} onReview={e=>show({...entryStory(e,`review-${e.id}`),action:'reflect'})} onOpenOriginal={e=>show(entryStory(e))}/>
     {!list.length&&<div className="journal-empty journal-empty-cover"><img src={coverPhoto('journey',photoStyle)} alt=""/><div><span className="journey-kicker">A THOUGHT TO RETURN TO</span><h3>점검할 판단을 준비합니다.</h3><p>{investmentPages.length?'조건에 맞는 투자 기록이 없습니다.':'아직 돌아볼 투자 기록이 없습니다. 가설과 반대 증거를 한 페이지에 남겨보세요.'}</p><Button variant="secondary" onClick={()=>navigate('notebook')}>투자 기록 남기기</Button></div></div>}
     {assetFlow}
    </div></div>
   </section>
  </>}
  {error && <div role="alert"><p>{error}</p>{retry&&<Button variant="secondary" onClick={()=>void retry()}>동기화 다시 시도</Button>}</div>}{!ready && !error && <p role="status">나의 기록을 불러오는 중…</p>}{notice && <p role="status">{notice}</p>}
  <DialogPrimitive.Root open={open} onOpenChange={value => { if (!value) close() }}>
   <DialogPrimitive.Portal forceMount><AnimatePresence onExitComplete={() => returnFocus.current?.isConnected && returnFocus.current.focus({preventScroll:true})}>
    {open && <DialogPrimitive.Overlay forceMount asChild><motion.div className="story-dialog-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .2 }} /></DialogPrimitive.Overlay>}
    {open && <DialogPrimitive.Content forceMount asChild onOpenAutoFocus={e => { e.preventDefault(); dismiss.ref.current?.querySelector<HTMLButtonElement>('.card-dismiss-handle')?.focus() }} onCloseAutoFocus={e => e.preventDefault()} onEscapeKeyDown={e => { e.preventDefault(); close() }} onPointerDownOutside={e => { e.preventDefault(); close() }}>
     <motion.section ref={dismiss.ref} style={{ y: dismiss.y }} layoutId={selected ? `frame-${selected.key}` : undefined} layoutScroll transition={transition} className={"journal-dialog story-dialog"+(!selected||selected.action==='reflect'||selected.action==='edit'&&editing?' notebook-writing':'')} initial={selected ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: selected ? 1 : 0 }}>
      <button type="button" className="card-dismiss-handle" aria-label="기록 닫기" title="아래로 당겨 닫기" onClick={close}><span aria-hidden="true"/></button>
      {selected && <div className={`story-detail-cover story-${selected.tone}`}><StoryCover story={selected} expanded /></div>}
      <motion.div className="story-detail-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .18, delay: reduce ? 0 : .15 }}>
       <div className="journal-dialog-header"><Button variant="ghost" size="icon" aria-label="목록으로 돌아가기" onClick={close}><AppIcon name="back"/></Button><div><DialogPrimitive.Title>{selected?.action==='reflect'?'판단 재점검':selected?.action === 'market' ? '세상의 흐름 발견하기' : selected?.action === 'journey' ? '나의 투자 여정' : selected?.entry ? '나의 페이지' : '새 페이지'}</DialogPrimitive.Title><DialogPrimitive.Description>{selected?.action === 'edit' || !selected ? storageLabel : '관찰과 판단을 이어가는 Folio'}</DialogPrimitive.Description></div></div>
       {selected?.action==='reflect'&&selected.entry?<ReflectionPanel entry={selected.entry} onDirty={setDirty} onSave={async e=>{await replace([e]);if(dismiss.ref.current)dismiss.ref.current.scrollTop=0;setDirty(false);setOpen(false)}}/>:selected?.action === 'market' ? <div className="story-reading"><p>시장의 움직임을 살펴보고, 무엇을 발견했는지 나의 말로 남겨보세요.</p><div className="story-destinations"><Button onClick={() => go('analysis')}>오늘의 주도주 →</Button><Button variant="secondary" onClick={() => go('dashboard')}>시장 요약 →</Button><Button variant="secondary" onClick={() => go('signal')}>시장 신호 →</Button></div></div> : selected?.action === 'journey' ? <div className="story-reading"><p>그때 보았던 증거와 지금의 결과를 나란히 읽어보세요. 생각이 바뀌어도 처음 남긴 판단은 수정 이력에 남습니다.</p><Button onClick={() => go('tracking')}>나의 여정 돌아보기 →</Button></div> : selected?.entry&&selected.action==='edit'&&!editing ? <article className="journal-page-reader" aria-label="저널 읽기">
         <div className="journal-read-actions"><time dateTime={selected.entry.createdAt}>{day(selected.entry.createdAt)}</time><Button variant="ghost" onClick={()=>setEditing(true)}>수정</Button></div>
         <h2>{selected.entry.title}</h2>
         {selected.entry.ticker&&<p className="journal-reader-meta">{selected.entry.ticker}</p>}
         {entryPhotos(selected.entry).length>0&&<div className="journal-reader-photos">{entryPhotos(selected.entry).map((src,i)=><img key={i} src={src} alt={selected.entry!.title+' 사진 '+(i+1)} loading="lazy"/>)}</div>}
         {selected.entry.body?.content?.some(node=>node.content?.length||node.type!=='paragraph')?<NotebookReadOnly body={selected.entry.body}/>:<p className="journal-reader-text">{selected.entry.text||selected.entry.answer||'본문이 없습니다.'}</p>}
         {selected.entry.ink.length>0&&<div className="journal-reader-ink"><InkPreview strokes={selected.entry.ink} fit/></div>}
         {selected.entry.kind==='investment'&&<div className="journal-reader-investment">
           {selected.entry.hypothesis&&<section><h3>내 가설</h3><p>{selected.entry.hypothesis}</p></section>}
           {selected.entry.counterEvidence&&<section><h3>반대 증거</h3><p>{selected.entry.counterEvidence}</p></section>}
         </div>}
        </article> : <Suspense fallback={<p role="status">편집기를 여는 중…</p>}><JournalEditor key={selected?.entry?.id || 'new'} session={session} financials={financials} entry={selected?.entry} storageLabel={storageLabel} initialQuestion={selected?.key === 'today-question' ? questions[2] : undefined} onDirty={setDirty} onSave={async e => { await replace([e]); if(dismiss.ref.current)dismiss.ref.current.scrollTop=0; setDirty(false); setOpen(false) }} /></Suspense>}
      </motion.div>
     </motion.section>
    </DialogPrimitive.Content>}
   </AnimatePresence></DialogPrimitive.Portal>
  </DialogPrimitive.Root>
 </div></LayoutGroup>
}
