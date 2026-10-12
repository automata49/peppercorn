import {test,expect,type Page} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {openPage,pickFirstStock} from './journey-helpers'
async function boot(page:Page,theme:string){
 await page.clock.setFixedTime(new Date('2026-10-13T00:00:00Z'))
 await page.addInitScript(theme=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-theme',theme);localStorage.setItem('folio-stock-size','all')},theme)
 await page.route('**/data/stock-flags.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.goto('/peppercorn/');await expect(page.locator('.source.supabase')).toHaveCount(1)
}
for(const width of [390,834,1366,1440])for(const theme of ['light','dark'])test(`reference ${width} ${theme}: composition and connected tabs`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});const page=await context.newPage();await boot(page,theme)
 const menu=await page.locator('.obra-masthead').getByRole('button',{name:'전체 메뉴 열기'}).boundingBox();expect(menu!.width).toBeGreaterThanOrEqual(44);expect(menu!.height).toBeGreaterThanOrEqual(44)
 const cards=page.locator('.home-motion-card');await expect(cards).toHaveCount(4)
 const first=await cards.nth(0).boundingBox(),second=await cards.nth(1).boundingBox();expect(first!.x).toBeLessThan(second!.x);expect(first!.height).toBeGreaterThan(second!.height)
 await expect(page.locator('.home-heading p')).toBeVisible()
 await openPage(page,'발견');await pickFirstStock(page)
 const overview=page.getByRole('tab',{name:'Overview',exact:true});await overview.focus();await overview.press('ArrowRight')
 await expect(page.getByRole('tab',{name:'Analysis',exact:true})).toBeFocused();await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby','detail-tab-analysis');await expect(page.getByRole('heading',{name:'Leadership Check'})).toBeVisible()
 await page.getByRole('tab',{name:'Financials',exact:true}).click();await expect(page.getByRole('heading',{name:'Financial Snapshot · 공시 펀더멘털'})).toBeVisible()
 await page.getByRole('tab',{name:'Thesis',exact:true}).click();await expect(page.locator('.analysis-judgement')).toBeVisible()
 await page.getByRole('tab',{name:'Thesis',exact:true}).press('Home');await expect(overview).toBeFocused();await expect(page.locator('.obra-overview')).toBeVisible()
 await expect(page.locator('.price-rs')).toBeVisible()
 await overview.evaluate(el=>(el as HTMLElement).blur())
 await expect(page.locator('.obra-detail')).toHaveScreenshot(`detail-${theme}-${width}.png`,{animations:'disabled',maxDiffPixelRatio:.012})
 await page.getByRole('button',{name:'Thesis에서 내 판단 작성'}).click();await expect(page.locator('.analysis-judgement')).toBeVisible();await expect(page.locator('.analysis-sheet')).toBeVisible()
 await context.close()
})
