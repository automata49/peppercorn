import {test,expect,type Page} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {openPage,openFilters,closeFilters} from './journey-helpers'
async function boot(page:Page){
 await page.addInitScript(()=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-stock-size','all')})
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.goto('/peppercorn/')
}
for(const width of [390,834,1440])test(`basket ${width}: add, deduplicate, reload, open detail, remove and header search`,async({page})=>{
 await page.setViewportSize({width,height:1000});await boot(page)
 const header=page.locator(width>=1280?'.desktop-navigation':'.mobile-brandbar')
 await expect(header.getByRole('button',{name:'종목 검색',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'홈',exact:true})).toHaveCount(0)
 await header.getByRole('button',{name:'장바구니 0종목'}).click();await expect(page.getByRole('dialog')).toContainText('담아보세요');await page.keyboard.press('Escape')
 await openPage(page,'발견');await openFilters(page);const active=page.locator('.analysis-scope button[aria-pressed=true]');if(await active.count())await active.click();await closeFilters(page)
 const card=page.locator('.stock-catalog-card').first(),ticker=await card.locator('.stock-trend-ticker').textContent()
 await card.locator('.stock-basket-add').click();await expect(page.locator('.analysis-finder')).toBeVisible();await card.locator('.stock-basket-add').click();await expect(header.getByRole('button',{name:'장바구니 1종목'})).toBeVisible()
 await card.locator('.stock-trend-row').click();await expect(page.getByRole('button',{name:'장바구니 담김',exact:true})).toHaveAttribute('aria-pressed','true')
 await page.reload();await header.getByRole('button',{name:'장바구니 1종목'}).click();await expect(page.locator('.stock-basket-list>li')).toHaveCount(1)
 await page.locator('.stock-basket-list>li>button').first().click();await expect(page.locator('.analysis-body')).toBeVisible()
 await header.getByRole('button',{name:'장바구니 1종목'}).click();await page.getByRole('button',{name:`${ticker} 장바구니에서 삭제`}).click();await expect(page.getByRole('dialog')).toContainText('담아보세요');await page.keyboard.press('Escape')
 await expect(page.getByRole('button',{name:'장바구니 담기',exact:true})).toBeVisible();await page.getByRole('button',{name:'장바구니 담기',exact:true}).click();await expect(header.getByRole('button',{name:'장바구니 1종목'})).toBeVisible()
 await header.getByRole('button',{name:'종목 검색',exact:true}).click();const search=page.getByRole('dialog');await search.getByRole('combobox').fill('AAPL');await search.getByRole('combobox').press('Enter');await expect(page.locator('.analysis-body .hero-name')).toHaveText('Apple')
 for(const label of ['오늘','발견','저널','여정','Settings']){await openPage(page,label);await expect(header.getByRole('button',{name:'종목 검색',exact:true})).toBeVisible();await expect(header.getByRole('button',{name:'장바구니 1종목'})).toBeVisible()}
})
test('shared page headings and rotation keep dimensions and filter state',async({page})=>{
 await page.setViewportSize({width:834,height:1194});await boot(page)
 const measures=[]
 for(const label of ['발견','저널','여정']){await openPage(page,label);const heading=page.locator('.section-heading');measures.push(await heading.evaluate(el=>{const img=el.querySelector('img')!,title=el.querySelector('h2')!;return {imageWidth:img.getBoundingClientRect().width,imageHeight:img.getBoundingClientRect().height,fontSize:getComputedStyle(title).fontSize}}))}
 expect(measures[1]).toEqual(measures[0]);expect(measures[2]).toEqual(measures[0])
 await openPage(page,'발견');await openFilters(page);await page.getByRole('button',{name:'종목명 순',exact:true}).click();await page.setViewportSize({width:1194,height:834});await expect(page.locator('.catalog-filter-sidebar')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'종목명 순',exact:true})).toHaveAttribute('aria-pressed','true')
 await page.setViewportSize({width:834,height:1194});await expect(page.locator('.catalog-filter-drawer')).toHaveCount(0);await openFilters(page);await expect(page.getByRole('button',{name:'종목명 순',exact:true})).toHaveAttribute('aria-pressed','true')
})
test('basket retains unavailable instruments without presenting saved prices as current',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('folio-stock-basket',JSON.stringify([{market:'US',ticker:'OLD',name:'이전 종목',price:123}])))
 await page.setViewportSize({width:390,height:844});await boot(page)
 await page.locator('.mobile-brandbar').getByRole('button',{name:'장바구니 1종목'}).click()
 const item=page.locator('.stock-basket-list>li');await expect(item).toContainText('현재 데이터 없음');await expect(item.locator('button').first()).toBeDisabled();await expect(item).not.toContainText('123')
 await item.getByRole('button',{name:'OLD 장바구니에서 삭제'}).click();await expect(page.getByRole('dialog')).toContainText('담아보세요')
})
