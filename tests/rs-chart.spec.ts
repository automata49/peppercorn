import {test,expect} from '@playwright/test'
import {groupSeries,peerSeries,rsValue,seriesOf,topByRs,yScale} from '../src/lib/rsChart'
import {priceRs} from '../src/lib/benchmarkChart'
import type {LeaderRow} from '../src/types'

const base={asset_class:'Equity',exchange:'NASDAQ',index_memberships:['S&P 500'],price:100,ibd_rs_estimate:95,high_52w_distance:-.1,leader_tt:true,stage:'▲ 돌파',rs_3m:.1,rs_6m:.2,ma50:90,ma200:80,return_1w:.01,return_5d:.01,return_20d:.02,return_50d:.03,return_120d:.04,return_200d:.05,return_12m:.06,action_guide:'테스트 전용'}
// RS 20D rises with i; RS 5D falls with i, so switching the period reverses the order. TEST9 has no RS 20D.
const rows=Array.from({length:10},(_,i)=>({...base,id:String(i),ticker:'TEST'+i,market:'US',name:'검증 종목 '+i,sector:i<5?'Information Technology':'Health Technology',industry:i<5?'Semiconductors':'Biotechnology',rs_rank:99-i,leadership_class:i<4?'핵심 주도':i<8?'주도 후보':'중립',rs_5d:(5-i)/100,rs_20d:i===9?null:(i-3)/100,rs_50d:.03,rs_120d:.04,rs_200d:.05,rs_12m:.06}))
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
  expect(g.get('Information Technology')!.values[1]).toBeCloseTo(-.01)
  expect(g.get('Health Technology')!.values[1]).toBeCloseTo(.035)
  const cmp=peerSeries(r[0],[...r,...(etfs as unknown as LeaderRow[])],'rs')
  expect(cmp.map(s=>s.key)).toEqual(['self','industry','sector','market'])
  expect(cmp[1].values[1]).toBeCloseTo(-.01) // ETFs in the same industry are not peers of an equity
  expect(cmp[3].n).toBe(10)
  expect(peerSeries(etfs[2] as unknown as LeaderRow,[...r,...(etfs as unknown as LeaderRow[])],'return').map(s=>s.key)).toEqual(['self','industry','market'])
  const y=yScale(cmp)
  expect(y.lo).toBeLessThanOrEqual(-.03);expect(y.hi).toBeGreaterThanOrEqual(.06);expect(y.ticks).toContain(0)
})

test('PRICE-RS-1 aligns the benchmark by date, rebases both lines and marks RS new highs',()=>{
  const dates=Array.from({length:8},(_,i)=>`2026-09-0${i+1}`)
  // Stock peaks on day 5 then dips; the benchmark falls harder, so the RS line keeps making highs.
  const stock={dates,closes:[100,102,104,106,110,108,107,109]}
  const bench={dates:dates.filter(d=>d!=='2026-09-04'),closes:[100,100,100,100,96,92,90]}
  const d=priceRs(stock,bench,5)!
  expect(d.dates).toEqual(dates.slice(2))
  expect(d.price[0]).toBe(100);expect(d.price[5]).toBeCloseTo(109/104*100)
  expect(d.bench![1]).toBeNull() // no benchmark close on 09-04: a gap, not a zero
  expect(d.bench![5]).toBeCloseTo(90)
  expect(d.rs![1]).toBeNull()
  expect(d.rs![5]).toBeCloseTo((109/90)/(104/100)*100)
  expect(d.rsHigh).toEqual([true,false,true,true,true,true]) // the missing day is never a new high
  expect(d.belowPriceHigh).toBe(true)
  expect(d.complete).toBe(true)
  const short=priceRs(stock,undefined,20)!
  expect(short.complete).toBe(false);expect(short.dates).toHaveLength(8);expect(short.rs).toBeNull();expect(short.bench).toBeNull()
  expect(priceRs({dates:['a'],closes:[1]},bench,5)).toBeNull()
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

  // DASHBOARD-FOCUS-1 keeps charts secondary: the ranked focus list and compact sector table are visible first.
  await expect(page.locator('.focus-leader-row')).toHaveCount(4)
  await expect(page.locator('.leader-detail')).not.toHaveAttribute('open','')
  await page.locator('.leader-detail > summary').click()
  const leaderChart=page.locator('.leadership-overview .rs-chart')
  await expect(leaderChart.locator('.rs-mode-toggle')).toHaveCount(0)
  await expect(leaderChart.locator('.rs-period-toggle button')).toHaveText(['5D','20D','50D','120D','200D','52W'])
  await expect(leaderChart.locator('svg .line-axis-title')).toHaveText('지수 (시작=100)')
  await expect(leaderChart.locator('.line-legend li')).toHaveCount(4)
  await expect(leaderChart.locator('.line-legend em').first()).toHaveText(`+${((129/109-1)*100).toFixed(1)}%`)
  await leaderChart.getByRole('button',{name:'5D',exact:true}).click()
  await expect(leaderChart.locator('.line-legend em').first()).toHaveText(`+${((129/124-1)*100).toFixed(1)}%`)

  const sectorDisclosure=page.locator('.sector-heat-disclosure')
  await expect(sectorDisclosure).not.toHaveAttribute('open','')
  await sectorDisclosure.locator(':scope > summary').click()
  const sectorChart=page.locator('.dashboard-sector-panel .sector-heat')
  await expect(sectorChart.locator('.etf-heat-tile')).toHaveCount(2)
  const sectorAnchor=view.width<=650?page.locator('.mobile-sector-list'):page.locator('.dashboard-sector-panel .dashboard-sector-table')
  expect((await sectorChart.boundingBox())!.y).toBeGreaterThan((await sectorAnchor.boundingBox())!.y)

  const explore=page.locator('.dashboard-explore')
  await expect(explore).not.toHaveAttribute('open','')
  await explore.locator(':scope > summary').click()
  const etfChart=page.locator('.dashboard-etf-panel .rs-chart')
  await expect(etfChart.locator('.line-legend b')).toHaveCount(3)
  expect((await etfChart.boundingBox())!.y).toBeLessThan((await page.locator('.dashboard-etf-panel .stock-rows').boundingBox())!.y)
  await noOverflow()

  // Sector tile → sector popup (momentum lines on top) → stock detail (own daily line in 03 가격 모멘텀).
  await expect(sectorChart.locator('.etf-heat-market-head b')).toHaveText(['US'])
  await sectorChart.getByRole('listitem',{name:/^Information Technology ·/}).click()
  const drill=page.locator('.drill-sheet')
  await expect(drill.locator('.drill-tabs')).toBeVisible()
  await expect(drill.locator('.rs-chart svg .line-axis-title')).toHaveText('지수 (시작=100)')
  expect((await drill.locator('.rs-chart').boundingBox())!.y).toBeLessThan((await drill.locator('.stock-rows').boundingBox())!.y)
  await expect(drill.locator('.drill-back')).toHaveCount(0)
  await drill.locator('.stock-row').first().click()
  const back=drill.locator('.drill-back')
  await expect(back).toHaveText('‹ 목록으로')
  const section=(name:string)=>drill.locator('.snapshot-section').filter({has:page.getByRole('heading',{name})})
  // PRICE-RS-1: 02 상대강도 keeps the RS numbers only; 03 holds the combined chart. No SPY row here, so no RS panel.
  await expect(section('상대강도').locator('svg')).toHaveCount(0)
  await expect(section('가격 모멘텀')).toContainText('벤치마크(SPY) 가격이 없어')
  await expect(section('가격 모멘텀').locator('svg .line-axis-title')).toHaveText(['지수 (시작=100)'])
  await expect(section('가격 모멘텀').locator('.line-legend li')).toHaveCount(1)
  await expect(section('가격 모멘텀').locator('.rs-period-toggle button')).toHaveCount(6)
  // Spark-inspired exploration: exact observed dates, keyboard/touch, no synthetic prices.
  const scrubber=section('가격 모멘텀').getByRole('slider',{name:'차트 날짜 탐색'})
  await scrubber.focus()
  await page.keyboard.press('Home')
  await expect(section('가격 모멘텀').locator('.chart-readout time')).toHaveText('2026-09-01')
  await expect(section('가격 모멘텀').locator('.chart-readout b').first()).toHaveText('100.0')
  await page.keyboard.press('End')
  await expect(section('가격 모멘텀').locator('.chart-readout time')).toHaveText('2026-09-30')
  const plot=section('가격 모멘텀').locator('.scrubbable-chart')
  await plot.scrollIntoViewIfNeeded()
  const box=(await plot.boundingBox())!
  if(view.touch)await page.touchscreen.tap(box.x+46,box.y+65)
  else {await page.mouse.move(box.x+46,box.y+65);await page.mouse.down();await page.mouse.up()}
  await expect(section('가격 모멘텀').locator('.chart-crosshair')).toHaveCount(1)
  await expect(section('가격 모멘텀').locator('.chart-readout time')).toHaveText('2026-09-01')
  await page.emulateMedia({reducedMotion:'reduce'})
  expect(await section('가격 모멘텀').locator('.chart-readout b').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none')
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
  await expect(drill.locator('.snapshot-section').filter({has:page.getByRole('heading',{name:'가격 모멘텀'})}).locator('.rs-period-toggle button')).toHaveCount(6)
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
  await page.locator('.leader-detail > summary').click()
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
  await page.locator('.leader-detail > summary').click()
  const chart=page.locator('.leadership-overview .rs-chart')
  // Focus contains TEST0,1 and TEST5,6: two representatives from each industry group.
  await expect(chart.locator('.line-legend b')).toHaveText(['검증 종목 6','검증 종목 5','검증 종목 1','검증 종목 0'])
  expect(asked.some(ids=>ids.length===4)).toBeTruthy()
  await page.locator('.focus-class-strip button').filter({hasText:'핵심'}).click()
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
  await sectorPanel.locator('.sector-heat-disclosure > summary').click()
  await expect(sectorPanel.locator('.etf-heat-market-head b')).toHaveText(['KR','US'])
  // VALUE-2: US tiles sized by summed trading value (Health Technology 15e9 vs Technology 5e9); KR has none yet → member count.
  await expect(sectorPanel.locator('.etf-heat-market-head span').nth(1)).toContainText('20일 평균 거래대금 합계')
  await expect(sectorPanel.locator('.etf-heat-market-head span').nth(0)).toContainText('종목 수 기준')
  const area=async(re:RegExp)=>{const b=(await sectorPanel.getByRole('listitem',{name:re}).boundingBox())!;return (b.width+2)*(b.height+2)}
  const ratio=await area(/^Health Technology ·/)/await area(/^Information Technology ·/)
  expect(ratio).toBeGreaterThan(2.6);expect(ratio).toBeLessThan(3.4)
  await sectorPanel.locator('.section-market').getByRole('button',{name:'KR'}).click()
  await expect(sectorPanel.locator('.etf-heat-market-head b')).toHaveText(['KR'])
  await expect(page.locator('.leadership-overview .section-market button.on')).toHaveText('전체')
  await page.locator('.toolbar .segment').getByRole('button',{name:'US'}).click()
  await expect(sectorPanel.locator('.section-market button.on')).toHaveText('US')
  await expect(sectorPanel.locator('.etf-heat-market-head b')).toHaveText(['US'])
  // RS line: 50D default, last close 159 vs base 109 against flat SPY.
  await page.locator('.dashboard-explore > summary').click()
  await page.locator('.dashboard-etf-panel .stock-row').first().click()
  await page.getByRole('button',{name:'닫기',exact:true}).click()
  await page.locator('.leader-detail > summary').click()
  await page.locator('.leadership-overview .line-legend button').first().click()
  const chart=page.locator('.drill-sheet .snapshot-section').filter({has:page.getByRole('heading',{name:'가격 모멘텀'})})
  await expect(chart.locator('svg .line-axis-title')).toHaveText(['지수 (시작=100)','RS 라인 (SPY 대비)'])
  // Legend: stock, benchmark (flat SPY → +0.0%), RS line (= stock change against a flat benchmark).
  await expect(chart.locator('.line-legend b')).toHaveText(['검증 종목 0','SPY','RS 라인'])
  await expect(chart.locator('.line-legend em')).toHaveText([`+${((159/109-1)*100).toFixed(1)}%`,'+0.0%',`+${((159/109-1)*100).toFixed(1)}%`])
  await expect(chart.locator('[data-key="bench"]')).toHaveCount(1)
  // Rising stock vs flat SPY: all 51 shown days are RS new highs (history starts 9 sessions earlier); the price is at its high too, so no callout.
  await expect(chart.locator('.price-rs-new-high')).toHaveCount(51)
  await expect(chart.locator('.price-rs-callout')).toHaveCount(0)
  expect(asked.some(ids=>ids.includes('spy'))).toBeTruthy()
  await page.getByRole('button',{name:'닫기',exact:true}).click()
  // Refresh: compact layouts keep the same action in the secondary drawer.
  const before=asked.length
  await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
  await page.locator('.menu-drawer').getByRole('button',{name:'데이터 새로고침'}).click()
  await expect.poll(()=>calls).toBe(2)
  await expect.poll(()=>asked.length).toBeGreaterThan(before)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()
  await context.close()
})

test('cold history mounts and sizes the stock chart after data arrives',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  let release!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve})
  await page.route('**/functions/v1/price-history?*',async route=>{
    await gate
    const ids=new URL(route.request().url()).searchParams.get('ids')!.split(',')
    await route.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,Array.from({length:60},(_,i)=>[`2026-08-${String(i+1).padStart(2,'0')}`,100+i])]))}})
  })
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await page.getByRole('button',{name:/이 종목 깊이 보기/}).click()
  const chart=page.locator('.drill-sheet .price-rs')
  await expect(chart).toContainText('일별 가격을 불러오는 중')
  release()
  await expect(chart.locator('svg [data-key="price"]')).toBeVisible()
  await expect(chart.getByRole('slider',{name:'차트 날짜 탐색'})).toBeVisible()
})
