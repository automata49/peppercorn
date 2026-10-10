import {openPage} from './journey-helpers'
import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

const journalRow={
  id:'j-aapl',date:'2026-10-01',account:'해외',ticker:'AAPL',name:'Apple',tranche:'1차',
  buy_price:320,currency:'USD',thesis:'테스트 가설',evidence_type:'펀더멘털',confidence:4,
  target_price:380,stop_price:300,review_condition:'MA50 이탈',review_date:'2026-10-15',
  status:'보유중',exit_date:'',sell_price:null,realized_return:null,thesis_hit:'',review_note:'',lesson:''
}

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.addInitScript(row=>localStorage.setItem('peppercorn-journal',JSON.stringify([row])),journalRow)
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

test('phone Journal shows recent decisions before the full edit grid',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  await boot(page)

  await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
  await page.locator('.menu-drawer').getByRole('button',{name:'매매 기록'}).click()
  const summary=page.locator('.workspace-mobile-summary')
  await expect(summary).toBeVisible()
  await expect(summary.locator('.decision-row')).toHaveCount(1)
  await expect(summary.locator('.decision-row').first()).toContainText('Apple')
  await expect(summary.locator('.decision-row').first()).toContainText('보유중')
  const table=page.locator('.workspace-table-disclosure')
  await expect(table).not.toHaveAttribute('open','')
  await table.locator(':scope > summary').click()
  await expect(table.locator('.ag-root')).toBeVisible()

  await table.locator(':scope > summary').click()
  await summary.locator('.decision-row').first().click()
  await expect(page.locator('.analysis-body .hero-name')).toHaveText('Apple')
  await context.close()
})

test('desktop Journal keeps the full editable grid open',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  await boot(page)
  await page.locator('.sidebar nav').getByRole('button',{name:'매매 기록'}).click()
  await expect(page.locator('.workspace-mobile-summary')).toBeHidden()
  const table=page.locator('.workspace-table-disclosure')
  await expect(table).toHaveAttribute('open','')
  await expect(table.locator(':scope > summary')).toBeHidden()
  await expect(table.locator('.ag-root')).toBeVisible()
})
