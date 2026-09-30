export type Market = 'US' | 'KR'

export type LeaderRow = {
  id: string
  market: Market
  ticker: string
  name: string
  asset_class: string
  sector: string
  industry: string
  exchange?: string | null
  classification_scheme?: string | null
  classification_source?: string | null
  classification_as_of?: string | null
  index_memberships?: string[]
  index_statuses?: string[]
  data_status?: string | null
  price: number | null
  verdict: string
  stage: string
  action_guide: string
  leadership_class?: string
  return_1w: number | null
  return_1m: number | null
  return_3m: number | null
  return_6m: number | null
  return_12m: number | null
  return_5d?: number | null
  return_20d?: number | null
  return_50d?: number | null
  return_120d?: number | null
  return_200d?: number | null
  rs_1w: number | null
  rs_1m: number | null
  rs_3m: number | null
  rs_6m: number | null
  rs_12m: number | null
  rs_5d?: number | null
  rs_20d?: number | null
  rs_50d?: number | null
  rs_120d?: number | null
  rs_200d?: number | null
  rs_rank: number | null
  ibd_rs_estimate?: number | null
  ibd_rs_as_of?: string | null
  high_52w_distance: number | null
  volume_ratio: number | null
  adr20_pct: number | null
  rsi14: number | null
  atr_multiple: number | null
  ma50: number | null
  ma200: number | null
  leader_tt: boolean
}

export type EditableRow = Record<string, string | number | boolean | null>

export type PositionMetrics = {
  as_of: string | null
  ttm_revenue: number | null
  ttm_operating_income: number | null
  ttm_net_income: number | null
  ttm_fcf: number | null
  ttm_operating_cash_flow: number | null
  revenue_yoy: number | null
  revenue_yoy_q: number | null
  revenue_cagr_3y: number | null
  net_income_cagr_3y: number | null
  gross_margin: number | null
  operating_margin: number | null
  fcf_margin: number | null
  roic: number | null
  roic_method: string | null
  roe: number | null
  net_debt: number | null
  debt_ratio: number | null
  eps_ttm: number | null
  eps_yoy_q: number | null
  eps_cagr_3y: number | null
  diluted_shares_latest: number | null
  shares_common: number | null
  shares_preferred: number | null
  dilution_yoy: number | null
}

export type PositionLabels = { type: string | null; quality: string | null; growth: string | null; value: string | null }

/** Latest label-free (until rules pass validation) Position snapshot for one company, from position-public. */
export type PositionRow = {
  market: Market
  ticker: string
  as_of: string
  status: 'ok' | 'check_failed' | 'insufficient_data' | 'unavailable'
  rules_version: string
  methods: { fcf: string; roic: string }
  failed_checks: [string, string][]
  metrics: PositionMetrics
  labels: PositionLabels
  label_reasons: Partial<Record<keyof PositionLabels, string>>
  computed_at: string
}
