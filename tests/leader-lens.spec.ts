import {openLeaderTools,openSignal,openPage,pickFirstStock,backToExplore} from './journey-helpers'
import {test,expect} from '@playwright/test'
import {DEFAULT_LENS_FILTER,applyLensFilter,bigCapLeaders,byGroupThenRs,growthPasses,leaderGroups,topGroup} from '../src/lib/leaderLens'
import {withGroupRanks} from '../src/lib/groupRank'
import {flagBadges} from '../src/lib/stockFlags'
import type {LeaderRow} from '../src/types'

// LEADER-LENS-1 (top-down 업종별 view), BIGCAP-1 (대형 주도주), GROWTH-1 filters/badges and SEPA-1 badge. Display only.
const base={asset_class:'Equity',index_memberships:[],ibd_rs_estimate:95,high_52w_distance:-.05,leader_tt:true,stage:'▲ 돌파 매수권',rs_1m:.05,rs_3m:.1,rs_6m:.2,rs_12m:.3,rs_5d:.01,rs_20d:.02,rs_50d:.03,rs_120d:.04,rs_200d:.05,ma50:90,ma200:80,price:100,return_5d:.01,return_20d:.02,return_50d:.03,return_120d:.04,return_200d:.05,return_12m:.06,action_guide:'테스트 전용',traded_value_20d:1e7}
const semis=Array.from({length:5},(_,i)=>({...base,id:'s'+i,market:'US',ticker:'SEMI'+i,name:'반도체 '+i,exchange:'NASDAQ',sector:'Information Technology',industry:'Semiconductors',rs_rank:90-i,leadership_class:'핵심 주도'}))
const bios=Array.from({length:5},(_,i)=>({...base,id:'b'+i,market:'US',ticker:i===0?'KOD':'BIO'+i,name:i===0?'Kodiak':'바이오 '+i,exchange:'NASDAQ',sector:'Health Care',industry:'Biotechnology',rs_rank:i===0?99:40-i,leadership_class:i===0?'핵심 주도':'중립',traded_value_20d:i===1?5e9:1e7}))
// A mega-cap that never reaches RS 95 (like NVDA at RS 79-85) and a weak large cap.
const big={...base,id:'big',market:'US',ticker:'BIG',name:'대형 반도체',exchange:'NASDAQ',sector:'Information Technology',industry:'Semiconductors',rs_rank:80,leadership_class:'중립',traded_value_20d:9e10}
const tiny={...base,id:'t',market:'US',ticker:'TINY',name:'소형',exchange:'NYSE',sector:'Financials',industry:'Banks',rs_rank:60,leadership_class:'중립'}
const rows=[...semis,...bios,big,tiny] as unknown as LeaderRow[]

test('large-cap leaders: top 10% by trading value, ranked among large caps, trend and high filters',()=>{
  const {rows:out,markets}=bigCapLeaders(rows)
  expect(markets.US).toEqual({large:2,valued:12})                 // ceil(12 x 10%) = 2: BIG and BIO1
  expect(out.map(r=>r.ticker)).toEqual(['BIG'])                   // top 30% of 2 = 1; BIO1 (RS 39) is out
  expect(out[0]).toMatchObject({bigcap_rank:1,bigcap_total:2})
  // Below the trend (price < MA50) or more than 25% under the high: not a large-cap leader.
  expect(bigCapLeaders([...rows.filter(r=>r.ticker!=='BIG'),{...big,price:85}] as LeaderRow[]).rows).toEqual([])
  expect(bigCapLeaders([...rows.filter(r=>r.ticker!=='BIG'),{...big,high_52w_distance:-.26}] as LeaderRow[]).rows).toEqual([])
  // No trading values: unknown, no list.
  expect(bigCapLeaders(rows.map(r=>({...r,traded_value_20d:null})))).toEqual({rows:[],markets:{}})
})

test('top-down groups order by group rank, then RS; filters use the flags file only',()=>{
  const ranked=withGroupRanks(rows)
  const core=ranked.filter(r=>r.leadership_class==='핵심 주도')
  const groups=leaderGroups(core)
  expect(groups.map(g=>[g.name,g.rank,g.rows.length])).toEqual([['Semiconductors',1,5],['Biotechnology',2,1]])
  expect(topGroup(groups[0])).toBe(true)                          // rank 1 of 2: top 20% (ceil 0.4 = 1)
  expect(topGroup(groups[1])).toBe(false)
  expect(byGroupThenRs(core).map(r=>r.ticker)).toEqual(['SEMI0','SEMI1','SEMI2','SEMI3','SEMI4','KOD'])
  const flags={'US:KOD':{loss:true,no_revenue:true},'US:SEMI0':{sepa:true,growth:{rev:.35,eps:.6}}}
  const off={hideWeak:false,sepaOnly:false,growthOnly:false}
  expect(applyLensFilter(core,flags,{...off,hideWeak:true}).map(r=>r.ticker)).not.toContain('KOD')
  expect(applyLensFilter(core,flags,{...off,sepaOnly:true}).map(r=>r.ticker)).toEqual(['SEMI0'])
  expect(applyLensFilter(core,null,{hideWeak:true,sepaOnly:true,growthOnly:true})).toHaveLength(6)   // no file: nothing judged
  // GROWTH-FILTER-1 is on by default: revenue >= +20 % AND earnings >= +25 %; unknown growth is hidden.
  expect(DEFAULT_LENS_FILTER).toEqual({hideWeak:false,sepaOnly:false,growthOnly:true})
  expect(applyLensFilter(core,flags,DEFAULT_LENS_FILTER).map(r=>r.ticker)).toEqual(['SEMI0'])
  expect(growthPasses({growth:{rev:.20,eps:.25}})).toBe(true)
  expect(growthPasses({growth:{rev:.199,eps:.9}})).toBe(false)
  expect(growthPasses({growth:{rev:.5}})).toBe(false)
  expect(growthPasses(undefined)).toBe(false)
  // A market whose growth source failed (absent from growth_period) is not filtered by growth; others still are.
  const kr={...core[0],id:'kr1',market:'KR',ticker:'000001'} as LeaderRow
  expect(applyLensFilter([...core,kr],flags,DEFAULT_LENS_FILTER,['US']).map(r=>r.ticker)).toEqual(['SEMI0','000001'])
  expect(applyLensFilter([...core,kr],flags,DEFAULT_LENS_FILTER,['US','KR']).map(r=>r.ticker)).toEqual(['SEMI0'])
})

test('growth and SEPA badges come first and name the period',()=>{
  const b=flagBadges({sepa:true,growth:{rev:.35,eps:.6}},'CY2026Q2')
  expect(b.map(x=>x.label)).toEqual(['SEPA','매출 +35%'])
  expect(b[0].title).toContain('CY2026Q2')
  expect(flagBadges({growth:{eps:.4}}).map(x=>x.label)).toEqual([])  // EPS-only growth: no revenue badge
})

const flags={version:'STOCK-FLAGS-1',generated_at:'2026-10-03T10:00:00Z',growth_period:{US:'CY2026Q2'},flags:{'US:KOD':{loss:true,no_revenue:true},'US:SEMI0':{sepa:true,growth:{rev:.35,eps:.6}}}}
for(const view of [{name:'phone',width:390,height:844,touch:true},{name:'ipad-portrait',width:834,height:1194,touch:true},{name:'ipad-landscape',width:1194,height:834,touch:true},{name:'ipad-pro',width:1366,height:1024,touch:true},{name:'desktop',width:1440,height:900,touch:false}]){
 test(view.name+' leader popup reads top-down, filters by filings and lists large-cap leaders',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
  await page.route('**/functions/v1/price-history?*',route=>route.fulfill({json:{series:{}}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/data/stock-flags.json',route=>route.fulfill({json:flags}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await openLeaderTools(page)
  const sheet=page.locator('.drill-sheet')
  const names=()=>sheet.locator('.stock-row .stock-id b').allTextContents()
  // GROWTH-FILTER-1 is on by default: only the stock with quarterly growth shows; the classification count stays.
  await expect(sheet.locator('.summary-tabs button')).toHaveCount(5)
  await expect(sheet.locator('.lens-chip',{hasText:'실적 성장만'})).toHaveAttribute('aria-pressed','true')
  expect(await names()).toEqual(['반도체 0'])
  await expect(sheet.locator('.drill-note')).toContainText('필터로 5종목 제외')
  await expect(sheet.locator('.drill-note')).toContainText('전체 분류 6종목')
  await sheet.locator('.lens-chip',{hasText:'실적 성장만'}).click()
  // 업종별 (default view): the top-ranked group and its stocks come first; the group chip shows its rank.
  await expect(sheet.locator('.lens-group').nth(1)).toContainText('Semiconductors')
  await expect(sheet.locator('.lens-group').nth(1)).toContainText('1위')
  await expect(sheet.locator('.lens-group').nth(1)).toHaveClass(/top/)
  expect(await names()).toEqual(['반도체 0','반도체 1','반도체 2','반도체 3','반도체 4','Kodiak'])
  await expect(sheet.locator('.stock-row').first().locator('.group-rank-mini')).toHaveText(' · 업종 1위')
  // Choosing a group narrows the list to it.
  await sheet.locator('.lens-group').filter({hasText:'Biotechnology'}).click()
  expect(await names()).toEqual(['Kodiak'])
  await sheet.locator('.lens-group').first().click()
  // RS순 keeps the former order (KOD first).
  await sheet.locator('.lens-bar button',{hasText:'RS순'}).click()
  expect((await names())[0]).toBe('Kodiak')
  // Filters: loss/no revenue hidden, then SEPA only.
  await sheet.locator('.lens-chip',{hasText:'적자·매출 없음 제외'}).click()
  expect(await names()).not.toContain('Kodiak')
  await expect(sheet.locator('.drill-note')).toContainText('필터로 1종목 제외')
  await sheet.locator('.lens-chip',{hasText:'SEPA 충족만'}).click()
  expect(await names()).toEqual(['반도체 0'])
  await expect(sheet.locator('.stock-row').first().locator('.stock-flag')).toHaveText(['SEPA','매출 +35%'])
  await sheet.locator('.lens-chip',{hasText:'SEPA 충족만'}).click()
  await sheet.locator('.lens-chip',{hasText:'적자·매출 없음 제외'}).click()
  // 대형 주도주 tab: the mega-cap below RS 95 appears with the rule explained.
  await sheet.locator('.summary-tabs button',{hasText:'대형 주도주'}).click()
  await expect(sheet.locator('.lens-explain')).toContainText('BIGCAP-1')
  expect(await names()).toEqual(['대형 반도체'])
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  // The choice is remembered on this device.
  await page.reload()
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await openLeaderTools(page)
  await page.locator('.drill-sheet .summary-tabs button',{hasText:'대형 주도주'}).click()
  await expect(page.locator('.drill-sheet .summary-tabs button[aria-selected="true"]')).toContainText('대형 주도주')
  await expect(page.locator('.drill-sheet .lens-bar button[aria-pressed="true"]',{hasText:'RS순'})).toHaveCount(1)
  await context.close()
 })
}
