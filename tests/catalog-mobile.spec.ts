import {openPage} from './journey-helpers'
import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

async function openDrawerPage(page:any,name:string){
  await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
  await page.locator('.menu-drawer').getByRole('button',{name}).click()
}

test('phone Leaderboard and Universe are summary-first',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  await boot(page)

  await openDrawerPage(page,'Leaderboard')
  await expect(page.locator('.catalog-guide')).toBeHidden()
  const leaderSummary=page.locator('.catalog-mobile-summary')
  await expect(leaderSummary).toBeVisible()
  await expect(leaderSummary.locator('.decision-row')).toHaveCount(5)
  await expect(leaderSummary.locator('.decision-row').first()).toContainText('Apple')
  const leaderTable=page.locator('.catalog-table-disclosure')
  await expect(leaderTable).not.toHaveAttribute('open','')
  await leaderTable.locator(':scope > summary').click()
  await expect(leaderTable.locator('.ag-root')).toBeVisible()

  await openDrawerPage(page,'Universe')
  const universeSummary=page.locator('.catalog-mobile-summary')
  await expect(universeSummary).toBeVisible()
  await expect(universeSummary.locator('.decision-row')).toHaveCount(5)
  const universeTable=page.locator('.catalog-table-disclosure')
  await expect(universeTable).not.toHaveAttribute('open','')
  await universeSummary.locator('.decision-row').first().click()
  await expect(page.locator('.analysis-body .hero-name')).toHaveText('Apple')
  await context.close()
})

test('desktop Leaderboard and Universe keep full grids open',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  await boot(page)
  const side=page.locator('.sidebar nav')

  await side.getByRole('button',{name:'Leaderboard'}).click()
  await expect(page.locator('.catalog-mobile-summary')).toBeHidden()
  let disclosure=page.locator('.catalog-table-disclosure')
  await expect(disclosure).toHaveAttribute('open','')
  await expect(disclosure.locator(':scope > summary')).toBeHidden()
  await expect(disclosure.locator('.ag-root')).toBeVisible()

  await side.getByRole('button',{name:'Universe'}).click()
  await expect(page.locator('.catalog-mobile-summary')).toBeHidden()
  disclosure=page.locator('.catalog-table-disclosure')
  await expect(disclosure).toHaveAttribute('open','')
  await expect(disclosure.locator('.ag-root')).toBeVisible()
})
