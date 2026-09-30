import {test,expect} from '@playwright/test'
import {etfRsScore,rankEtfs,withEtfRanks} from '../src/lib/etfRank'
import type {LeaderRow} from '../src/types'

const etf=(id:string,market:'US'|'KR',rs:Partial<Record<'rs_1m'|'rs_3m'|'rs_6m'|'rs_12m',number|null>>,asset_class='ETF')=>
  ({id,market,ticker:id,name:id,asset_class,rs_1m:null,rs_3m:null,rs_6m:null,rs_12m:null,rs_rank:null,...rs}) as unknown as LeaderRow

test('ETF-RS-RANK-1 score re-weights over available periods and keeps missing data unranked',()=>{
  expect(etfRsScore(etf('a','US',{rs_1m:.1,rs_3m:.1,rs_6m:.1,rs_12m:.1}))).toBeCloseTo(.1)
  expect(etfRsScore(etf('b','US',{rs_1m:.3,rs_3m:null,rs_6m:null,rs_12m:.1}))).toBeCloseTo((.3*.3+.1*.2)/.5)
  expect(etfRsScore(etf('c','US',{rs_1m:0}))).toBe(0)
  expect(etfRsScore(etf('d','US',{}))).toBeNull()
  expect(etfRsScore(etf('e','US',{rs_3m:Number.NaN}))).toBeNull()
})

test('ETF-RS-RANK-1 ranks ETFs per market, separately from equities',()=>{
  const rows=[
    etf('us-low','US',{rs_3m:-.2}),etf('us-mid','US',{rs_3m:0}),etf('us-tie','US',{rs_3m:0}),etf('us-top','US',{rs_3m:.3}),
    etf('kr-only','KR',{rs_1m:-.5}),
    etf('us-missing','US',{}),
    etf('equity','US',{rs_3m:9},'Equity')
  ]
  const ranks=rankEtfs(rows)
  expect(ranks.get('us-low')).toBe(Math.round(1+98*1/4))
  expect(ranks.get('us-mid')).toBe(Math.round(1+98*3/4))
  expect(ranks.get('us-tie')).toBe(ranks.get('us-mid'))
  expect(ranks.get('us-top')).toBe(99)
  expect(ranks.get('kr-only')).toBe(99)
  expect(ranks.has('us-missing')).toBe(false)
  expect(ranks.has('equity')).toBe(false)
  const out=withEtfRanks(rows)
  expect(out.find(r=>r.id==='us-missing')!.etf_rs_rank).toBeNull()
  expect(out.find(r=>r.id==='equity')!.etf_rs_rank).toBeUndefined()
  expect(out.every(r=>r.rs_rank===null)).toBe(true)
})
