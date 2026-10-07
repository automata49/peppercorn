import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AppIcon } from './AppIcon'
import type { EditableRow, LeaderRow, PositionRow } from '../types'
import { searchRows, type RecentStock } from '../lib/search'
import { fundamentalChecks, markCounts, quadrant, swingChecks, type CheckItem, type Mark } from '../lib/checkup'

const MARK_TEXT: Record<Mark, string> = { pass: '통과', neutral: '중립', fail: '미달', unknown: '데이터 없음' }

export function MarkDot({ mark }: { mark: Mark }) {
  return <i className={'mark-dot mark-' + mark} role="img" aria-label={MARK_TEXT[mark]} title={MARK_TEXT[mark]} />
}

/** ANALYSIS-SEARCH-1: ticker, name or initial-consonant search over every loaded stock, plus recently opened ones. */
export function StockSearch({ rows, recent, onPick }: { rows: LeaderRow[]; recent: RecentStock[]; onPick: (row: LeaderRow) => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const results = useMemo(() => (query.trim() ? searchRows(rows, query, 12) : []), [rows, query])
  useEffect(() => setActive(0), [query])
  const pick = (row: LeaderRow | undefined) => { if (!row) return; onPick(row); setQuery('') }
  const byKey = useMemo(() => new Map(rows.map(r => [r.market + '|' + r.ticker, r])), [rows])
  const recentRows = recent.map(x => byKey.get(x.market + '|' + x.ticker)).filter((r): r is LeaderRow => !!r)
  return <div className="stock-search">
    <label className="sr-only" htmlFor={listId + '-input'}>종목 검색</label>
    <input id={listId + '-input'} type="search" value={query} placeholder="종목명 · 코드 · 초성 (예: ㄷㄷㅈㅈ, OKLO)" autoComplete="off"
      role="combobox" aria-expanded={results.length > 0} aria-controls={listId} aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
      onChange={e => setQuery(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(results.length - 1, a + 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
        else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]) }
        else if (e.key === 'Escape') setQuery('')
      }} />
    {query.trim() && <ul id={listId} role="listbox" className="stock-search-results">
      {results.map((r, i) => <li key={r.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
        onMouseDown={e => { e.preventDefault(); pick(r) }} onMouseEnter={() => setActive(i)}>
        <b>{r.name}</b><span>{r.market} · {r.ticker}</span><em>{r.industry || r.sector || ''}</em>
      </li>)}
      {!results.length && <li className="empty" role="option" aria-selected={false}>일치하는 종목이 없습니다. 리더보드 유니버스에 없는 종목일 수 있습니다.</li>}
    </ul>}
    {recentRows.length > 0 && <div className="recent-stocks" aria-label="최근 본 종목">
      <span>최근</span>{recentRows.map(r => <button key={r.id} type="button" onClick={() => onPick(r)}>{r.name}</button>)}
    </div>}
  </div>
}

function CheckList({ items }: { items: CheckItem[] }) {
  return <ul className="checkup-list">{items.map(i => <li key={i.key} title={i.note}>
    <MarkDot mark={i.mark} /><span>{i.label}</span><b>{i.value}</b>
  </li>)}</ul>
}

/** CHECKUP-1 summary: Swing and filed fundamentals side by side, plus a 2x2 position. Never one combined score. */
export function CheckupSummary({ row, position, leadership }: { row: LeaderRow; position?: PositionRow; leadership: string }) {
  const swing = swingChecks(row)
  const fund = fundamentalChecks(row.asset_class === 'Equity' ? position : undefined)
  const s = markCounts(swing), f = markCounts(fund.items)
  const q = quadrant(leadership, fund.items)
  const quadText = q.fundamental === 'unknown'
    ? (q.swing === 'strong' ? 'Swing 강함 · 펀더멘털 확인 불가' : 'Swing 약함 · 펀더멘털 확인 불가')
    : `Swing ${q.swing === 'strong' ? '강함' : '약함'} × 펀더멘털 ${q.fundamental === 'good' ? '양호' : '확인 필요'}`
  const dots = (items: CheckItem[]) => <div className="checkup-dots" aria-hidden="true">{items.map(i => <MarkDot key={i.key} mark={i.mark} />)}</div>
  return <section className="checkup" aria-label="종합 요약">
    <div className="checkup-cards">
      <article className="checkup-card">
        <header><h3>Swing · 모멘텀</h3><span>{leadership || '관찰'}</span></header>
        <p className="checkup-score">{s.known ? `${s.pass} / ${s.known} 통과` : '—'}</p>
        {dots(swing)}
        <p className="checkup-count">통과 {s.pass} · 중립 {s.neutral} · 미달 {s.fail}</p>
        <details><summary>항목 보기</summary><CheckList items={swing} /></details>
      </article>
      <article className="checkup-card">
        <header><h3>펀더멘털 · 공시</h3><span>{position?.status === 'ok' ? '라벨 활성' : '라벨 검증 중'}</span></header>
        <p className="checkup-score">{fund.usable && f.known ? `${f.pass} / ${f.known} 통과` : '—'}</p>
        {dots(fund.items)}
        <p className="checkup-count">{fund.usable ? `통과 ${f.pass} · 중립 ${f.neutral} · 미달 ${f.fail}` : fund.reason}</p>
        <details><summary>항목 보기</summary><CheckList items={fund.items} />
          <p className="checkup-note">{fund.usable ? fund.reason + ' · 공시 사실에 기존 자동 판정 기준을 대어 본 참고 표시이며 Position 라벨이 아닙니다.' : 'Position 라벨과 별개인 참고 표시입니다.'}</p></details>
      </article>
    </div>
    <p className="checkup-quadrant"><b>{quadText}</b><span>두 축은 서로 다른 기준이며 하나의 점수로 합치지 않습니다.</span></p>
  </section>
}

type SheetField = { field: string; auto?: string; label: string; kind: 'pct' | 'num' | 'text' | 'long' | 'select'; options?: string[]; rule?: (v: number) => boolean; ruleText?: string }
export const SHEET_FIELDS: SheetField[] = [
  { field: 'lynch_category', label: '린치 분류', kind: 'select', options: ['', '저성장', '대형우량', '고성장', '경기순환', '회생', '자산주'] },
  { field: 'eps_growth_q', auto: 'eps_growth_q_auto', label: '분기 EPS 성장률 (YoY)', kind: 'pct', rule: v => v >= .25, ruleText: '≥ 25%' },
  { field: 'sales_growth_q', auto: 'sales_growth_q_auto', label: '분기 매출 성장률 (YoY)', kind: 'pct', rule: v => v >= .20, ruleText: '≥ 20%' },
  { field: 'eps_growth_3y', auto: 'eps_growth_3y_auto', label: '연간 EPS 성장률 (3년)', kind: 'pct', rule: v => v >= .25, ruleText: '≥ 25%' },
  { field: 'roe', auto: 'roe_auto', label: 'ROE', kind: 'pct', rule: v => v >= .17, ruleText: '≥ 17%' },
  { field: 'operating_margin', auto: 'operating_margin_auto', label: '영업이익률', kind: 'pct', rule: v => v >= .10, ruleText: '≥ 10%' },
  { field: 'debt_ratio', auto: 'debt_ratio_auto', label: '부채비율', kind: 'pct', rule: v => v <= 1, ruleText: '≤ 100%' },
  { field: 'operating_cashflow_positive', auto: 'operating_cashflow_auto', label: '영업현금흐름', kind: 'select', options: ['', '양수', '음수'] },
  { field: 'pe', auto: 'pe_auto', label: 'PER', kind: 'num' },
  { field: 'peg', auto: 'peg_auto', label: 'PEG', kind: 'num', rule: v => v <= 1, ruleText: '≤ 1' },
  { field: 'moat', label: '경쟁우위 (해자)', kind: 'long' },
  { field: 'growth_driver', label: '성장 동력', kind: 'long' },
  { field: 'key_risk', label: '핵심 리스크', kind: 'long' },
  { field: 'conclusion', label: '내 결론', kind: 'text' },
]

const toNum = (v: unknown) => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const fmtAuto = (f: SheetField, v: unknown) => {
  if (f.kind === 'select' && f.field === 'operating_cashflow_positive') return v === true ? '양수' : v === false ? '음수' : '—'
  const n = toNum(v)
  if (n == null) return '—'
  return f.kind === 'pct' ? (n * 100).toFixed(1) + '%' : n.toFixed(f.field === 'peg' ? 2 : 1)
}
const inputText = (f: SheetField, v: unknown) => {
  if (f.field === 'operating_cashflow_positive') return v === true ? '양수' : v === false ? '음수' : String(v ?? '')
  if (f.kind === 'pct') { const n = toNum(v); return n == null ? '' : String(Math.round(n * 1000) / 10) }
  return v == null ? '' : String(v)
}
const parseInput = (f: SheetField, text: string): string | number | boolean | null => {
  const t = text.trim()
  if (f.field === 'operating_cashflow_positive') return t === '양수' ? true : t === '음수' ? false : null
  if (f.kind === 'pct' || f.kind === 'num') {
    if (!t) return null
    const n = Number(t.replace(/[%,\s]/g, ''))
    return Number.isFinite(n) ? (f.kind === 'pct' ? n / 100 : n) : null
  }
  return t
}
function inputMark(f: SheetField, v: unknown): Mark {
  if (f.field === 'operating_cashflow_positive') return v === true ? 'pass' : v === false ? 'fail' : 'unknown'
  if (!f.rule) return 'unknown'
  const n = toNum(v)
  return n == null ? 'unknown' : f.rule(n) ? 'pass' : 'fail'
}

function SheetInput({ f, value, onCommit }: { f: SheetField; value: unknown; onCommit: (v: string | number | boolean | null) => void }) {
  const [text, setText] = useState(inputText(f, value))
  const last = useRef(inputText(f, value))
  useEffect(() => { const t = inputText(f, value); if (t !== last.current) { last.current = t; setText(t) } }, [f, value])
  const commit = (t: string) => { if (t === last.current) return; last.current = t; onCommit(parseInput(f, t)) }
  const id = `sheet-${f.field}`
  if (f.kind === 'select') return <select id={id} aria-label={f.label} value={text} onChange={e => { setText(e.target.value); commit(e.target.value) }}>
    {f.options!.map(o => <option key={o} value={o}>{o || '선택'}</option>)}</select>
  if (f.kind === 'long') return <textarea id={id} aria-label={f.label} rows={2} value={text} onChange={e => setText(e.target.value)} onBlur={() => commit(text)} />
  return <span className="sheet-input"><input id={id} aria-label={f.label} inputMode={f.kind === 'text' ? 'text' : 'decimal'} value={text}
    onChange={e => setText(e.target.value)} onBlur={() => commit(text)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
    {f.kind === 'pct' && <i>%</i>}</span>
}

/** Vertical input sheet: rows are analysis items; columns are my input, the filed value and the input's check. */
export function AnalysisSheet({ row, record, onCreate, onChange }: { row: Pick<LeaderRow,'name'>; record?: EditableRow; onCreate: () => void; onChange: (field: string, value: string | number | boolean | null) => void }) {
  if (!record) return <div className="analysis-sheet empty-sheet">
    <p>{row.name}의 분석 기록이 아직 없습니다.</p>
    <button className="primary-action" type="button" onClick={onCreate}>분석 기록 만들기</button>
  </div>
  return <div className="analysis-sheet">
    <div className="sheet-meta"><span>분석일 {String(record.date || record.analysis_date || '—')}</span><span>통과 {String(record.pass_count || '—')}</span><b>자동 판정 {String(record.auto_grade || '—')}</b></div>
    <table className="sheet-table">
      <thead><tr><th scope="col">항목</th><th scope="col">내 입력</th><th scope="col">공시 (자동)</th><th scope="col">판정</th></tr></thead>
      <tbody>{SHEET_FIELDS.map(f => {
        const mark = inputMark(f, record[f.field])
        return <tr key={f.field} className={f.kind === 'long' ? 'sheet-long' : ''}>
          <th scope="row">{f.label}{f.ruleText && <small>{f.ruleText}</small>}</th>
          <td colSpan={f.kind === 'long' || f.kind === 'text' ? 3 : 1}><SheetInput f={f} value={record[f.field]} onCommit={v => onChange(f.field, v)} /></td>
          {f.kind !== 'long' && f.kind !== 'text' && <>
            <td className="cell-num">{f.auto ? fmtAuto(f, record[f.auto]) : '—'}</td>
            <td>{f.rule || f.field === 'operating_cashflow_positive' ? <MarkDot mark={mark} /> : '—'}</td>
          </>}
        </tr>
      })}</tbody>
    </table>
    <p className="sheet-note">판정은 내 입력만 사용합니다. 공시 값은 읽기 전용이며 내 입력을 덮어쓰지 않습니다.</p>
  </div>
}

type CompareRow = { label: string; value: (r: LeaderRow, p?: PositionRow) => string; mark: (r: LeaderRow, p?: PositionRow) => Mark }
const fromSwing = (key: string) => (r: LeaderRow) => swingChecks(r).find(i => i.key === key)!
const fromFund = (key: string) => (_: LeaderRow, p?: PositionRow) => fundamentalChecks(p).items.find(i => i.key === key)!
const SWING_LABELS = Object.fromEntries(swingChecks({ asset_class: 'Equity' } as LeaderRow).map(i => [i.key, i.label]))
const FUND_LABELS = Object.fromEntries(fundamentalChecks(undefined).items.map(i => [i.key, i.label]))

/** Up to four stocks side by side, with the same CHECKUP-1 marks. */
export function CompareView({ rows, positionOf, leadershipOf, onRemove, onSelect }: {
  rows: LeaderRow[]; positionOf: (r: LeaderRow) => PositionRow | undefined; leadershipOf: (r: LeaderRow) => string
  onRemove: (r: LeaderRow) => void; onSelect: (r: LeaderRow) => void
}) {
  if (!rows.length) return null
  const lines: CompareRow[] = [
    { label: '주도 분류', value: r => leadershipOf(r) || '—', mark: r => ['핵심 주도', '주도 후보'].includes(leadershipOf(r)) ? 'pass' : leadershipOf(r) === '강세 전환' ? 'neutral' : 'unknown' },
    ...['trend', 'rs_rank', 'ibd', 'high', 'rs3m'].map(k => ({ label: SWING_LABELS[k], value: (r: LeaderRow) => fromSwing(k)(r).value, mark: (r: LeaderRow) => fromSwing(k)(r).mark })),
    ...['sales_q', 'eps_q', 'margin', 'roe', 'debt', 'ocf'].map(k => ({ label: FUND_LABELS[k], value: (r: LeaderRow, p?: PositionRow) => fromFund(k)(r, p).value, mark: (r: LeaderRow, p?: PositionRow) => fromFund(k)(r, p).mark })),
  ]
  return <section className="compare-view" aria-label="종목 비교">
    <div className="compare-scroll"><table>
      <thead><tr><th scope="col">항목</th>{rows.map(r => <th scope="col" key={r.id}>
        <button type="button" className="compare-name" onClick={() => onSelect(r)}>{r.name}</button><small>{r.market} · {r.ticker}</small>
        <button type="button" className="compare-remove" aria-label={r.name + ' 비교에서 빼기'} onClick={() => onRemove(r)}><AppIcon name="close" size={14}/></button>
      </th>)}</tr></thead>
      <tbody>{lines.map(l => <tr key={l.label}><th scope="row">{l.label}</th>{rows.map(r => {
        const p = r.asset_class === 'Equity' ? positionOf(r) : undefined
        return <td key={r.id}><MarkDot mark={l.mark(r, p)} /><span>{l.value(r, p)}</span></td>
      })}</tr>)}</tbody>
    </table></div>
  </section>
}
