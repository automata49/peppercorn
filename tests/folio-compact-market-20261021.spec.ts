import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'

for(const [width,height] of [[390,844],[834,1194],[1194,834],[1440,900]]){
 test(`Market Signal is concise and editorial at ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height})
  await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
  await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.goto('/peppercorn/')
  const nav=page.locator('.mobile-bottom-nav').getByRole('button',{name:'발견',exact:true})
  if(await nav.isVisible())await nav.click()
  else await page.locator('.sidebar nav').getByRole('button',{name:'발견',exact:true}).click()
  await expect(page.getByRole('tab',{name:'시장 신호',exact:true})).toHaveAttribute('aria-selected','true')
  await expect(page.locator('.signal-journey-heading,.leader-tools-trigger')).toHaveCount(0)
  await expect(page.getByText(/홈과 동일한.*ETF RS 순위.*이어/)).toHaveCount(0)
  await expect(page.locator('.discovery-news-heading .journey-kicker')).toHaveText('MARKET & COMPANIES')
  await expect(page.locator('.discovery-news-heading h3')).toHaveText('시장과 기업의 새 소식')
  const titles=[
   ['Sector Leaders','주도 섹터'],
   ['SECTOR MAP','시장 지표 · 섹터 히트맵'],
   ['ETF MAP','ETF 주도 산업'],
  ]
  const headings=page.locator('.folio-editorial-map-heading')
  await expect(headings).toHaveCount(3)
  for(let i=0;i<titles.length;i++){
   const heading=headings.nth(i)
   await expect(heading.locator('.journey-kicker')).toHaveText(titles[i][0])
   await expect(heading.locator('h2,h3')).toHaveText(titles[i][1])
   const design=await heading.evaluate(el=>{
    const s=getComputedStyle(el.querySelector('.journey-kicker')!)
    const h=getComputedStyle(el.querySelector('h2,h3')!)
    return {eyebrow:[s.fontSize,s.fontWeight,s.letterSpacing,s.lineHeight],title:[h.fontSize,h.fontWeight,h.letterSpacing,h.lineHeight]}
   })
   const canonical=await page.locator('.discovery-news-heading').evaluate(el=>{
    const s=getComputedStyle(el.querySelector('.journey-kicker')!)
    const h=getComputedStyle(el.querySelector('h3')!)
    return {eyebrow:[s.fontSize,s.fontWeight,s.letterSpacing,s.lineHeight],title:[h.fontSize,h.fontWeight,h.letterSpacing,h.lineHeight]}
   })
   expect(design).toEqual(canonical)
  }
  await expect(page.locator('.dashboard-sector-panel')).toBeVisible()
  if(width<=650)await expect(page.locator('.mobile-sector-list')).toBeVisible()
  else await expect(page.locator('.dashboard-sector-table')).toBeVisible()
  await expect(page.locator('.sector-heat')).toBeVisible()
  await expect(page.locator('.dashboard-etf-industry-panel')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 })
}
