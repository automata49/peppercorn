import {test,expect} from '@playwright/test'
import {openPage} from './journey-helpers'

for(const [width,height] of [[390,844],[834,1194],[1194,834],[1440,900]]){
 test(`editorial tabs have no grey rail; Journal cover and tabs match Discover at ${width}`,async({page})=>{
  await page.setViewportSize({width,height})
  await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
  await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.goto('/peppercorn/')
  const rail=async selector=>page.locator(selector).evaluate(el=>({
   width:getComputedStyle(el).borderBottomWidth,
   style:getComputedStyle(el).borderBottomStyle
  }))
  await openPage(page,'발견')
  await expect(page.locator('.discovery-tabbar .folio-tabs-trigger')).toHaveText(['시장 신호','종목 검토','리서치 기록'])
  expect((await rail('.discovery-tabbar')).width).toBe('0px')
  expect((await rail('.discovery-tabbar .folio-tabs-list')).width).toBe('0px')
  await openPage(page,'여정')
  expect((await rail('.journey-magazine-tabs')).width).toBe('0px')
  await openPage(page,'저널')
  const heading=page.locator('.lifetime-journal>.journal-section-heading')
  const photo=heading.locator('img')
  await expect(photo).toBeVisible()
  await expect.poll(()=>photo.evaluate(e=>e instanceof HTMLImageElement&&e.complete?e.naturalWidth:0)).toBeGreaterThan(0)
  const photoBox=await photo.boundingBox()
  expect(photoBox!.height).toBeGreaterThanOrEqual(90)
  if(width<=580)expect(photoBox!.width).toBeGreaterThanOrEqual(width-60)
  const tabs=page.locator('.journal-magazine-tabs')
  await expect(tabs.getByRole('tab')).toHaveText(['전체','일상','투자'])
  expect((await rail('.journal-magazine-tabs')).width).toBe('0px')
  const original=await tabs.locator('.folio-tabs-trigger').first().evaluate(el=>{
   const s=getComputedStyle(el);return [s.fontSize,s.fontWeight,s.lineHeight,s.letterSpacing]
  })
  for(const [label] of [['일상'],['투자'],['전체']]){
   const tab=tabs.getByRole('tab',{name:label})
   await tab.click()
   await expect(tab).toHaveAttribute('data-state','active')
   expect(await tab.evaluate(el=>getComputedStyle(el).borderBottomColor)).toBe('rgb(17, 17, 19)')
  }
  const styled=await tabs.locator('.folio-tabs-trigger').first().evaluate(el=>{
   const s=getComputedStyle(el);return [s.fontSize,s.fontWeight,s.lineHeight,s.letterSpacing]
  })
  expect(styled).toEqual(original)
  await expect(heading.getByRole('button',{name:'새 페이지'})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 })
}
