import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

test('phone analysis records are secondary and editable on demand',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  await boot(page)
  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'Thesis',exact:true}).click()
  const records=page.locator('.analysis-records-disclosure')
  await expect(records).not.toHaveAttribute('open','')
  await expect(records.locator(':scope > summary')).toBeVisible()
  await expect(records.locator('.analysis-records-note')).toBeHidden()
  await records.locator(':scope > summary').click()
  await expect(records).toHaveAttribute('open','')
  await expect(records.locator('.ag-root')).toBeVisible()
  await context.close()
})

test('desktop analysis records stay open without an extra disclosure header',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  await boot(page)
  await page.locator('.sidebar nav').getByRole('button',{name:'Thesis',exact:true}).click()
  const records=page.locator('.analysis-records-disclosure')
  await expect(records).toHaveAttribute('open','')
  await expect(records.locator(':scope > summary')).toBeHidden()
  await expect(records.locator('.analysis-records-note')).toBeVisible()
  await expect(records.locator('.ag-root')).toBeVisible()
})
