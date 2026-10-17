import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {openPage} from './journey-helpers'

for(const theme of ['light','dark'])for(const view of [{width:390,height:844},{width:834,height:1194},{width:1194,height:834},{width:1366,height:1024},{width:1440,height:900}]){
 test(`viewport navigation and lone laser card ${view.width} ${theme}`,async({browser})=>{
  const context=await browser.newContext({viewport:view,hasTouch:view.width!==1440})
  const page=await context.newPage()
  await page.addInitScript(theme=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-theme',theme);localStorage.setItem('folio-stock-size','all')},theme)
  const row={...demoRows.find(r=>r.market==='US')!,leadership_class:'핵심 주도',rs_rank:99}
  await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:[row]}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
  await page.route('**/functions/v1/price-history?*',r=>{
   const ids=new URL(r.request().url()).searchParams.get('ids')!.split(',')
   const series=Array.from({length:21},(_,i)=>[new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10),100+i+i%3])
   return r.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,series]))}})
  })
  await page.goto('/peppercorn/');await openPage(page,'발견')
  const card=page.locator('.stock-catalog-card')
  await expect(card).toHaveCount(1)
  await expect(card.locator('.trend-laser-beam')).toBeVisible()
  expect((await card.boundingBox())!.width).toBeLessThanOrEqual(360)
  const paths=await card.locator('.stock-mini-trend path').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('d')))
  expect(new Set(paths).size).toBe(1)
  await expect.poll(()=>page.locator('.shell').evaluate(el=>getComputedStyle(el).transform)).toBe('none')
  const nav=page.locator('.mobile-bottom-nav')
  if(await nav.isVisible()){
   // Stress fixed positioning on a tall document, independently of result count.
   await page.locator('.content').evaluate(el=>(el as HTMLElement).style.minHeight='2500px')
   for(const scroll of [0,400,1200]){
    await page.evaluate(y=>window.scrollTo(0,y),scroll)
    await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(scroll)
    await expect.poll(async()=>{const b=(await nav.boundingBox())!;return Math.abs(b.y+b.height-view.height)}).toBeLessThan(2)
   }
  }
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({path:`test-results/laser-card-${view.width}-${theme}.png`})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await context.close()
 })
}
