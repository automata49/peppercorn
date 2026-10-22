import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {openPage} from './journey-helpers'

const rows=[...demoRows,{...demoRows[0],id:'test-etf',asset_class:'ETF' as const,ticker:'QQQ',name:'Invesco QQQ ETF',etf_rs_rank:94}]

async function boot(page:import('@playwright/test').Page){
 await page.addInitScript(()=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-stock-size','all')})
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.goto('/peppercorn/')
}

for(const width of [390,834,1440]){
 test(`folio quick actions and name/code entry ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});await boot(page)
  await openPage(page,'여정')
  await page.getByRole('tab',{name:'관심종목',exact:true}).click()
  const watch=page.locator('.ticker-entry')
  await watch.getByRole('searchbox').fill('삼성전자')
  await expect(watch.locator('.ticker-entry-results button')).toContainText(['삼성전자KR · 005930'])
  await watch.locator('.ticker-entry-results button').first().click()
  await expect(watch.locator('.ticker-entry-error')).toHaveCount(0)
  await expect(page.locator('.workspace-mobile-summary')).toContainText('삼성전자')
  await watch.getByRole('searchbox').fill('005930')
  await watch.getByRole('button',{name:'추가',exact:true}).click()
  await expect(watch.getByRole('alert')).toContainText('이미 Watchlist')

  await page.getByRole('tab',{name:'보유종목',exact:true}).click()
  const portfolio=page.locator('.ticker-entry')
  await portfolio.getByRole('searchbox').fill('Apple')
  await portfolio.locator('.ticker-entry-results button').first().click()
  await expect(page.locator('.workspace-mobile-summary')).toContainText('Apple')
  await portfolio.getByRole('searchbox').fill('QQQ')
  await portfolio.getByRole('button',{name:'추가',exact:true}).click()
  await expect(page.locator('.workspace-mobile-summary')).toContainText('Invesco QQQ ETF')

  await openPage(page,'발견')
  const header=page.locator(width>=1280?'.desktop-navigation':'.mobile-brandbar')
  await header.getByRole('button',{name:'종목 검색',exact:true}).click()
  const search=page.getByRole('dialog',{name:'종목 검색'}).getByRole('combobox',{name:'종목 검색'})
  await search.fill('005930');await search.press('Enter')
  const actions=page.getByRole('toolbar',{name:'종목 빠른 동작'})
  await expect(actions).toBeVisible()
  await actions.getByRole('button',{name:'장바구니 담기',exact:true}).click()
  await expect(actions.getByRole('button',{name:'장바구니 담김',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(header.getByRole('button',{name:'장바구니 1종목'})).toBeVisible()
  await actions.getByRole('button',{name:'관심 등록됨'}).click()
  await expect(actions.getByRole('status')).toContainText('이미 관심종목')
  await actions.getByRole('button',{name:'Thesis 쓰기'}).click()
  await expect(page.getByRole('tab',{name:'Thesis',exact:true})).toHaveAttribute('aria-selected','true')
  await expect(page.locator('.analysis-sheet .sheet-table')).toBeVisible()
  await expect(page.locator('.analysis-sheet input:focus,.analysis-sheet select:focus,.analysis-sheet textarea:focus')).toHaveCount(1)
  await expect(page.locator('.analysis-actionbar')).toContainText('Thesis를 생성했습니다')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 })
}
