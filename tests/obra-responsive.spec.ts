import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {openPage,pickFirstStock} from './journey-helpers'
for(const width of [390,834,1366,1440,1660])for(const theme of ['light','dark'])test(`responsive ${width} ${theme}: full width, theme header and existing destinations`,async({browser})=>{
 const touch=width===1660||width<1280
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:touch,reducedMotion:'reduce'}),page=await context.newPage()
 await page.addInitScript(theme=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-theme',theme);localStorage.setItem('folio-stock-size','all')},theme)
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.goto('/peppercorn/');await expect(page.locator('.home-motion-card')).toHaveCount(4)
 const home=await page.locator('.lifestyle-home').boundingBox();expect(home!.width).toBeGreaterThanOrEqual(Math.min(width,1280)-1)
 if(width>=1280){const bar=page.locator('.desktop-navigation');await expect(bar).toBeVisible();const box=await bar.boundingBox();expect(box!.width).toBe(width);expect(box!.height).toBe(76);expect(await bar.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(theme==='light'?'rgb(255, 255, 255)':'rgb(10, 10, 12)')}
 else{await expect(page.locator('.desktop-navigation')).toBeHidden();await expect(page.locator('.mobile-bottom-nav b')).toHaveText(['오늘','발견','저널','여정'])}
 await openPage(page,'발견');await pickFirstStock(page);const detail=await page.locator('.obra-detail').boundingBox();expect(detail!.width).toBeGreaterThanOrEqual(Math.min(width,1280)-1)
 for(const label of ['Analysis','Financials','Thesis','Overview']){await page.getByRole('tab',{name:label,exact:true}).click();await expect(page.getByRole('tabpanel')).toBeVisible()}
 await openPage(page,'저널');await expect(page.locator('.page-notebook')).toBeVisible();await openPage(page,'여정');await expect(page.locator('.page-tracking')).toBeVisible()
 await openPage(page,'Settings');if(width>=1280){expect(await page.locator('.topbar').evaluate(e=>getComputedStyle(e).position)).toBe('static');await page.evaluate(()=>window.scrollTo(0,600));expect((await page.locator('.desktop-navigation').boundingBox())!.y).toBe(0)}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.close()
})
