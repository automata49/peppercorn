import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

test('phone Watchlist and Portfolio use summary-first progressive disclosure',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  await boot(page)

  await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
  await page.locator('.menu-drawer').getByRole('button',{name:'Watchlist'}).click()
  const watchSummary=page.locator('.workspace-mobile-summary')
  await expect(watchSummary).toBeVisible()
  await expect(watchSummary.locator('.decision-row')).toHaveCount(4)
  await expect(watchSummary.locator('.decision-row').first()).toContainText('Apple')
  const watchTable=page.locator('.workspace-table-disclosure')
  await expect(watchTable).not.toHaveAttribute('open','')
  await watchTable.locator(':scope > summary').click()
  await expect(watchTable).toHaveAttribute('open','')
  await expect(watchTable.locator('.ag-root')).toBeVisible()

  await page.getByRole('button',{name:/메뉴 열기/}).first().click()
  await page.locator('.menu-drawer').getByRole('button',{name:'Portfolio'}).click()
  const portfolioSummary=page.locator('.workspace-mobile-summary')
  await expect(portfolioSummary.locator('.decision-row')).toHaveCount(2)
  await expect(portfolioSummary.locator('.decision-row').first()).toContainText('Strategy')
  const portfolioTable=page.locator('.workspace-table-disclosure')
  await expect(portfolioTable).not.toHaveAttribute('open','')

  await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
  await page.locator('.menu-drawer').getByRole('button',{name:'Watchlist'}).click()
  await page.locator('.workspace-mobile-summary .decision-row').first().click()
  await expect(page.locator('.analysis-body .hero-name')).toHaveText('Apple')
  await context.close()
})

test('desktop keeps workspace grids open and hides the mobile summary',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  await boot(page)
  await page.locator('.sidebar nav').getByRole('button',{name:'Watchlist'}).click()
  await expect(page.locator('.workspace-mobile-summary')).toBeHidden()
  const disclosure=page.locator('.workspace-table-disclosure')
  await expect(disclosure).toHaveAttribute('open','')
  await expect(disclosure.locator(':scope > summary')).toBeHidden()
  await expect(disclosure.locator('.ag-root')).toBeVisible()
})
