import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'

test('three vertical wheels, tab-level Filter & Sort and KR/US price-return colors',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.addInitScript(()=>{
    sessionStorage.setItem('peppercorn-intro-seen','1')
    localStorage.setItem('folio-stock-size','all')
    localStorage.setItem('folio-catalog-view','list')
  })
  const rows=demoRows.map((r,i)=>({...r,leadership_class:'핵심 주도',return_20d:i===1||i===2?-.05:.05}))
  await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{
    AAPL:{price:350,time:null,previous_close:340,currency:'USD'},
    '000660.KS':{price:285000,time:null,previous_close:300000,currency:'KRW'}
  }}}))
  await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
  await page.goto('/peppercorn/')
  const nav=page.locator('.mobile-bottom-nav').getByRole('button',{name:'발견',exact:true})
  await nav.click()
  await page.getByRole('tablist',{name:'발견 영역'}).getByRole('tab',{name:'종목 검토',exact:true}).click()
  const tabs=page.getByRole('tablist',{name:'발견 영역'}).getByRole('tab')
  await expect(tabs).toHaveText(['시장 신호','종목 검토','리서치 기록'])
  const filter=page.getByRole('button',{name:/Filter & Sort/})
  const heading=(await page.locator('.catalog-heading-row h2').boundingBox())!,filterBox=(await filter.boundingBox())!
  expect(filterBox.x).toBeGreaterThan(heading.x+heading.width)
  expect(Math.abs(filterBox.y+filterBox.height/2-heading.y-heading.height/2)).toBeLessThan(22)

  const wheels=page.locator('.catalog-filter-rails > .catalog-wheel')
  await expect(wheels).toHaveCount(3)
  const boxes=await wheels.evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}}))
  expect(boxes[0].x).toBeLessThan(boxes[1].x)
  expect(boxes[1].x).toBeLessThan(boxes[2].x)
  expect(Math.abs(boxes[0].y-boxes[1].y)).toBeLessThan(4)
  expect(Math.abs(boxes[1].y-boxes[2].y)).toBeLessThan(4)
  await expect(page.locator('[data-wheel="종목 분류"] [data-offset="-1"]').first()).toBeVisible()
  await page.locator('[data-wheel="주도 분류"]').getByRole('button',{name:'전체',exact:true}).click()
  const list=page.locator('.stock-compact-list')
  await expect(list.locator('.stock-compact-head')).toContainText('등락률')

  await expect(page.locator('.stock-compact-row').filter({has:page.locator('.stock-compact-ticker', {hasText:'AAPL'})}).locator('.stock-compact-price')).toContainText('$350.00',{timeout:10000})
  const aapl=list.locator('.stock-compact-row').filter({has:page.locator('.stock-compact-ticker', {hasText:'AAPL'})})
  const hynix=list.locator('.stock-compact-row').filter({has:page.locator('.stock-compact-ticker', {hasText:'000660'})})
  await expect(aapl.locator('.stock-compact-change')).toContainText('1D')
  await expect(hynix.locator('.stock-compact-change')).toContainText('1D')
  await expect(aapl.locator('.stock-compact-price')).toHaveCSS('color','rgb(25, 107, 66)')
  await expect(aapl.locator('.stock-compact-change')).toHaveCSS('color','rgb(25, 107, 66)')
  await expect(hynix.locator('.stock-compact-price')).toHaveCSS('color','rgb(28, 92, 171)')
  await expect(hynix.locator('.stock-compact-change')).toHaveCSS('color','rgb(28, 92, 171)')
  const samsung=list.locator('.stock-compact-row').filter({has:page.locator('.stock-compact-ticker', {hasText:'005930'})})
  await expect(samsung.locator('.stock-compact-change')).toContainText('20D')
  await expect(samsung.locator('.stock-compact-price')).toHaveCSS('color','rgb(179, 38, 30)')

  await filter.click()
  await expect(page.getByRole('combobox',{name:'탐색 섹터'})).toBeVisible()
  await page.getByRole('button',{name:'필터 닫기'}).click()
  await tabs.first().click()
  await expect(page.getByRole('tab',{name:'시장 신호'})).toHaveAttribute('aria-selected','true')
  await expect(filter).toHaveCount(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})
