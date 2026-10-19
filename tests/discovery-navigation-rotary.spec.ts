import {test,expect,type Page} from '@playwright/test'
import {demoRows} from '../src/data/mock'

async function boot(page:Page){
  await page.addInitScript(()=>{
    sessionStorage.setItem('peppercorn-intro-seen','1')
    localStorage.setItem('folio-stock-size','all')
    localStorage.removeItem('folio-catalog-view')
  })
  await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
  await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
  await page.goto('/peppercorn/')
  await expect(page.locator('.shell:not([inert])')).toBeVisible()
}
async function discover(page:Page){
  const nav=page.locator('.mobile-bottom-nav').getByRole('button',{name:'발견',exact:true})
  if(await nav.isVisible())await nav.click()
  else await page.locator('.sidebar nav').getByRole('button',{name:'발견',exact:true}).click()
  await expect(page.locator('.catalog-filter-rails')).toBeVisible()
}
for(const [width,height] of [[390,844],[834,1194],[1440,900]]){
  test(`discovery rotary filters and one-line rows ${width}x${height}`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<1440,reducedMotion:'reduce'})
    const page=await context.newPage();await boot(page);await discover(page)
    const wheels=page.locator('.catalog-wheel')
    await expect(wheels).toHaveCount(4)
    const view=page.getByRole('group',{name:'종목 보기 방식'})
    await expect(view.getByRole('button',{name:'목록형'})).toHaveAttribute('aria-pressed','true')
    const category=page.locator('[data-wheel="분류"]')
    await category.getByRole('button',{name:'전체',exact:true}).click()
    const scope=page.locator('[data-wheel="주도 분류"]')
    await scope.getByRole('button',{name:'전체',exact:true}).click()
    const market=page.locator('[data-wheel="시장"]')
    await market.getByRole('button',{name:'KR',exact:true}).click()
    const list=page.locator('.stock-compact-list')
    await expect(list).toBeVisible()
    await expect(list.locator('.stock-compact-row').first()).toBeVisible()
    await expect(list.locator('.stock-compact-row[data-market="US"]')).toHaveCount(0)
    const first=list.locator('.stock-compact-row').first()
    await expect(first.locator('strong')).not.toBeEmpty()
    await expect(first.locator('.stock-compact-ticker')).not.toBeEmpty()
    await expect(first.locator('.stock-compact-price')).not.toBeEmpty()
    await expect(first.locator('.stock-compact-rs')).not.toBeEmpty()
    await market.getByRole('button',{name:'US',exact:true}).click()
    await expect(list.locator('.stock-compact-row[data-market="KR"]')).toHaveCount(0)
    await view.getByRole('button',{name:'카드형'}).click()
    await expect(page.locator('.stock-card-grid .stock-catalog-card').first()).toBeVisible()
    await view.getByRole('button',{name:'목록형'}).click()
    await expect(list.locator('.stock-compact-row').first()).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    await context.close()
  })
}

test('stock detail back and browser history return to exactly the prior screen',async({page})=>{
  await boot(page)
  await page.locator('.sidebar nav').getByRole('button',{name:'저널',exact:true}).click()
  await expect(page.locator('.page-notebook')).toBeVisible()
  await discover(page)
  await page.locator('[data-wheel="분류"]').getByRole('button',{name:'전체',exact:true}).click()
  await page.locator('[data-wheel="주도 분류"]').getByRole('button',{name:'전체',exact:true}).click()
  await page.locator('.stock-compact-main').first().click()
  await expect(page.locator('.obra-masthead')).toBeVisible()
  await expect(page.locator('.obra-masthead .folio-wordmark-system')).toHaveCount(0)
  await page.getByRole('button',{name:'뒤로 가기'}).click()
  await expect(page.locator('.stock-compact-list')).toBeVisible()
  await page.evaluate(()=>window.history.back())
  await expect(page.locator('.page-notebook')).toBeVisible()
  await page.evaluate(()=>window.history.back())
  await expect(page.locator('.page-today')).toBeVisible()
})

test('edge swipe moves to the previous page without hijacking carousel controls',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'})
  const page=await context.newPage();await boot(page);await discover(page)
  await page.evaluate(()=>{
    const el=document.querySelector('.content')!
    const begin=new Touch({identifier:1,target:el,clientX:10,clientY:310})
    const end=new Touch({identifier:1,target:el,clientX:160,clientY:315})
    el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[begin],changedTouches:[begin]}))
    el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[end]}))
  })
  await expect(page.locator('.page-today')).toBeVisible()
  await context.close()
})
