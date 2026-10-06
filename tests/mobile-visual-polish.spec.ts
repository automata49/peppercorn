import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

async function boxAtLeast(locator:any,width:number,height:number){
  const box=await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(width)
  expect(box!.height).toBeGreaterThanOrEqual(height)
}

for(const width of [390,430]){
  test(`phone ${width}px keeps touch targets and secondary type readable`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true})
    const page=await context.newPage()
    await boot(page)

    await boxAtLeast(page.locator('.mobile-brand-menu'),44,44)
    const nav=page.locator('.mobile-bottom-nav')
    await boxAtLeast(nav.getByRole('button',{name:'홈'}),44,52)
    expect(parseFloat(await nav.locator('b').first().evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(11)

    const marketButton=page.locator('.home-market-filter .mini-segment button').first()
    await boxAtLeast(marketButton,44,40)

    const classButton=page.locator('.home-class-grid button').first()
    await boxAtLeast(classButton,150,88)
    expect(parseFloat(await classButton.locator('b').evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(24)
    const todayRow=page.locator('.home-today-list .decision-row').first()
    await boxAtLeast(todayRow,200,52)

    await nav.getByRole('button',{name:'신호'}).click()
    const sectorRow=page.locator('.mobile-sector-list .decision-row').first()
    await boxAtLeast(sectorRow,160,64)
    expect(parseFloat(await sectorRow.locator('.decision-eyebrow').evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(9)
    expect(parseFloat(await sectorRow.locator('.decision-main > small:not(.decision-eyebrow)').evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(9)

    await nav.getByRole('button',{name:'관심'}).click()
    const tickerInput=page.locator('.ticker-entry input').first()
    await boxAtLeast(tickerInput,120,44)
    expect(parseFloat(await tickerInput.evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16)

    const disclosure=page.locator('.workspace-table-disclosure > summary')
    await boxAtLeast(disclosure,200,48)

    const workspaceRow=page.locator('.workspace-mobile-summary .decision-row').first()
    await boxAtLeast(workspaceRow,200,64)
    expect(parseFloat(await workspaceRow.locator('.decision-main > small:not(.decision-eyebrow)').evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(10)

    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBeTruthy()
    await context.close()
  })
}
