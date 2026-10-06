import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

test('phone Home stays editorial-flat while deeper evidence remains solid',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  await boot(page)

  const regime=page.locator('.home-regime')
  await expect(regime).toBeVisible()
  expect(parseFloat(await regime.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)
  const classes=page.locator('.home-class-grid')
  expect(parseFloat(await classes.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)
  await expect(page.locator('.dashboard-sector-panel')).toHaveCount(0)

  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'신호'}).click()
  const signal=page.locator('.market-signal-page')
  await expect(signal).toBeVisible()
  const metric=signal.locator('.market-signal-metrics > div').first()
  expect(await metric.evaluate(e=>getComputedStyle(e).backdropFilter)).toBe('none')
  expect(await metric.evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')

  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'분석'}).click()
  const primary=page.locator('.analysis-main > .analysis-price-momentum')
  await expect(primary).toHaveCount(1)
  expect(parseFloat(await primary.evaluate(e=>getComputedStyle(e).borderLeftWidth))).toBe(0)
  expect(parseFloat(await primary.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)
  await page.locator('.analysis-card').getByRole('tab',{name:'Overview'}).click()
  const detailBlocks=page.locator('.analysis-secondary-body > .analysis-block')
  await expect(detailBlocks).toHaveCount(3)
  for(let i=0;i<3;i++){
    const block=detailBlocks.nth(i)
    expect(parseFloat(await block.evaluate(e=>getComputedStyle(e).borderLeftWidth))).toBeGreaterThan(0)
    expect(parseFloat(await block.evaluate(e=>getComputedStyle(e).borderRadius))).toBeGreaterThanOrEqual(14)
  }
  await context.close()
})

test('desktop Home keeps the same progressive editorial hierarchy',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  await boot(page)
  await expect(page.locator('.home-regime')).toBeVisible()
  await expect(page.locator('.home-class-grid button')).toHaveCount(4)
  await expect(page.locator('.spotlight-chart')).toHaveCount(0)

  await page.locator('.sidebar nav').getByRole('button',{name:'종목 분석'}).click()
  const block=page.locator('.analysis-main > .analysis-price-momentum').first()
  expect(parseFloat(await block.evaluate(e=>getComputedStyle(e).borderLeftWidth))).toBe(0)
  expect(parseFloat(await block.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)
})
