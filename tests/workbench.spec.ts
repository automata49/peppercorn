import {backToExplore,openPage,pickFirstStock} from './journey-helpers'
import {test,expect,type Page} from '@playwright/test'
import {choseong,matchScore,searchRows} from '../src/lib/search'
import {fundamentalChecks,quadrant,swingChecks} from '../src/lib/checkup'
import type {LeaderRow,PositionRow} from '../src/types'

// ANALYSIS-SEARCH-1, CHECKUP-1, vertical analysis sheet and compare view.
const base={asset_class:'Equity',sector:'Technology',industry:'Semiconductors',index_memberships:[],price:110,ibd_rs_estimate:90,high_52w_distance:-.05,leader_tt:true,stage:'▲ 돌파 매수권',rs_3m:.1,rs_6m:.2,rs_1m:.02,rs_1w:.01,rs_12m:.3,rs_5d:.01,rs_20d:.02,rs_50d:.03,rs_120d:.04,rs_200d:.05,ma50:100,ma200:90,return_5d:.01,return_20d:.02,return_50d:.03,return_120d:.04,return_200d:.05,return_12m:.06,action_guide:'테스트 전용'}
const rows=[
  {...base,id:'a',ticker:'353200',market:'KR',name:'대덕전자',exchange:'KOSPI',rs_rank:97,leadership_class:'핵심 주도'},
  {...base,id:'b',ticker:'OKLO',market:'US',name:'Oklo Inc.',exchange:'NYSE',rs_rank:93,leadership_class:'주도 후보'},
  {...base,id:'c',ticker:'119850',market:'KR',name:'지엔씨에너지',exchange:'KOSDAQ',rs_rank:60,leadership_class:'중립',leader_tt:false,price:80,high_52w_distance:-.4,rs_3m:-.1,ibd_rs_estimate:null},
  ...Array.from({length:12},(_,i)=>({...base,id:'x'+i,ticker:'TEST'+i,market:i%2?'KR':'US',name:'검증 종목 '+i,exchange:i%2?'KOSPI':'NASDAQ',rs_rank:80-i,leadership_class:'중립'})),
]
const metrics={as_of:'2026-06-30',ttm_revenue:5e10,ttm_operating_income:1e10,ttm_net_income:8e9,ttm_fcf:6e9,ttm_operating_cash_flow:9e9,revenue_yoy:.2,revenue_yoy_q:.3,revenue_cagr_3y:.18,net_income_cagr_3y:.2,gross_margin:.5,operating_margin:.2,fcf_margin:.12,roic:.22,roic_method:'US-ROIC-2',roe:.3,net_debt:-1e9,debt_ratio:.4,eps_ttm:5,eps_yoy_q:.3,eps_cagr_3y:.2,diluted_shares_latest:1.6e9,shares_common:null,shares_preferred:null,dilution_yoy:0}
const position=[{market:'KR',ticker:'353200',as_of:'2026-06-30',status:'unavailable',rules_version:'uncalibrated',methods:{fcf:'KR-FCF-PPE-2',roic:'KR-ROIC-1'},failed_checks:[],metrics,labels:{type:null,quality:null,growth:null,value:null},label_reasons:{},computed_at:'2026-09-30T02:00:00Z'}]

test('search matches ticker, name and initial consonants',()=>{
  expect(choseong('대덕전자')).toBe('ㄷㄷㅈㅈ')
  expect(matchScore({ticker:'353200',name:'대덕전자'},'ㄷㄷㅈ')).toBeGreaterThan(0)
  expect(matchScore({ticker:'OKLO',name:'Oklo Inc.'},'okl')).toBe(80)
  expect(matchScore({ticker:'OKLO',name:'Oklo Inc.'},'OKLO')).toBe(100)
  expect(matchScore({ticker:'353200',name:'대덕전자'},'ㅇㅋ')).toBe(0)
  const found=searchRows(rows as unknown as LeaderRow[],'ㅈㅇㅆ')
  expect(found.map(r=>r.ticker)).toEqual(['119850'])
  expect(searchRows(rows as unknown as LeaderRow[],'test1').map(r=>r.ticker)).toEqual(['TEST1','TEST10','TEST11'])
})

test('checkup marks use existing thresholds and keep unknown separate',()=>{
  const s=swingChecks(rows[0] as unknown as LeaderRow)
  expect(s.map(i=>i.mark)).toEqual(['pass','pass','pass','pass','pass'])
  const weak=swingChecks(rows[2] as unknown as LeaderRow)
  expect(weak.map(i=>i.mark)).toEqual(['fail','fail','unknown','fail','fail'])
  const f=fundamentalChecks(position[0] as unknown as PositionRow)
  expect(f.usable).toBe(true)
  expect(f.items.map(i=>i.mark)).toEqual(['pass','pass','neutral','pass','pass','pass','pass'])
  expect(fundamentalChecks({...position[0],status:'check_failed'} as unknown as PositionRow).items.every(i=>i.mark==='unknown')).toBe(true)
  expect(fundamentalChecks(undefined).usable).toBe(false)
  expect(quadrant('핵심 주도',f.items)).toEqual({swing:'strong',fundamental:'good'})
  expect(quadrant('중립',fundamentalChecks(undefined).items)).toEqual({swing:'weak',fundamental:'unknown'})
  // Boundaries: RS rank 90 passes, 70 is neutral, 69 fails; 52W -15% passes, -25% neutral.
  const at=(over:Record<string,unknown>)=>swingChecks({...rows[0],...over} as unknown as LeaderRow)
  expect(at({rs_rank:90})[1].mark).toBe('pass');expect(at({rs_rank:70})[1].mark).toBe('neutral');expect(at({rs_rank:69})[1].mark).toBe('fail')
  expect(at({high_52w_distance:-.15})[3].mark).toBe('pass');expect(at({high_52w_distance:-.25})[3].mark).toBe('neutral');expect(at({high_52w_distance:-.2501})[3].mark).toBe('fail')
})

async function open(page:Page){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:position}}))
  await page.route('**/functions/v1/price-history?*',route=>route.fulfill({json:{series:{}}}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  const side=page.locator('.sidebar nav').getByRole('button',{name:'탐색',exact:true})
  if(await side.isVisible())return side.click()
  const bottom=page.locator('.mobile-bottom-nav').getByRole('button',{name:'탐색',exact:true})
  if(await bottom.isVisible())return bottom.click()
  await page.getByRole('button',{name:/메뉴 열기/}).first().click()
  await page.locator('.menu-drawer').getByRole('button',{name:'탐색',exact:true}).click()
}

for(const view of [{name:'phone',width:390,height:844,touch:true},{name:'ipad-portrait',width:834,height:1194,touch:true},{name:'ipad-landscape',width:1194,height:834,touch:true},{name:'ipad-pro',width:1366,height:1024,touch:true},{name:'desktop',width:1440,height:900,touch:false}]){
 test(view.name+' search, checkup, vertical sheet and compare',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  await open(page)
  const search=page.getByRole('combobox',{name:'종목 검색'})
  await search.fill('ㅈㅇㅆ')
  await expect(page.locator('.stock-search-results [role=option]')).toHaveCount(1)
  await search.press('Enter')
  const card=page.locator('.analysis-body')
  await expect(card.locator('.hero-name')).toContainText('지엔씨에너지')
  await expect(card.locator('.folio-insight')).toBeVisible()
  await backToExplore(page)
  await expect(page.locator('.recent-stocks button')).toHaveText(['지엔씨에너지'])
  // Enter picks the best match (ticker prefix).
  await search.fill('ok')
  await search.press('Enter')
  await expect(card.locator('.hero-name')).toContainText('Oklo')
  await backToExplore(page)
  await search.fill('대덕')
  await page.locator('.stock-search-results [role=option]').first().click()
  await expect(card.locator('.hero-name')).toContainText('대덕전자')
  const detailTabs=card.locator('.analysis-detail-tabs')
  await expect(detailTabs.getByRole('tab')).toHaveText(['Overview','Analysis','Financials','Thesis'])
  await expect(detailTabs.getByRole('tab',{name:'Overview'})).toHaveAttribute('aria-selected','true')
  await expect(card.locator('.folio-insight')).toContainText('Investment Thesis')
  await detailTabs.getByRole('tab',{name:'Analysis'}).click()
  const cards=card.locator('.checkup-card')
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0).locator('.checkup-count')).toHaveText('통과 5 · 중립 0 · 미달 0')
  await expect(cards.nth(1).locator('.checkup-count')).toHaveText('통과 6 · 중립 1 · 미달 0')
  await expect(card.locator('.checkup-quadrant b')).toHaveText('Swing 강함 × 펀더멘털 양호')
  await expect(card.locator('.analysis-main .analysis-part')).toHaveText('Swing · 모멘텀')
  await detailTabs.getByRole('tab',{name:'Financials'}).click()
  await expect(card.locator('.analysis-main .analysis-part')).toHaveText('Financial Snapshot · 공시 펀더멘털')
  await detailTabs.getByRole('tab',{name:'Thesis'}).click()
  // Vertical sheet: create, enter a value as a percentage, see it stored and judged.
  await card.getByRole('button',{name:'분석 기록 만들기'}).click()
  const sheet=card.locator('.analysis-sheet')
  await expect(sheet.locator('.sheet-table tbody tr')).toHaveCount(14)
  const eps=sheet.getByLabel('분기 EPS 성장률 (YoY)')
  await eps.fill('30');await eps.press('Enter')
  const epsRow=sheet.locator('tbody tr').filter({hasText:'분기 EPS 성장률'})
  await expect(epsRow.locator('td.cell-num')).toHaveText('30.0%')
  await expect(epsRow.locator('.mark-dot')).toHaveAttribute('aria-label','통과')
  await expect(sheet.locator('.sheet-meta')).toContainText('통과 3/10') // EPS input + price above both MAs + within 25% of the high
  // The same record backs the list view (grid); stored as a fraction.
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-analysis')||'[]')[0]?.eps_growth_q)).toBe(.3)
  const roe=sheet.getByLabel('ROE',{exact:true})
  await roe.fill('10');await roe.blur()
  await expect(sheet.locator('tbody tr').filter({hasText:'ROE'}).locator('.mark-dot')).toHaveAttribute('aria-label','미달')
  // Compare two stocks.
  await card.getByRole('button',{name:'비교에 추가'}).click()
  await backToExplore(page);await search.fill('OKLO');await search.press('Enter');await detailTabs.getByRole('tab',{name:'Thesis'}).click()
  await card.getByRole('button',{name:'비교에 추가'}).click()
  await detailTabs.getByRole('tab',{name:'Overview'}).click()
  const compare=card.locator('.compare-view')
  await expect(compare.locator('thead .compare-name')).toHaveText(['대덕전자','Oklo Inc.'])
  await expect(compare.locator('tbody tr')).toHaveCount(12)
  await expect(compare.locator('tbody tr').filter({hasText:'분기 매출 성장'}).locator('td span')).toHaveText(['+30.0%','—'])
  await compare.getByRole('button',{name:'Oklo Inc. 비교에서 빼기'}).click()
  await expect(compare.locator('thead .compare-name')).toHaveText(['대덕전자'])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()
  await card.screenshot({path:`test-results/workbench-${view.name}.png`})
  await context.close()
 })
}

// ANALYSIS-LAYOUT-2: price header, key stats, same-industry stocks, 내 판단 panel / action bar, nav order and page guides.
for(const view of [{name:'phone',width:390,height:844,touch:true},{name:'ipad-portrait',width:834,height:1194,touch:true},{name:'ipad-landscape',width:1194,height:834,touch:true},{name:'ipad-pro',width:1366,height:1024,touch:true},{name:'desktop',width:1440,height:900,touch:false}]){
 test(view.name+' analysis layout follows the Robinhood-style mockup',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  const peers=[...rows,{...rows[0],id:'p1',ticker:'007660',name:'이수페타시스',rs_rank:98,leadership_class:'핵심 주도',industry:'Semiconductors',return_3m:.382},
    {...rows[0],id:'p2',ticker:'222800',name:'심텍',rs_rank:80,leadership_class:'중립',industry:'Semiconductors',return_3m:-.05},
    {...rows[0],id:'etfx',ticker:'091160',name:'KODEX 반도체',asset_class:'ETF',industry:'Semiconductors'}]
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:peers.map(r=>({...r,traded_value_20d:r.id==='a'?1.6e11:null}))}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:position}}))
  await page.route('**/functions/v1/price-history?*',route=>route.fulfill({json:{series:{}}}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  const side=page.locator('.sidebar nav')
  if(await side.isVisible()){
    await expect(side.locator('.nav-label')).toHaveText(['홈','탐색','Thesis','추적','시장 신호','시장 온도계','Watchlist','Portfolio','Journal','Leaderboard','Universe','Settings'])
  }
  if(await side.isVisible())await side.getByRole('button',{name:'탐색',exact:true}).click()
  else await page.locator('.mobile-bottom-nav').getByRole('button',{name:'탐색',exact:true}).click()
  await page.getByRole('combobox',{name:'종목 검색'}).fill('대덕');await page.getByRole('combobox',{name:'종목 검색'}).press('Enter')
  const body=page.locator('.analysis-body')
  await expect(body.locator('.hero-meta')).toHaveText('KR · 353200 · KOSPI · Semiconductors')
  await expect(body.locator('.hero-price')).toHaveText('110원')
  await expect(body.locator('.hero-change')).toContainText('일간 종가')
  await expect(body.locator('.hero-chips .pill:not(.group-rank)')).toHaveText(['핵심 주도','▲ 돌파 매수권','RS 97'])
  await expect(body.locator('.hero-chips .group-rank')).toHaveText('업종 1/1위')
  const detailTabs=body.locator('.analysis-detail-tabs')
  await expect(detailTabs.getByRole('tab')).toHaveText(['Overview','Analysis','Financials','Thesis'])
  await expect(detailTabs.getByRole('tab',{name:'Overview'})).toHaveAttribute('aria-selected','true')
  const stat=(label:string)=>body.locator('.key-stats > div').filter({hasText:label}).locator('b')
  await expect(body.locator('.key-stats > div')).toHaveCount(8)
  await expect(stat('20일 평균 거래대금')).toHaveText('1,600억원')
  await expect(stat('PER (공시 EPS)')).toHaveText('22.0배')
  await expect(stat('52주 고점 대비')).toHaveText('-5.0%')
  // Same market and industry, equities only, leaders first; the ETF and US names are excluded.
  // Fixture rows share one industry: leaders first (by RS), at most 8, never the ETF or a US name.
  await expect(body.locator('.peer-strip b')).toHaveCount(8)
  await expect(body.locator('.peer-strip b').nth(0)).toHaveText('이수페타시스')
  await expect(body.locator('.peer-strip span')).not.toContainText(['091160'])
  expect(await body.locator('.peer-strip b').allTextContents()).not.toContain('Oklo Inc.')
  await expect(body.locator('.peer-strip em').first()).toContainText('+38.2%')
  await expect(body.locator('.analysis-more')).toHaveCount(0)
  await expect(body.locator('.folio-insight')).toBeVisible()
  await expect(body.locator('.analysis-judgement')).toHaveCount(0)
  const bar=body.locator('.analysis-actionbar')
  await expect(bar).toBeVisible()
  await bar.getByRole('button',{name:'관심 추가'}).click()
  await expect(bar.getByRole('button',{name:'관심 등록됨'})).toBeDisabled()
  await bar.getByRole('button',{name:'Thesis 쓰기'}).click()
  await expect(page.locator('.page-thesis')).toBeVisible()
  const panel=body.locator('.analysis-judgement')
  await expect(panel.locator('.sheet-table')).toBeVisible()
  await page.getByRole('button',{name:'종목 상세 →'}).click()
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-watchlist')||'[]').map((r:any)=>r.ticker))).toContain('353200')
  await detailTabs.getByRole('tab',{name:'Overview'}).click()
  await body.locator('.peer-strip button').first().click()
  await expect(body.locator('.hero-name')).toHaveText('이수페타시스')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()
  await page.screenshot({path:`test-results/analysis-layout-${view.name}.png`,fullPage:true})
  // Page guides for Leaderboard and Universe.
  await page.evaluate(()=>window.scrollTo(0,0))
  if(await side.isVisible()){
    await side.getByRole('button',{name:'Leaderboard'}).click()
    await expect(page.locator('.page-guide')).toContainText('주식 17개 · ETF 1개')
    await side.getByRole('button',{name:'Universe'}).click()
    await expect(page.locator('.page-guide')).toContainText('미국 7개 · 한국 10개')
    await expect(page.locator('.page-guide')).toContainText('1,000억원')
  }
  await context.close()
 })
}
