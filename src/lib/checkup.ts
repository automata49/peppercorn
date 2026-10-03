import type { LeaderRow, PositionRow } from '../types'

/**
 * CHECKUP-1 (display): IBD Stock Checkup-style pass / neutral / fail marks for the stock analysis summary.
 * It reuses thresholds the app already applies and adds no new criterion:
 *  - Swing: Trend Template (leader_tt), RS rank 70/90, IBD-style estimate 80 (주도 후보), 52W high -15%/-25%
 *    (핵심 주도 / Trend Template), RS 3M > 0 (핵심 주도 / 주도 후보).
 *  - Fundamentals: the manual auto-grade thresholds of 종목분석 기록 (EPS q 25%, sales q 20%, EPS 3y 25%, ROE 17%,
 *    operating margin 10%, debt/equity 100%, operating cash flow > 0), applied to filed facts for reference only.
 * The two sides are never added into one score (CONTRACT: Swing and Position are independent). Unknown stays '—'.
 */
export type Mark = 'pass' | 'neutral' | 'fail' | 'unknown'
export type CheckItem = { key: string; label: string; value: string; mark: Mark; note: string }

const pct = (v: number | null | undefined, signed = true) =>
  v == null || !Number.isFinite(v) ? '—' : (signed && v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'
const known = (v: number | null | undefined): v is number => v != null && Number.isFinite(v)

function tiered(v: number | null | undefined, pass: number, neutral: number, higherIsBetter = true): Mark {
  if (!known(v)) return 'unknown'
  if (higherIsBetter) return v >= pass ? 'pass' : v >= neutral ? 'neutral' : 'fail'
  return v <= pass ? 'pass' : v <= neutral ? 'neutral' : 'fail'
}

export function swingChecks(r: LeaderRow): CheckItem[] {
  const etf = r.asset_class === 'ETF'
  const rank = etf ? r.etf_rs_rank : r.rs_rank
  const trendMark: Mark = r.leader_tt ? 'pass'
    : known(r.price) && known(r.ma200) ? (r.price > r.ma200 ? 'neutral' : 'fail') : 'unknown'
  return [
    { key: 'trend', label: '추세 템플릿', value: r.leader_tt ? '통과' : trendMark === 'unknown' ? '—' : '미통과', mark: trendMark,
      note: '종가 > 50일선 > 200일선 · 고점 -25% 이내 · RS순위 ≥ 70 (미통과라도 200일선 위면 중립)' },
    { key: 'rs_rank', label: etf ? 'ETF RS순위' : 'RS순위', value: known(rank) ? String(rank) : '—', mark: tiered(rank, 90, 70),
      note: '≥ 90 통과 · 70–89 중립 · < 70 미달' },
    { key: 'ibd', label: 'IBD식 RS (추정)', value: known(r.ibd_rs_estimate) ? String(r.ibd_rs_estimate) : '—', mark: tiered(r.ibd_rs_estimate, 80, 60),
      note: '≥ 80 통과(주도 후보 기준) · 60–79 중립 · 253거래일 미만은 —' },
    { key: 'high', label: '52주 고점 대비', value: pct(r.high_52w_distance), mark: tiered(r.high_52w_distance, -.15, -.25),
      note: '-15% 이내 통과 · -25% 이내 중립' },
    { key: 'rs3m', label: 'RS 3M', value: pct(r.rs_3m), mark: known(r.rs_3m) ? (r.rs_3m > 0 ? 'pass' : 'fail') : 'unknown',
      note: '벤치마크 대비 3개월 초과수익 > 0' },
  ]
}

export function fundamentalChecks(p: PositionRow | undefined): { items: CheckItem[]; usable: boolean; reason: string } {
  const m = p?.metrics
  const usable = !!p && p.status !== 'check_failed'
  const v = (x: number | null | undefined) => (usable ? x : null)
  const ocf = v(m?.ttm_operating_cash_flow)
  const items: CheckItem[] = [
    { key: 'eps_q', label: '분기 EPS 성장 (YoY)', value: pct(v(m?.eps_yoy_q)), mark: tiered(v(m?.eps_yoy_q), .25, 0.000001), note: '≥ 25% 통과 · 0% 초과 중립' },
    { key: 'sales_q', label: '분기 매출 성장 (YoY)', value: pct(v(m?.revenue_yoy_q)), mark: tiered(v(m?.revenue_yoy_q), .20, 0.000001), note: '≥ 20% 통과 · 0% 초과 중립' },
    { key: 'eps_3y', label: 'EPS 3년 CAGR', value: pct(v(m?.eps_cagr_3y)), mark: tiered(v(m?.eps_cagr_3y), .25, 0.000001), note: '≥ 25% 통과 · 0% 초과 중립' },
    { key: 'roe', label: 'ROE', value: pct(v(m?.roe), false), mark: tiered(v(m?.roe), .17, .08), note: '≥ 17% 통과 · 8% 이상 중립' },
    { key: 'margin', label: '영업이익률', value: pct(v(m?.operating_margin), false), mark: tiered(v(m?.operating_margin), .10, 0.000001), note: '≥ 10% 통과 · 0% 초과 중립' },
    { key: 'debt', label: '부채비율 (부채/자본)', value: pct(v(m?.debt_ratio), false), mark: tiered(v(m?.debt_ratio), 1, 2, false), note: '≤ 100% 통과 · 200% 이하 중립' },
    { key: 'ocf', label: '영업현금흐름 (TTM)', value: known(ocf) ? (ocf > 0 ? '양수' : '음수') : '—', mark: known(ocf) ? (ocf > 0 ? 'pass' : 'fail') : 'unknown', note: '양수 통과' },
  ]
  const reason = !p ? '공시 데이터가 아직 적재되지 않은 종목입니다.' : p.status === 'check_failed' ? '공시 데이터 검사 실패로 표시하지 않습니다.' : `공시 기준 분기 ${m?.as_of || '—'}`
  return { items, usable, reason }
}

export const markCounts = (items: CheckItem[]) => ({
  pass: items.filter(i => i.mark === 'pass').length,
  neutral: items.filter(i => i.mark === 'neutral').length,
  fail: items.filter(i => i.mark === 'fail').length,
  known: items.filter(i => i.mark !== 'unknown').length,
})

/**
 * Position on a 2x2 map; the axes stay separate (no combined score).
 * Swing axis: the existing leadership class (핵심 주도·주도 후보·강세 전환 = strong).
 * Fundamental axis: at least 4 known checks; good = passes are the majority of known checks and cash flow is not negative.
 */
export function quadrant(leadership: string, fundamentals: CheckItem[]): { swing: 'strong' | 'weak'; fundamental: 'good' | 'weak' | 'unknown' } {
  const swing = ['핵심 주도', '주도 후보', '강세 전환'].includes(leadership) ? 'strong' : 'weak'
  const c = markCounts(fundamentals)
  if (c.known < 4) return { swing, fundamental: 'unknown' }
  const ocfFail = fundamentals.find(i => i.key === 'ocf')?.mark === 'fail'
  return { swing, fundamental: c.pass * 2 > c.known && !ocfFail ? 'good' : 'weak' }
}
