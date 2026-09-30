// Recorded backtest evidence per Position section (docs/harness/POSITION_RULES_V1.md). These are past-data checks of
// the candidate rules, not accuracy: accuracy is shown only once sealed walk-forward predictions mature.
export type SectionKey = 'type' | 'quality' | 'growth' | 'value'

export type SectionEvidence = {
  title: string
  claim: string
  metric: string
  record: string
  detail: string
}

export const POSITION_EVIDENCE: {
  rules: string
  forwardFirstMaturity: string
  source: string
  sections: Record<SectionKey, SectionEvidence>
} = {
  rules: 'position-rules-v2 (비활성)',
  forwardFirstMaturity: '2026-10-28',
  source: '과거 백테스트 5회 (미국 3개 기업군 × 2014–2017, 2018–2022)',
  sections: {
    type: {
      title: 'Type',
      claim: '경기순환 업종으로 분류된 종목은 이후 3년 매출 낙폭이 더 크다',
      metric: '이후 3년 최대 매출 낙폭 중앙값 (순환주 vs 기타)',
      record: '기준 통과 4/5',
      detail: '순환주가 5회 모두 낙폭이 컸음(예: 12.3% vs 2.5%). 3번째 기업군에서 유형 유지율 78%로 기준(80%) 미달.',
    },
    quality: {
      title: 'Quality',
      claim: 'High 종목은 이후 3년 ROIC가 더 높다',
      metric: '이후 3년 평균 ROIC 중앙값 (High / Average / Low)',
      record: '기준 통과 2/5 · 순서 일치 4/5',
      detail: '예: 40.4% / 14.4% / 6.6%. 실패 3회 모두 Low 표본이 5–7건(기준 10건 미만)이었고, 그중 1회는 순서도 어긋남.',
    },
    growth: {
      title: 'Growth',
      claim: 'Durable 종목은 이후 3년 매출 성장률이 더 높다',
      metric: '이후 3년 매출 CAGR 중앙값 (Durable / Moderate / Weak)',
      record: '기준 통과 4/5',
      detail: '앞선 4회 통과(예: 9.3% / 5.3% / 4.7%). 3번째 기업군에서 순서가 맞지 않았음.',
    },
    value: {
      title: 'Value',
      claim: '가격이 요구하는 성장률이 낮을수록 실제 성장이 그 기대에 도달한다',
      metric: '실제 성장이 가격 내재 성장률에 도달한 비율 (Undemanding / Reasonable / Demanding)',
      record: '방향 일치 5/5 · 기준 적용 1회 통과',
      detail: '5회 모두 같은 방향(예: 71% / 44% / 26%). 주가 수익률 예측으로는 근거가 없어 수익률 신호로 쓰지 않음.',
    },
  },
}
