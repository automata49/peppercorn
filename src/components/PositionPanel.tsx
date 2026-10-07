import type { LeaderRow, PositionRow } from '../types'
import { POSITION_EVIDENCE, type SectionKey } from '../data/positionEvidence'

const pct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'
const plainPct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : (v * 100).toFixed(1) + '%'
const money = (v: number | null | undefined, market: string) => {
  if (v == null || !Number.isFinite(v)) return '—'
  return market === 'KR' ? (v / 1e12).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '조원'
    : '$' + (v / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'B'
}
const perShare = (v: number | null | undefined, market: string) =>
  v == null || !Number.isFinite(v) ? '—' : market === 'KR' ? Math.round(v).toLocaleString('ko-KR') + '원' : '$' + v.toFixed(2)
const ratio = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(1) + '배')
const tone = (v: number | null | undefined) => (v == null ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : '')

const SECTIONS: SectionKey[] = ['type', 'quality', 'growth', 'value']
const STATUS_TEXT: Record<PositionRow['status'], string> = {
  ok: '라벨 활성',
  unavailable: '라벨 검증 중',
  check_failed: '데이터 검사 실패',
  insufficient_data: '데이터 부족',
}

/** PER and PEG from the live price and filed EPS; shown for reference only, never used for a label. */
export function valuation(row: LeaderRow, position: PositionRow | undefined) {
  const eps = position?.metrics.eps_ttm
  const pe = row.price != null && eps != null && eps > 0 ? row.price / eps : null
  const growth = position?.metrics.eps_cagr_3y
  const peg = pe != null && growth != null && growth > 0 ? pe / (growth * 100) : null
  return { pe, peg }
}

export function PositionPanel({ row, position, status }: { row: LeaderRow; position?: PositionRow; status: 'live' | 'unavailable' | 'loading' }) {
  if (row.asset_class !== 'Equity') {
    return <section className="position-panel" data-market={row.market}><PanelHead /><p className="position-empty">ETF 등 주식 외 자산은 공시 펀더멘털 분석 대상이 아닙니다.</p></section>
  }
  if (!position) {
    const why = status === 'loading' ? '공시 펀더멘털 데이터를 불러오는 중입니다.'
      : status === 'unavailable' ? '공시 펀더멘털 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.'
      : '아직 적재되지 않은 종목입니다. 매주 월요일 대시보드 주도 종목을 수집합니다.'
    return <section className="position-panel" data-market={row.market}><PanelHead /><p className="position-empty">{why}</p><Evidence /></section>
  }
  const m = position.metrics
  const { pe, peg } = valuation(row, position)
  const facts: [string, string, string?][] = [
    ['매출 (TTM)', money(m.ttm_revenue, row.market)],
    ['분기 매출 성장 (YoY)', pct(m.revenue_yoy_q), tone(m.revenue_yoy_q)],
    ['3년 매출 CAGR', pct(m.revenue_cagr_3y), tone(m.revenue_cagr_3y)],
    ['영업이익률 (TTM)', plainPct(m.operating_margin)],
    ['FCF 마진 (TTM)', plainPct(m.fcf_margin)],
    ['ROIC', plainPct(m.roic)],
    ['ROE', plainPct(m.roe)],
    ['부채비율 (부채/자본)', plainPct(m.debt_ratio)],
    ['영업현금흐름 (TTM)', money(m.ttm_operating_cash_flow, row.market), tone(m.ttm_operating_cash_flow)],
    ['EPS (TTM, 희석)', perShare(m.eps_ttm, row.market)],
    ['분기 EPS 성장 (YoY)', pct(m.eps_yoy_q), tone(m.eps_yoy_q)],
    ['3년 EPS CAGR', pct(m.eps_cagr_3y), tone(m.eps_cagr_3y)],
    ['PER (현재가/EPS)', ratio(pe)],
    ['PEG', peg == null ? '—' : peg.toFixed(2)],
  ]
  return <section className="position-panel" data-market={row.market}>
    <PanelHead status={position.status} source={`${row.market === 'KR' ? 'DART' : 'SEC'} 공시 · 기준 분기 ${m.as_of ?? position.as_of} · 수집 ${position.computed_at.slice(0, 10)}`} />
    {position.status === 'check_failed' && <div className="position-alert"><b>데이터 검사 실패</b><span>라벨을 표시하지 않습니다. 실패 항목: {position.failed_checks.map(c => c[0]).join(', ') || '—'}</span></div>}
    <div className="position-labels">{SECTIONS.map(key => {
      const label = position.labels[key]
      const evidence = POSITION_EVIDENCE.sections[key]
      return <div key={key} className="position-label-card">
        <span>{evidence.title}</span>
        <strong>{label ?? (position.status === 'check_failed' ? '—' : '검증 중')}</strong>
        <p>{position.label_reasons[key] ?? evidence.claim}</p>
        <small title={`${evidence.metric}. ${evidence.detail}`}>과거 검증 {evidence.record} · 전향 결과 {POSITION_EVIDENCE.forwardFirstMaturity}부터</small>
      </div>
    })}</div>
    <div className="position-facts">{facts.map(([label, value, cls]) => <div key={label}><span>{label}</span><strong className={cls || ''}>{value}</strong></div>)}</div>
    <p className="position-note">PER·PEG는 현재가와 공시 EPS로 계산한 참고값이며 라벨이나 매수 판단에 쓰지 않습니다. 값이 없으면 —로 표시합니다.</p>
    <Evidence />
  </section>
}

function PanelHead({ status, source }: { status?: PositionRow['status']; source?: string }) {
  return <div className="snapshot-section-head position-head">
    <div><span>F</span><h3>공시 펀더멘털 · 라벨</h3></div>
    <div>{source && <small>{source}</small>}{status && <em className={'position-status ' + status}>{STATUS_TEXT[status]}</em>}</div>
  </div>
}

function Evidence() {
  return <details className="position-evidence">
    <summary>섹션별 검증 현황 ({POSITION_EVIDENCE.rules})</summary>
    <p>정확도는 미리 봉인한 예측의 3년 결과로만 표시합니다. 첫 결과는 {POSITION_EVIDENCE.forwardFirstMaturity}에 나옵니다. 아래는 {POSITION_EVIDENCE.source} 결과로, 참고용입니다.</p>
    <ul>{SECTIONS.map(key => {
      const e = POSITION_EVIDENCE.sections[key]
      return <li key={key}><b>{e.title}</b> <em>{e.record}</em><span>{e.metric}</span><small>{e.detail}</small></li>
    })}</ul>
  </details>
}
