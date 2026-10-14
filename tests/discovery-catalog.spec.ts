import {test,expect,type Page} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {openPage,pickFirstStock,backToExplore} from './journey-helpers'
async function boot(page:Page){
 await page.addInitScript(()=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-stock-size','all');localStorage.setItem('peppercorn-recent-stocks-v1',JSON.stringify([{market:'US',ticker:'NVDA',name:'NVIDIA Corporation'},{market:'US',ticker:'MSFT',name:'Microsoft Corporation'}]))})
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.goto('/peppercorn/')
}
for(const [width,height] of [[390,844],[844,390],[834,1194],[1194,834],[1366,1024],[1440,900]])test(`catalog ${width}x${height}: immediate cards, category/filter geometry, menu and quote readability`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height},hasTouch:width<1280,reducedMotion:'reduce'}),page=await context.newPage();await boot(page)
 await openPage(page,'발견');const toggle=page.getByRole('button',{name:'Filter & Sort'});await expect(page.locator('.catalog-filter-drawer')).toHaveCount(0);await toggle.click();const active=page.locator('.analysis-scope button[aria-pressed="true"]');if(await active.count())await active.click();await page.getByRole('button',{name:'필터 닫기'}).click()
 const card=page.locator('.analysis-idea-list>button').first(),grid=page.locator('.stock-card-grid');await expect(card).toBeVisible()
 const cardBox=(await card.boundingBox())!,gridBox=(await grid.boundingBox())!
 expect(cardBox.y).toBeLessThan(height<500?height-70:Math.min(height-80,620))
 expect(await grid.evaluate(el=>getComputedStyle(el).display)).toBe('grid');expect(await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(width<=580?2:3)
 expect(await card.evaluate(el=>getComputedStyle(el).borderWidth)).toBe('0px')
 expect(await card.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
 await toggle.click();const drawer=page.locator('.catalog-filter-drawer');await expect(drawer).toBeVisible();expect((await drawer.boundingBox())!.x).toBe(0)
 for(const option of await drawer.locator('button[aria-pressed]').all()){expect(await option.evaluate(el=>getComputedStyle(el).borderWidth)).toBe('0px');expect(await option.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');expect(await option.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18)}
 await page.screenshot({path:`test-results/catalog-drawer-${width}-${height}.png`});await drawer.getByRole('button',{name:'종목명 순',exact:true}).click();await drawer.getByRole('button',{name:/종목 보기/}).click();await expect(page.locator('.catalog-result-count')).toContainText('종목명 순')
 await toggle.click();await expect(drawer.getByRole('button',{name:'종목명 순',exact:true})).toHaveAttribute('aria-pressed','true');await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0);await expect(toggle).toBeFocused()
 if(width>=1280){const brand=(await page.locator('.desktop-navigation .folio-brand').boundingBox())!,nav=(await page.locator('.desktop-navigation nav').boundingBox())!;expect(nav.x-brand.x-brand.width).toBeGreaterThan(40)}
 else{await expect(page.locator('.topbar-menu')).toBeHidden();await expect(page.locator('.mobile-bottom-nav>button')).toHaveCount(5)}
 await pickFirstStock(page);expect(await page.locator('.hero-price').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(28);expect(await page.locator('.hero-change').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(16)
 await backToExplore(page);await expect(card).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:`test-results/catalog-${width}-${height}.png`});await context.close()
})
test('Film/Vivid changes photos and typography across pages and survives reload',async({page})=>{
 await boot(page);await openPage(page,'Settings');await page.getByRole('button',{name:'Vivid · 아트 저널',exact:false}).click();await expect(page.locator('html')).toHaveAttribute('data-photo-style','vivid');await expect(page.locator('html')).toHaveAttribute('data-editorial','art');await openPage(page,'오늘');await expect(page.locator('.home-discover>img')).toHaveAttribute('src',/folio-vivid-discover/)
 await openPage(page,'발견');await expect(page.locator('.discovery-heading>img')).toHaveAttribute('src',/folio-vivid-discover/);const filter=await page.locator('.discovery-heading>img').evaluate(el=>getComputedStyle(el).filter);await openPage(page,'오늘');expect(await page.locator('.home-today>img').evaluate(el=>getComputedStyle(el).filter)).toBe(filter)
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-photo-style','vivid');await expect(page.locator('html')).toHaveAttribute('data-editorial','art');await openPage(page,'Settings');await page.getByRole('button',{name:'Film · 모던 매거진',exact:false}).click();await expect(page.locator('html')).toHaveAttribute('data-photo-style','film');await expect(page.locator('html')).toHaveAttribute('data-editorial','modern')
})
