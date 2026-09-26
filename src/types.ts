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
