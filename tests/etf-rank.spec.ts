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

test('KR ETFs show the official Korean name; other rows keep theirs',async()=>{
  const {applyKrEtfNames}=await import('../src/lib/krEtfNames')
  const rows=[
    {...etf('kr','KR',{}),ticker:'069500',name:'Samsung KODEX 200'},
    {...etf('kr-new','KR',{}),ticker:'0080g0',name:'0080G0'},
    {...etf('kr-unknown','KR',{}),ticker:'999999',name:'원본 이름'},
    {...etf('us','US',{}),ticker:'069500',name:'US ETF'},
    {...etf('eq','KR',{},'Equity'),ticker:'069500',name:'주식'}
  ] as LeaderRow[]
  const out=applyKrEtfNames(rows,{'069500':'KODEX 200','0080G0':'KODEX 방산TOP10'})
  expect(out.map(r=>r.name)).toEqual(['KODEX 200','KODEX 방산TOP10','원본 이름','US ETF','주식'])
})

test('ETF-INDUSTRY-1 groups ETFs by market and industry with the median ETF rank',async()=>{
  const {buildEtfIndustries}=await import('../src/lib/etfIndustries')
  const e=(id:string,market:'US'|'KR',industry:string,sector:string,rank:number|null,tt=false)=>
    ({...etf(id,market,{}),industry,sector,etf_rs_rank:rank,leader_tt:tt,name:id}) as LeaderRow
  const groups=buildEtfIndustries([
    e('SMH','US','Semiconductors','Information Technology',90,true),e('SOXX','US','Semiconductors','Information Technology',70),
    e('XSD','US','Semiconductors','Information Technology',null),
    e('KSEMI','KR','Semiconductors','Information Technology',40),
    e('ITA','US','Aerospace & Defense','Industrials',95,true),
    e('SPY','US','S&P 500','Broad Market',99),e('MIX','KR','Multi','Multi-Sector',99),
    e('NORANK','US','Biotechnology','Health Care',null),
    {...etf('AAPL','US',{}),asset_class:'Equity',industry:'Semiconductors',sector:'Information Technology',etf_rs_rank:99} as LeaderRow
  ]);
  expect(groups.map(g=>g.key)).toEqual(['US|Aerospace & Defense','US|Semiconductors','KR|Semiconductors']);
  const us=groups[1];
  expect([us.n,us.ranked,us.medRank,us.ttPass,us.leader]).toEqual([3,2,80,1,'SMH']);
  expect(groups[2].medRank).toBe(40);
});
