import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

const rows=demoRows.map((r,i)=>({
  ...r,
  leadership_class:i<4?'핵심 주도':i<7?'주도 후보':'강세 전환',
  rs_rank:99-i,
  return_20d:r.return_20d??.03,
  ma50:r.ma50??Number(r.price||100)*.95,
  ma200:r.ma200??Number(r.price||100)*.88,
  high_52w_distance:r.high_52w_distance??-.08,
}))

async function boot(page:any){
  await page.addInitScript(()=>{
    sessionStorage.setItem('peppercorn-intro-seen','1')
    localStorage.setItem('folio-theme','light')
  })
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.route('**/functions/v1/price-history?*',route=>route.fulfill({json:{series:{}}}))
  await page.goto('/peppercorn/')
}

for(const width of [390,834,1194,1366,1440]){
  test(`progressive Folio journey at ${width}px`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<1440,isMobile:width<900,colorScheme:'light'})
    const page=await context.newPage()
    await boot(page)

    // Home is intentionally shallow.
    await expect(page.locator('.home-regime')).toBeVisible()
    await expect(page.locator('.home-class-grid button')).toHaveCount(4)
    const today=page.locator('.home-today-list .decision-row')
    expect(await today.count()).toBeGreaterThan(0)
    expect(await today.count()).toBeLessThanOrEqual(5)
    await expect(page.locator('.home-insight')).toContainText('AI INSIGHT')
    await expect(page.locator('.dashboard-sector-panel')).toHaveCount(0)
    await expect(page.locator('.temp-card')).toHaveCount(0)
    await expect(page.locator('.dashboard-explore')).toHaveCount(0)
    await expect(page.locator('.spotlight-chart')).toHaveCount(0)

    // Market Signal reveals breadth/sector/temperature only after intent.
    await page.getByRole('button',{name:'Market Signal →'}).click()
    await expect(page.locator('.market-signal-page')).toBeVisible()
    await expect(page.locator('.market-signal-metrics > div')).toHaveCount(4)
    await expect(page.locator('.dashboard-sector-panel')).toBeVisible()
    await expect(page.locator('.temp-card')).toBeVisible()
    await expect(page.locator('.dashboard-explore')).not.toHaveAttribute('open','')

    const mobileSector=page.locator('.mobile-sector-list .decision-row').first()
    if(await mobileSector.isVisible())await mobileSector.click()
    else await page.locator('.dashboard-sector-table tbody tr').first().click()

    // Leadership narrows the list before opening a stock.
    await expect(page.locator('.leadership-page')).toBeVisible()
    await expect(page.locator('.leadership-tabs button')).toHaveCount(4)
    const leader=page.locator('.leadership-page-list .decision-row').first()
    await expect(leader).toBeVisible()
    await leader.click()

    // Stock detail precedes Thesis.
    await expect(page.locator('.drill-sheet')).toBeVisible()
    await page.getByRole('button',{name:'종목분석 기록 작성 →'}).click()
    await expect(page.locator('.analysis-page')).toBeVisible()
    await expect(page.locator('.analysis-detail-tabs').getByRole('tab')).toHaveText(['Overview','Analysis','Financials','Thesis'])
    await page.locator('.analysis-detail-tabs').getByRole('tab',{name:'Thesis'}).click()
    await expect(page.locator('.analysis-judgement')).toContainText('MY THESIS')
    await expect(page.getByRole('button',{name:'Decision 기록 →'})).toBeVisible()

    // Decision continues into tracking rather than adding more Home detail.
    await page.getByRole('button',{name:'Decision 기록 →'}).click()
    await expect(page.locator('.page-journal')).toBeVisible()

    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true)
    await context.close()
  })
}
