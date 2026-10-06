import {test,expect} from '@playwright/test'
import {groupRanks,normalizeUsSectors,withGroupRanks} from '../src/lib/groupRank'
import {flagBadges} from '../src/lib/stockFlags'
import type {LeaderRow} from '../src/types'

// STOCK-FLAGS-1 badges, GROUP-RANK-1 industry group rank and SECTOR-LABEL-1 US sector names (all display only).
const base={asset_class:'Equity',index_memberships:[],ibd_rs_estimate:95,high_52w_distance:-.05,leader_tt:true,stage:'▲ 돌파 매수권',rs_1m:.05,rs_3m:.1,rs_6m:.2,rs_12m:.3,rs_5d:.01,rs_20d:.02,rs_50d:.03,rs_120d:.04,rs_200d:.05,ma50:90,ma200:80,price:100,return_5d:.01,return_20d:.02,return_50d:.03,return_120d:.04,return_200d:.05,return_12m:.06,action_guide:'테스트 전용'}
const semis=Array.from({length:5},(_,i)=>({...base,id:'s'+i,market:'US',ticker:'SEMI'+i,name:'반도체 '+i,exchange:'NASDAQ',sector:'Technology',industry:'Semiconductors',rs_rank:90-i,leadership_class:i===0?'핵심 주도':'중립'}))
const bios=Array.from({length:5},(_,i)=>({...base,id:'b'+i,market:'US',ticker:i===0?'KOD':'BIO'+i,name:i===0?'Kodiak':'바이오 '+i,exchange:'NASDAQ',sector:'Health Care',industry:'Biotechnology',rs_rank:i===0?99:40-i,leadership_class:i===0?'핵심 주도':'중립'}))
const tiny={...base,id:'t',market:'US',ticker:'TINY',name:'소형 업종',exchange:'NYSE',sector:'Finance',industry:'Banks',rs_rank:99,leadership_class:'중립'}
const rows=[...semis,...bios,tiny] as unknown as LeaderRow[]

test('group rank uses median RS rank of groups with five or more members',()=>{
  const ranks=groupRanks(rows)
  expect(ranks.get('US|Semiconductors')).toEqual({rank:1,total:2,median:88,n:5})
  expect(ranks.get('US|Biotechnology')).toMatchObject({rank:2,total:2,median:38})
  expect(ranks.has('US|Banks')).toBe(false)
  const ranked=withGroupRanks(rows)
  expect(ranked.find(r=>r.ticker==='KOD')).toMatchObject({group_rank:2,group_total:2,group_name:'Biotechnology'})
  expect(ranked.find(r=>r.ticker==='TINY')).toMatchObject({group_rank:null,group_name:'Banks'})
  // KR groups by the WICS industry group held in `sector`.
  const kr=Array.from({length:5},(_,i)=>({...base,id:'k'+i,market:'KR',ticker:'00000'+i,name:'k',sector:'반도체와반도체장비',industry:'IT',rs_rank:80}))
  expect(groupRanks(kr as unknown as LeaderRow[]).get('KR|반도체와반도체장비')).toMatchObject({rank:1,total:1})
  // A stock without an RS rank is not counted and gets no group rank from a group under five ranked members.
  expect(groupRanks([...semis.slice(0,4),{...semis[4],rs_rank:null}] as unknown as LeaderRow[]).size).toBe(0)
})

test('US sector names map to GICS; KR and GICS names stay',()=>{
  const out=normalizeUsSectors([{market:'US',sector:'Technology'},{market:'US',sector:'Finance'},{market:'US',sector:'Information Technology'},{market:'KR',sector:'Technology'}] as unknown as LeaderRow[])
  expect(out.map(r=>r.sector)).toEqual(['Information Technology','Financials','Information Technology','Technology'])
})

test('badges show true flags only; no revenue replaces the loss badge',()=>{
  expect(flagBadges(undefined)).toEqual([])
  expect(flagBadges({}).length).toBe(0)
  expect(flagBadges({loss:true,no_revenue:true,jump:{top_day:1.78,share:1.09,window_return:1.55}}).map(b=>b.label)).toEqual(['매출 없음','급등일 의존'])
  const shrink=flagBadges({loss:true,shrinking:true,revenue_growth:-.125})
  expect(shrink.map(b=>b.label)).toEqual(['적자','매출 감소'])
  expect(shrink[1].title).toContain('-13%')
})

const flags={version:'STOCK-FLAGS-1',generated_at:'2026-10-03T10:00:00Z',flags:{'US:KOD':{loss:true,no_revenue:true,jump:{top_day:1.78,share:1.09,window_return:1.55}},'US:SEMI0':{shrinking:true,revenue_growth:-.1}}}
for(const view of [{name:'phone',width:390,height:844,touch:true},{name:'ipad-portrait',width:834,height:1194,touch:true},{name:'ipad-landscape',width:1194,height:834,touch:true},{name:'ipad-pro',width:1366,height:1024,touch:true},{name:'desktop',width:1440,height:900,touch:false}]){
 test(view.name+' badges, group rank and GICS sector names appear in lists and detail',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
  await page.route('**/functions/v1/price-history?*',route=>route.fulfill({json:{series:{}}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/data/stock-flags.json',route=>route.fulfill({json:flags}))
  // This spec checks badges; the default-on growth filter (GROWTH-FILTER-1) is covered in leader-lens.spec.ts.
  await page.addInitScript(()=>localStorage.setItem('peppercorn-leader-filter-v1',JSON.stringify({growthOnly:false})))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  // US sector shows under its GICS name only on Market Signal.
  await page.getByRole('button',{name:'Market Signal →'}).click()
  await expect(page.locator('.dashboard-sector-table')).toContainText('Information Technology')
  await expect(page.locator('.dashboard-sector-table')).not.toContainText(/(^|[^ ])Technology ·/)
  await page.getByRole('button',{name:'← Home'}).click()
  await page.locator('.home-class-grid button').filter({hasText:'핵심 주도'}).click()
  await page.getByRole('button',{name:'업종·지표 상세 비교 →'}).click()
  const kod=page.locator('.drill-sheet .stock-row').filter({hasText:'Kodiak'}).first()
  await expect(kod.locator('.stock-flag')).toHaveText(['매출 없음','급등일 의존'])
  await expect(kod.locator('.stock-flag.jump')).toHaveAttribute('title',/하루 \+178%/)
  await expect(page.locator('.drill-sheet .stock-row').filter({hasText:'반도체 0'}).first().locator('.stock-flag')).toHaveText(['매출 감소'])
  await kod.click()
  const detail=page.locator('.stock-snapshot')
  await expect(detail.locator('.classification-summary .group-rank')).toHaveText('업종 2/2위')
  await expect(detail.locator('.stock-flag')).toHaveText(['매출 없음','급등일 의존'])
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await context.close()
 })
}

test('without the flags file the app shows no badges and still works',async({page})=>{
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
  await page.route('**/functions/v1/price-history?*',route=>route.fulfill({json:{series:{}}}))
  await page.route('**/data/stock-flags.json',route=>route.fulfill({status:404,body:'not found'}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await page.locator('.home-class-grid button').filter({hasText:'핵심 주도'}).click()
  await page.getByRole('button',{name:'업종·지표 상세 비교 →'}).click()
  await expect(page.locator('.drill-sheet .stock-row').filter({hasText:'Kodiak'}).first()).toBeVisible()
  await expect(page.locator('.stock-flag')).toHaveCount(0)
  // Leaderboard grid shows the group rank column.
  await page.keyboard.press('Escape')
  const side=page.locator('.sidebar nav')
  if(await side.isVisible()){
    await side.getByRole('button',{name:'Leaderboard'}).click()
    // Columns are virtualized: scroll right until the group rank column renders.
    const header=page.locator('.ag-header-cell[col-id="group_rank"]')
    for(let x=0;x<4000&&!(await header.count());x+=300)await page.locator('.ag-body-horizontal-scroll-viewport').evaluate((e,left)=>{e.scrollLeft=left},x)
    await expect(header).toContainText('업종 순위')
    await expect(page.locator('.ag-row[row-index="0"] .ag-cell[col-id="group_rank"]')).toHaveText(/^(\d+\/\d+|—)$/)
  }
})
