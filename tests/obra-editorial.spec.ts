import { test, expect, type Page } from '@playwright/test'
import { demoRows } from '../src/data/mock'
import { openPage, pickFirstStock } from './journey-helpers'

async function boot(page: Page, style: string, theme: string) {
  await page.addInitScript(({style,theme}) => {
    sessionStorage.setItem('peppercorn-intro-seen','1')
    if(!localStorage.getItem('folio-editorial-style'))localStorage.setItem('folio-editorial-style',style)
    localStorage.setItem('folio-theme',theme)
    localStorage.setItem('folio-stock-size','all')
  }, {style,theme})
  await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
  await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
  await page.goto('/peppercorn/')
}
for (const width of [390,834,1366,1440]) for (const style of ['modern','classic','art']) for (const theme of ['light','dark']) {
  test(`${width} ${style} ${theme}: editorial roles and detail controls remain readable`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'})
    const page=await context.newPage();await boot(page,style,theme)
    await expect(page.locator('html')).toHaveAttribute('data-editorial',style)
    const title=await page.locator('.home-heading h2').evaluate(el=>({font:getComputedStyle(el).fontFamily,weight:getComputedStyle(el).fontWeight}))
    if(style==='classic')expect(title.font).toContain('Serif')
    if(style==='art')expect(Number(title.weight)).toBeGreaterThanOrEqual(700)
    await expect(page.locator('.home-motion-card')).toHaveCount(4)
    await openPage(page,'발견');await pickFirstStock(page)
    expect(await page.locator('.hero-name').evaluate(el=>getComputedStyle(el).fontFamily)).toBe(title.font)
    const priceFont=await page.locator('.hero-price').evaluate(el=>getComputedStyle(el).fontFamily)
    if(style==='classic')expect(priceFont).not.toBe(title.font)
    for(const button of await page.locator('.analysis-actionbar button').all()) {
      const geometry=await button.boundingBox();expect(geometry!.height).toBeGreaterThanOrEqual(44)
      const visual=await button.evaluate(el=>{const s=getComputedStyle(el);return {foreground:s.color,background:s.backgroundColor,radius:s.borderRadius,weight:s.fontWeight}})
      expect(visual.foreground).not.toBe(visual.background)
      expect(visual.radius).toBe('0px');expect(visual.weight).toBe('500')
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)
    expect(overflow).toBe(false)
    await context.close()
  })
}
test('Settings changes editorial style across destinations and persists on reload',async({page})=>{
  await boot(page,'modern','light');await openPage(page,'Settings')
  await page.getByLabel('제목 스타일').selectOption('classic')
  await expect(page.locator('html')).toHaveAttribute('data-editorial','classic')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-editorial','classic')
  expect(await page.evaluate(()=>localStorage.getItem('folio-editorial-style'))).toBe('classic')
  await openPage(page,'오늘')
  expect(await page.locator('.home-heading h2').evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Serif')
})
test('invalid stored typography falls back to a readable default',async({page})=>{
  await boot(page,'missing-font','light')
  await expect(page.locator('html')).toHaveAttribute('data-editorial','modern')
})
test('classic Korean type uses the bundled font even without an installed serif',async({page})=>{
  await boot(page,'classic','light')
  const fonts=await page.evaluate(async()=>{
    const faces=await document.fonts.load('20px "Folio Editorial Serif"','성장과 지속성을 묻다')
    return faces.map(face=>({family:face.family,status:face.status}))
  })
  expect(fonts).toHaveLength(1)
  expect(fonts[0].status).toBe('loaded')
  const response=await page.request.get('/peppercorn/fonts/folio-editorial-serif.woff2')
  expect(response.ok()).toBe(true)
  expect((await response.body()).subarray(0,4).toString()).toBe('wOF2')
})
