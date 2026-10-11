import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import type { EditableRow, LeaderRow } from '../types'
import { AppIcon } from './AppIcon'
import { Button } from './ui/button'

type Props = {
 rows: LeaderRow[]; research: EditableRow[]; market: 'ALL' | 'KR' | 'US'; source: string;
 onMarket: (market: 'ALL' | 'KR' | 'US') => void; getClass: (row: LeaderRow) => string;
 onSelect: (row: LeaderRow) => void; onDiscover: () => void; onJournal: () => void;
}
function httpUrl(value: unknown) {
 try { const url = new URL(String(value || '')); return /^https?:$/.test(url.protocol) ? url : null } catch { return null }
}
/** Sourced user research only. Never present a model/provider or crawler as active. */
export function leaderObservation(row: LeaderRow, research: EditableRow[]) {
 return research.map<EditableRow>(note => ({ ...note, verification: note.verification || (note.verified === false ? '반박됨' : note.verified === true ? '확인됨' : '미검증') })).filter(note => String(note.market) === row.market && String(note.ticker).trim().toUpperCase() === row.ticker.toUpperCase()
  && httpUrl(note.source) && String(note.fact || '').trim() && note.verification !== '반박됨')
  .slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0]
}
const short = (value: unknown, fallback: string) => String(value || '').trim().slice(0, 70) || fallback
const art = `${import.meta.env.BASE_URL}folio-brand-photography.webp`

export function TodayLeaders({ rows, research, market, source, onMarket, getClass, onSelect, onDiscover, onJournal }: Props) {
 const [selected, setSelected] = useState<LeaderRow | null>(null)
 const returnFocus = useRef<HTMLElement | null>(null), reduce = useReducedMotion()
 const transition = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 280, damping: 32 }
 const noteFor = (row: LeaderRow) => leaderObservation(row, research)
 const titleFor = (row: LeaderRow) => short(noteFor(row)?.title, row.action_guide || `${getClass(row)} 흐름을 확인하세요.`)
 const note = selected ? noteFor(selected) : undefined
 function cover(row: LeaderRow) {
  const observation = noteFor(row), url = httpUrl(observation?.source)
  return <>
   <motion.img layoutId={`leader-image-${row.id}`} src={art} alt="" />
   <div className="leader-cover-copy"><span>{row.market === 'KR' ? row.name : row.ticker} · {getClass(row)}</span>
    <motion.h3 layoutId={`leader-title-${row.id}`}>{titleFor(row)}</motion.h3>
   </div>
   <div className="leader-cover-footer"><small>{url ? `${url.hostname} · ${String(observation?.date || '기준일 미제공')} · 내 리서치` : '일간 시장 데이터 · 규칙 기반 요약'}<br/>Folio 이미지 · 원문 사진 아님</small><span className="leader-open" aria-hidden="true"><AppIcon name="arrow" /></span></div>
  </>
 }
 return <LayoutGroup id="today-leaders"><section className="lifetime-workspace lifetime-today leader-home" aria-label="오늘의 주도주">
  <header className="leader-home-heading"><time>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</time><h2>오늘의 주도주</h2>
   <div className="leader-home-controls"><div role="group" aria-label="오늘의 주도주 시장">{(['ALL', 'KR', 'US'] as const).map(value => <Button key={value} variant="ghost" aria-pressed={market === value} onClick={() => onMarket(value)}>{value === 'ALL' ? '전체' : value}</Button>)}</div><Button variant="ghost" onClick={onJournal}>저널에 기록</Button></div>
  </header>
  {source === 'demo' && <p className="leader-home-status" role="status">예시 데이터 · 실제 오늘의 주도주가 아닙니다.</p>}
  <div className="leader-covers">{rows.map(row => <motion.button key={row.id} type="button" data-ticker={row.ticker} data-market={row.market} layoutId={`leader-frame-${row.id}`} transition={transition} className="leader-cover" aria-label={`${row.market === 'KR' ? row.name : row.ticker} 관련 변화 열기`} onClick={() => { returnFocus.current = document.activeElement as HTMLElement; setSelected(row) }}>{cover(row)}</motion.button>)}</div>
  {!rows.length && <div className="leader-home-empty"><h3>선별된 주도주가 없습니다.</h3><p>현재 시장·분류의 기존 선별 기준을 통과한 종목이 없습니다.</p><Button variant="secondary" onClick={onDiscover}>발견에서 조건 확인</Button></div>}
  <footer className="leader-home-footer"><span>기존 선별 순서 · 최대 5종목</span><Button variant="ghost" onClick={onDiscover}>발견에서 전체 보기 →</Button></footer>
  <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}>
   <Dialog.Portal forceMount><AnimatePresence onExitComplete={() => { if (returnFocus.current?.isConnected) returnFocus.current.focus() }}>
    {selected && <Dialog.Overlay forceMount asChild><motion.div className="story-dialog-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .2 }} /></Dialog.Overlay>}
    {selected && <Dialog.Content forceMount asChild onOpenAutoFocus={event => { event.preventDefault(); document.querySelector<HTMLButtonElement>('.leader-detail-close')?.focus() }} onCloseAutoFocus={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()}>
     <motion.section layoutId={`leader-frame-${selected.id}`} layoutScroll transition={transition} className="story-dialog leader-detail">
      <Button variant="secondary" size="icon" className="journal-dialog-close leader-detail-close" aria-label="카드 닫기" onClick={() => setSelected(null)}><AppIcon name="close" /></Button>
      <div className="leader-detail-cover">{cover(selected)}</div>
      <div className="leader-detail-body"><Dialog.Title>왜 오늘의 주도주인가</Dialog.Title><Dialog.Description>기존 선별 근거와 관련 자료를 구분해 확인합니다.</Dialog.Description>
       <dl className="leader-evidence"><div><dt>분류</dt><dd>{getClass(selected)}</dd></div><div><dt>RS 순위</dt><dd>{selected.rs_rank == null ? '미제공' : selected.rs_rank}</dd></div><div><dt>거래량 배수</dt><dd>{selected.volume_ratio == null ? '미제공' : `${selected.volume_ratio.toFixed(2)}x`}</dd></div></dl>
       <section><h4>주도 근거</h4><p>{selected.action_guide || '일간 데이터에서 별도의 설명을 제공하지 않았습니다.'}</p></section>
       <section><h4>관련 변화</h4>{note ? <><p>{String(note.fact)}</p>{note.interpretation && <p className="leader-interpretation">나의 해석 · {String(note.interpretation)}</p>}<p className="leader-source"><a href={httpUrl(note.source)!.href} target="_blank" rel="noopener noreferrer">원문 보기 · {httpUrl(note.source)!.hostname} ↗</a><br/>{String(note.date || '기준일 미제공')} · {String(note.verification || '미검증')}{!Number.isFinite(Date.parse(String(note.date))) ? ' · 날짜 확인 필요' : Date.now() - Date.parse(String(note.date)) > 30 * 86400000 ? ' · 오래된 자료 · 출처 재확인 필요' : ''}</p></> : <p>연결된 출처 자료가 없습니다. 리서치 노트에 이 종목의 원문과 확인한 사실을 남겨주세요.</p>}</section>
       <p className="leader-provider-note">자동 수집·AI 요약 연결 전 · 내 리서치와 규칙 기반 정보입니다.</p>
       <Button className="leader-detail-action" onClick={() => { const row = selected; setSelected(null); onSelect(row) }}>종목 자세히 보기 →</Button>
      </div>
     </motion.section>
    </Dialog.Content>}
   </AnimatePresence></Dialog.Portal>
  </Dialog.Root>
 </section></LayoutGroup>
}
