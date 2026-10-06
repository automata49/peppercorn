import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

const journalRow={
  id:'j-aapl',date:'2026-10-01',account:'해외',ticker:'AAPL',name:'Apple',tranche:'1차',
  buy_price:320,currency:'USD',thesis:'테스트 가설',evidence_type:'펀더멘털',confidence:4,
  target_price:380,stop_price:300,review_condition:'MA50 이탈',review_date:'2026-10-15',
  status:'보유중',exit_date:'',sell_price:null,realized_return:null,thesis_hit:'',review_note:'',lesson:''
}

async function openDrawerPage(page:any,name:string){
  await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
  await page.locator('.menu-drawer').getByRole('button',{name}).click()
}

async function noHorizontalOverflow(page:any){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBeTruthy()
}

test('phone primary surfaces keep dense grids and secondary data out of the default view',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.addInitScript(row=>localStorage.setItem('peppercorn-journal',JSON.stringify([row])),journalRow)
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})

  // Home: only regime, four leadership states, 3–5 Focus names and one structured Insight.
  await expect(page.locator('.home-regime')).toBeVisible()
  await expect(page.locator('.home-class-grid button')).toHaveCount(4)
  const homeRows=page.locator('.home-today-list .decision-row')
  expect(await homeRows.count()).toBeGreaterThan(0)
  expect(await homeRows.count()).toBeLessThanOrEqual(5)
  await expect(page.locator('.home-insight')).toBeVisible()
  await expect(page.locator('.dashboard-sector-panel')).toHaveCount(0)
  await noHorizontalOverflow(page)

  // Market Signal: dense market/sector evidence is one level deeper.
  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'신호'}).click()
  await expect(page.locator('.market-signal-metrics > div')).toHaveCount(4)
  await expect(page.locator('.mobile-sector-list')).toBeVisible()
  await expect(page.locator('.dashboard-sector-table-wrap')).toBeHidden()
  await noHorizontalOverflow(page)

  // Analysis: one explicit decision path; Overview is primary and records stay secondary.
  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'Stock'}).click()
  await expect(page.locator('.analysis-hub-head')).toBeVisible()
  await expect(page.locator('.analysis-detail-tabs').getByRole('tab',{name:'Overview'})).toHaveAttribute('aria-selected','true')
  await expect(page.locator('.analysis-records-disclosure')).not.toHaveAttribute('open','')
  await noHorizontalOverflow(page)

  // Watchlist / Portfolio / Journal: compact decision rows first, editable grids closed.
  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'관심'}).click()
  await expect(page.locator('.workspace-mobile-summary')).toBeVisible()
  await expect(page.locator('.workspace-table-disclosure')).not.toHaveAttribute('open','')
  await noHorizontalOverflow(page)

  await openDrawerPage(page,'Portfolio')
  await expect(page.locator('.workspace-mobile-summary')).toBeVisible()
  await expect(page.locator('.workspace-table-disclosure')).not.toHaveAttribute('open','')
  await noHorizontalOverflow(page)

  await openDrawerPage(page,'Journal')
  await expect(page.locator('.workspace-mobile-summary')).toBeVisible()
  await expect(page.locator('.workspace-mobile-summary .decision-row')).toHaveCount(1)
  await expect(page.locator('.workspace-table-disclosure')).not.toHaveAttribute('open','')
  await noHorizontalOverflow(page)

  // Public catalog pages: summary rows first, canonical grids closed.
  await openDrawerPage(page,'Leaderboard')
  await expect(page.locator('.catalog-mobile-summary')).toBeVisible()
  await expect(page.locator('.catalog-table-disclosure')).not.toHaveAttribute('open','')
  await expect(page.locator('.catalog-guide')).toBeHidden()
  await noHorizontalOverflow(page)

  await openDrawerPage(page,'Universe')
  await expect(page.locator('.catalog-mobile-summary')).toBeVisible()
  await expect(page.locator('.catalog-table-disclosure')).not.toHaveAttribute('open','')
  await expect(page.locator('.catalog-guide')).toBeHidden()
  await noHorizontalOverflow(page)

  await context.close()
})
