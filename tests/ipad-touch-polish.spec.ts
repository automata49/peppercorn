import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

const views=[
  {name:'ipad-portrait',width:834,height:1194,menu:'.topbar-menu'},
  {name:'ipad-landscape',width:1194,height:834,menu:'.topbar-menu'},
  {name:'ipad-pro',width:1366,height:1024,menu:'.mobile-brand-menu'}
]

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

async function boxAtLeast(locator:any,width:number,height:number){
  await expect(locator).toBeVisible()
  const box=await locator.boundingBox()
  expect(box).not.toBeNull()
  // Chromium can report a CSS 44px edge as 43.9999px on scaled touch viewports.
  expect(box!.width).toBeGreaterThanOrEqual(width-.1)
  expect(box!.height).toBeGreaterThanOrEqual(height-.1)
}

for(const view of views){
  test(view.name+' keeps touch navigation and forms comfortably tappable',async({browser})=>{
    const context=await browser.newContext({
      viewport:{width:view.width,height:view.height},
      hasTouch:true,
      isMobile:true
    })
    const page=await context.newPage()
    await boot(page)

    await boxAtLeast(page.locator(view.menu),44,44)
    const nav=page.locator('.mobile-bottom-nav')
    await boxAtLeast(nav.getByRole('button',{name:'홈'}),44,52)
    expect(parseFloat(await nav.locator('b').first().evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(11)

    await page.locator(view.menu).click()
    const drawer=page.locator('.menu-drawer')
    await expect(drawer).toBeVisible()
    await boxAtLeast(drawer.locator('.menu-drawer-close'),44,44)
    await boxAtLeast(drawer.getByRole('button',{name:'Watchlist'}),180,52)
    await drawer.getByRole('button',{name:'Watchlist'}).click()

    const tickerInput=page.locator('.ticker-entry input').first()
    await boxAtLeast(tickerInput,180,44)
    expect(parseFloat(await tickerInput.evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16)

    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBeTruthy()
    await context.close()
  })
}
