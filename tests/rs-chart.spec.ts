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

const mockHistory=(page:any,asked:string[][]=[])=>page.route('**/functions/v1/price-history?*',(route:any)=>{
  const ids=new URL(route.request().url()).searchParams.get('ids')!.split(',');asked.push(ids)
  // 30 sessions: close 100 … 129 (+1 a day); the 20D window starts at 109 (21 closes).
  route.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,Array.from({length:30},(_,d)=>[`2026-09-${String(d+1).padStart(2,'0')}`,100+d])]))}})
})

for(const view of [{name:'phone',width:390,height:844,touch:true},{name:'ipad-portrait',width:834,height:1194,touch:true},{name:'ipad-landscape',width:1194,height:834,touch:true},{name:'ipad-pro',width:1366,height:1024,touch:true},{name:'desktop',width:1440,height:900,touch:false}]){
 test(view.name+' RS period charts and stock detail back navigation',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  let leaderboardCalls=0
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/leaderboard?*',route=>{leaderboardCalls++;route.fulfill({json:{rows:[...rows,...etfs]}})})
  await mockHistory(page)
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()

  // 주도 종목 and ETF 요약: daily momentum lines only (no RS chart); 섹터 요약: heatmap.
  const leaderChart=page.locator('.leadership-overview .rs-chart')
  await expect(leaderChart.locator('.rs-mode-toggle')).toHaveCount(0)
  await expect(leaderChart.locator('.rs-period-toggle button')).toHaveText(['5D','20D','50D','120D','200D','52W'])
  await expect(leaderChart.locator('svg .line-axis-title')).toHaveText('지수 (시작=100)')
  await expect(leaderChart.locator('.line-legend li')).toHaveCount(5)
  await expect(leaderChart.locator('.line-legend em').first()).toHaveText(`+${((129/109-1)*100).toFixed(1)}%`)
  await leaderChart.getByRole('button',{name:'5D',exact:true}).click()
  await expect(leaderChart.locator('.line-legend em').first()).toHaveText(`+${((129/124-1)*100).toFixed(1)}%`)
  const etfChart=page.locator('.dashboard-etf-panel .rs-chart')
  await expect(etfChart.locator('.line-legend b')).toHaveCount(3)
  const sectorChart=page.locator('.dashboard-sector-panel .sector-heat')
  await expect(sectorChart.locator('.etf-heat-tile')).toHaveCount(2)
  await expect(page.locator('.dashboard-sector-panel svg')).toHaveCount(0)
  expect((await sectorChart.boundingBox())!.y).toBeLessThan((await page.locator('.dashboard-sector-panel .dashboard-sector-table').boundingBox())!.y)
  expect((await etfChart.boundingBox())!.y).toBeLessThan((await page.locator('.dashboard-etf-panel .stock-rows').boundingBox())!.y)
  await noOverflow()

  // Sector tile → sector popup (momentum lines on top) → stock detail (own daily line in 03 가격 모멘텀).
  await expect(sectorChart.locator('.etf-heat-market-head b')).toHaveText(['US'])
  await sectorChart.getByRole('listitem',{name:/^Technology ·/}).click()
  const drill=page.locator('.drill-sheet')
  await expect(drill.locator('.drill-tabs')).toBeVisible()
  await expect(drill.locator('.rs-chart svg .line-axis-title')).toHaveText('지수 (시작=100)')
  expect((await drill.locator('.rs-chart').boundingBox())!.y).toBeLessThan((await drill.locator('.stock-rows').boundingBox())!.y)
  await expect(drill.locator('.drill-back')).toHaveCount(0)
  await drill.locator('.stock-row').first().click()
  const back=drill.locator('.drill-back')
  await expect(back).toHaveText('‹ 목록으로')
  const section=(name:string)=>drill.locator('.snapshot-section').filter({has:page.getByRole('heading',{name})})
  // 02 상대강도: daily RS line vs the market benchmark; these fixtures have no SPY row, so it says so.
  await expect(section('상대강도')).toContainText('벤치마크(SPY) 가격이 없어')
  await expect(section('가격 모멘텀').locator('svg .line-axis-title')).toHaveText('지수 (시작=100)')
  await expect(section('가격 모멘텀').locator('.line-legend li')).toHaveCount(1)
  await expect(section('가격 모멘텀').locator('.rs-period-toggle button')).toHaveCount(6)
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

  // Opened from a dashboard chart there is no list behind it: 뒤로 closes the sheet.
  await leaderChart.locator('.line-legend button').first().click()
  await expect(back).toHaveText('‹ 뒤로')
  await back.click()
  await expect(drill).toHaveCount(0)

  // Opened from the ETF dialog: 뒤로 reopens that dialog.
  await page.locator('.dashboard-etf-panel').getByRole('button',{name:'전체 보기 →'}).click()
  await page.locator('.etf-summary-dialog .stock-row').first().click()
  await expect(back).toHaveText('‹ ETF 목록으로')
  await expect(drill.locator('.snapshot-section').filter({has:page.getByRole('heading',{name:'상대강도'})}).locator('.rs-period-toggle button')).toHaveCount(6)
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
  await mockHistory(page)
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  const banner=page.locator('.demo-banner')
  await expect(banner).toContainText('예시 데이터')
  await expect(banner).toContainText('원인: Peppercorn API HTTP 503')
  ok=true
  await banner.getByRole('button',{name:'다시 연결'}).click()
  await expect(banner).toHaveCount(0)
  await expect(page.locator('.leadership-overview .line-legend b').first()).toHaveText('검증 종목 0')
  await context.close()
})

test('주도 종목 popup shows momentum lines for its group; data is fetched per group',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  const asked:string[][]=[]
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[...rows.map((r,i)=>({...r,return_20d:i/100})),...etfs]}}))
  await mockHistory(page,asked)
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  const chart=page.locator('.leadership-overview .rs-chart')
  await expect(chart.locator('.line-legend b')).toHaveText(['검증 종목 7','검증 종목 6','검증 종목 5','검증 종목 4','검증 종목 3'])
  expect(asked.some(ids=>ids.length===5)).toBeTruthy()
  await page.locator('.leadership-card').filter({hasText:'핵심 주도'}).first().click()
  const drill=page.locator('.drill-sheet')
  await expect(drill.locator('.rs-chart .line-legend b')).toHaveText(['검증 종목 3','검증 종목 2','검증 종목 1','검증 종목 0'])
  await drill.locator('.rs-chart .line-legend button').first().click()
  await expect(drill.locator('.drill-meta')).toContainText('TEST3')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()
  await context.close()
})

test('section market toggles, RS line against SPY and the refresh button',async({browser})=>{
  const context=await browser.newContext({viewport:{width:834,height:1194},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  let calls=0;const asked:string[][]=[]
  const spy={...etfs[0],id:'spy',ticker:'SPY',name:'SPDR S&P 500',industry:'Broad Market'}
  const kr={...rows[0],id:'kr1',ticker:'005930',market:'KR',name:'한국 종목',sector:'Electronic Technology'}
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/leaderboard?*',route=>{calls++;route.fulfill({json:{rows:[...rows.map((r,i)=>({...r,traded_value_20d:i<5?1e9:3e9})),kr,...etfs,spy]}})})
  await page.route('**/functions/v1/price-history?*',route=>{
    const ids=new URL(route.request().url()).searchParams.get('ids')!.split(',');asked.push(ids)
    // stock rises 1/day, SPY flat at 100: RS line = stock/SPY rebased.
    route.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,Array.from({length:60},(_,d)=>[`2026-08-${String(d+1).padStart(2,'0')}`,id==='spy'?100:100+d])]))}})
  })
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  // Section toggles: the sector section switches to KR without touching 주도 종목; the global toggle resets all.
  const sectorPanel=page.locator('.dashboard-sector-panel')
  await expect(sectorPanel.locator('.etf-heat-market-head b')).toHaveText(['KR','US'])
  // VALUE-2: US tiles sized by summed trading value (Health Technology 15e9 vs Technology 5e9); KR has none yet → member count.
  await expect(sectorPanel.locator('.etf-heat-market-head span').nth(1)).toContainText('20일 평균 거래대금 합계')
  await expect(sectorPanel.locator('.etf-heat-market-head span').nth(0)).toContainText('종목 수 기준')
  const area=async(re:RegExp)=>{const b=(await sectorPanel.getByRole('listitem',{name:re}).boundingBox())!;return (b.width+2)*(b.height+2)}
  const ratio=await area(/^Health Technology ·/)/await area(/^Technology ·/)
  expect(ratio).toBeGreaterThan(2.6);expect(ratio).toBeLessThan(3.4)
  await sectorPanel.locator('.section-market').getByRole('button',{name:'KR'}).click()
  await expect(sectorPanel.locator('.etf-heat-market-head b')).toHaveText(['KR'])
  await expect(page.locator('.leadership-overview .section-market button.on')).toHaveText('전체')
  await page.locator('.toolbar .segment').getByRole('button',{name:'US'}).click()
  await expect(sectorPanel.locator('.section-market button.on')).toHaveText('US')
  await expect(sectorPanel.locator('.etf-heat-market-head b')).toHaveText(['US'])
  // RS line: 50D default, last close 159 vs base 109 against flat SPY.
  await page.locator('.dashboard-etf-panel .stock-row').first().click()
  await page.getByRole('button',{name:'닫기',exact:true}).click()
  await page.locator('.leadership-overview .line-legend button').first().click()
  const rs=page.locator('.drill-sheet .snapshot-section').filter({has:page.getByRole('heading',{name:'상대강도'})})
  await expect(rs.locator('svg .line-axis-title')).toHaveText('RS 라인 (시작=100)')
  await expect(rs.locator('.line-legend em')).toHaveText(`+${((159/109-1)*100).toFixed(1)}%`)
  expect(asked.some(ids=>ids.includes('spy'))).toBeTruthy()
  await page.getByRole('button',{name:'닫기',exact:true}).click()
  // Refresh: reloads the leaderboard and refetches daily prices.
  const before=asked.length
  await page.getByRole('button',{name:'새로고침',exact:true}).click()
  await expect.poll(()=>calls).toBe(2)
  await expect.poll(()=>asked.length).toBeGreaterThan(before)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()
  await context.close()
})
