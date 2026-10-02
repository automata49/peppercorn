import {test,expect} from '@playwright/test'
import {groupSeries,peerSeries,rsValue,seriesOf,topByRs,yScale} from '../src/lib/rsChart'
import type {LeaderRow} from '../src/types'

const base={asset_class:'Equity',exchange:'NASDAQ',index_memberships:['S&P 500'],price:100,ibd_rs_estimate:95,high_52w_distance:-.1,leader_tt:true,stage:'▲ 돌파',rs_3m:.1,rs_6m:.2,ma50:90,ma200:80,return_1w:.01,return_5d:.01,return_20d:.02,return_50d:.03,return_120d:.04,return_200d:.05,return_12m:.06,action_guide:'테스트 전용'}
// RS 20D rises with i; RS 5D falls with i, so switching the period reverses the order. TEST9 has no RS 20D.
const rows=Array.from({length:10},(_,i)=>({...base,id:String(i),ticker:'TEST'+i,market:'US',name:'검증 종목 '+i,sector:i<5?'Technology':'Health Technology',industry:i<5?'Semiconductors':'Biotechnology',rs_rank:99-i,leadership_class:i<4?'핵심 주도':i<8?'주도 후보':'중립',rs_5d:(5-i)/100,rs_20d:i===9?null:(i-3)/100,rs_50d:.03,rs_120d:.04,rs_200d:.05,rs_12m:.06}))
const etfs=Array.from({length:3},(_,i)=>({...base,id:'etf-'+i,ticker:'ETF'+i,market:'US',name:'검증 ETF '+i,asset_class:'ETF',sector:'Information Technology',industry:'Semiconductors',rs_rank:null,ibd_rs_estimate:null,leader_tt:false,leadership_class:'중립',rs_1m:i/100,rs_3m:i/100,rs_5d:-i/100,rs_20d:i/100,rs_50d:null,rs_120d:null,rs_200d:null,rs_12m:null}))

test('RS-CHART-2 helpers build period series, medians and a zero-inclusive axis',()=>{
  const r=rows as unknown as LeaderRow[]
  expect(rsValue(r[9],'20D')).toBeNull()
  expect(seriesOf(r[0],'rs')).toEqual([.05,-.03,.03,.04,.05,.06])
  expect(seriesOf(r[0],'return')).toEqual([.01,.02,.03,.04,.05,.06])
  const top=topByRs(r,'20D',3)
  expect(top.items.map(x=>x.row.ticker)).toEqual(['TEST8','TEST7','TEST6'])
  expect(top.missing).toBe(1)
  const g=groupSeries(r,x=>String(x.sector))
  expect(g.get('Technology')!.values[1]).toBeCloseTo(-.01)
  expect(g.get('Health Technology')!.values[1]).toBeCloseTo(.035)
  const cmp=peerSeries(r[0],[...r,...(etfs as unknown as LeaderRow[])],'rs')
  expect(cmp.map(s=>s.key)).toEqual(['self','industry','sector','market'])
  expect(cmp[1].values[1]).toBeCloseTo(-.01) // ETFs in the same industry are not peers of an equity
  expect(cmp[3].n).toBe(10)
  expect(peerSeries(etfs[2] as unknown as LeaderRow,[...r,...(etfs as unknown as LeaderRow[])],'return').map(s=>s.key)).toEqual(['self','industry','market'])
  const y=yScale(cmp)
  expect(y.lo).toBeLessThanOrEqual(-.03);expect(y.hi).toBeGreaterThanOrEqual(.06);expect(y.ticks).toContain(0)
})

for(const view of [{name:'phone',width:390,height:844,touch:true},{name:'ipad-portrait',width:834,height:1194,touch:true},{name:'ipad-landscape',width:1194,height:834,touch:true},{name:'ipad-pro',width:1366,height:1024,touch:true},{name:'desktop',width:1440,height:900,touch:false}]){
 test(view.name+' RS period charts and stock detail back navigation',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  let leaderboardCalls=0
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/leaderboard?*',route=>{leaderboardCalls++;route.fulfill({json:{rows:[...rows,...etfs]}})})
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()

  // 주도 종목: leaders only (8 of 10), Top by RS 20D by default; 5D reverses the order.
  const leaderChart=page.locator('.leadership-overview .rs-chart')
  await expect(leaderChart.locator('.rs-period-toggle button')).toHaveText(['5D','20D','50D','120D','200D','52W'])
  // Line chart: x axis = the six periods, y axis = RS %, one line per Top 5 leader (by RS 20D).
  await expect(leaderChart.locator('.line-legend b')).toHaveText(['검증 종목 7','검증 종목 6','검증 종목 5','검증 종목 4','검증 종목 3'])
  await expect(leaderChart.locator('.line-legend em').first()).toHaveText('+4.0%')
  await expect(leaderChart.locator('svg .line-series')).toHaveCount(5)
  await expect(leaderChart.locator('svg .line-tick.on')).toHaveText('20D')
  const xTicks=await leaderChart.locator('svg text.line-tick').allTextContents()
  for(const p of ['5D','20D','50D','120D','200D','52W'])expect(xTicks).toContain(p)
  expect(xTicks.some(t=>/^[+-]?\d+(\.\d)?%$/.test(t))).toBeTruthy()
  await expect(leaderChart.locator('svg .line-axis-title')).toHaveText('RS %')
  // Points sit left→right in period order and higher values plot higher.
  const pts=await leaderChart.locator('svg .line-series').first().locator('circle').evaluateAll(es=>es.map(e=>({x:+e.getAttribute('cx')!,y:+e.getAttribute('cy')!})))
  expect(pts).toHaveLength(6)
  for(let i=1;i<6;i++)expect(pts[i].x).toBeGreaterThan(pts[i-1].x)
  expect(pts[1].y).toBeLessThan(pts[0].y) // TEST7: RS 20D +4% above RS 5D -2%
  await leaderChart.getByRole('button',{name:'5D',exact:true}).click()
  await expect(leaderChart.getByRole('button',{name:'5D',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(leaderChart.locator('.line-legend b').first()).toHaveText('검증 종목 0')
  await expect(leaderChart.locator('.rs-chart-head')).toContainText('RS 5D')

  // 섹터 요약: sector median RS lines; ETF 요약: Top ETFs. Toggles are independent.
  const sectorChart=page.locator('.dashboard-sector-panel .rs-chart')
  await expect(sectorChart.locator('.line-legend b')).toHaveText(['US · Health Technology','US · Technology'])
  await expect(sectorChart.locator('.line-legend em')).toHaveText(['+3.5%','-1.0%'])
  const etfChart=page.locator('.dashboard-etf-panel .rs-chart')
  await expect(etfChart.locator('.line-legend b')).toHaveText(['검증 ETF 2','검증 ETF 1','검증 ETF 0'])
  await etfChart.getByRole('button',{name:'52W',exact:true}).click()
  await expect(etfChart).toContainText('RS 52W 값이 있는 항목이 없습니다.')
  await expect(etfChart.locator('.rs-chart-note')).toContainText('값 없음 3개 ETF 제외')
  expect((await sectorChart.boundingBox())!.y).toBeLessThan((await page.locator('.dashboard-sector-panel .dashboard-sector-table').boundingBox())!.y)
  expect((await etfChart.boundingBox())!.y).toBeLessThan((await page.locator('.dashboard-etf-panel .stock-rows').boundingBox())!.y)
  await noOverflow()

  // Sector line → sector list → stock detail; charts sit inside 02 상대강도 and 03 가격 모멘텀.
  await sectorChart.locator('.line-legend button').nth(1).click()
  const drill=page.locator('.drill-sheet')
  await expect(drill.locator('.drill-tabs')).toBeVisible()
  await expect(drill.locator('.drill-back')).toHaveCount(0)
  await drill.locator('.stock-row').first().click()
  const back=drill.locator('.drill-back')
  await expect(back).toHaveText('‹ 목록으로')
  const section=(name:string)=>drill.locator('.snapshot-section').filter({has:page.getByRole('heading',{name})})
  await expect(section('상대강도').locator('.line-legend b')).toHaveText(['이 종목','산업 중앙값','섹터 중앙값','US 중앙값'])
  await expect(section('상대강도').locator('svg .line-axis-title')).toHaveText('RS %')
  await expect(section('가격 모멘텀').locator('.line-legend b')).toHaveText(['이 종목','산업 중앙값','섹터 중앙값','US 중앙값'])
  await expect(section('가격 모멘텀').locator('svg .line-axis-title')).toHaveText('등락 %')
  await expect(drill.locator('.rs-chart')).toHaveCount(0)
  await noOverflow()
  await back.click()
  await expect(drill.locator('.drill-tabs')).toBeVisible()
  await expect(drill.locator('.stock-snapshot')).toHaveCount(0)

  // The device back button leaves the detail the same way.
  await drill.locator('.stock-row').first().click()
  await expect(drill.locator('.stock-snapshot')).toBeVisible()
  await page.goBack()
  await expect(drill.locator('.stock-snapshot')).toHaveCount(0)
  await expect(drill.locator('.drill-tabs')).toBeVisible()
  await page.getByRole('button',{name:'닫기',exact:true}).click()
  await expect(drill).toHaveCount(0)

  // Opened from a dashboard bar there is no list behind it: 뒤로 closes the sheet.
  await leaderChart.locator('.line-legend button').first().click()
  await expect(back).toHaveText('‹ 뒤로')
  await back.click()
  await expect(drill).toHaveCount(0)

  // Opened from the ETF dialog: 뒤로 reopens that dialog.
  await page.locator('.dashboard-etf-panel').getByRole('button',{name:'전체 보기 →'}).click()
  await page.locator('.etf-summary-dialog .stock-row').first().click()
  await expect(back).toHaveText('‹ ETF 목록으로')
  await expect(drill.locator('.snapshot-section').filter({has:page.getByRole('heading',{name:'상대강도'})}).locator('.line-legend b')).toHaveText(['이 ETF','산업 중앙값','US 중앙값'])
  await back.click()
  await expect(page.locator('.etf-summary-dialog')).toBeVisible()
  await expect(drill).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('.ui-dialog-overlay')).toHaveCount(0)
  await noOverflow()
  // The charts read loaded rows only: toggling made no further leaderboard request.
  expect(leaderboardCalls).toBe(1)
  await context.close()
 })
}

test('phone: a failed live load shows a demo-data notice with a working retry',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  let ok=false
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/leaderboard?*',route=>ok?route.fulfill({json:{rows:[...rows,...etfs]}}):route.fulfill({status:503,body:'down'}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  const banner=page.locator('.demo-banner')
  await expect(banner).toContainText('예시 데이터')
  ok=true
  await banner.getByRole('button',{name:'다시 연결'}).click()
  await expect(banner).toHaveCount(0)
  await expect(page.locator('.leadership-overview .line-legend b').first()).toHaveText('검증 종목 7')
  await context.close()
})
