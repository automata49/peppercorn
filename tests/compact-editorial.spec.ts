import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'

const views=[
  {name:'phone',width:390,height:844},
  {name:'ipad',width:834,height:1194},
  {name:'ipad-pro',width:1366,height:1024}
]

for(const view of views){
  test(view.name+' uses bright Sunset Editorial + functional glass',async({browser})=>{
    const context=await browser.newContext({
      viewport:{width:view.width,height:view.height},
      hasTouch:true,
      isMobile:view.width<900,
      colorScheme:'light'
    })
    const page=await context.newPage()
    await page.addInitScript(()=>{
      sessionStorage.setItem('peppercorn-intro-seen','1')
      localStorage.setItem('folio-theme','light')
    })
    await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
    await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
    await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
    await page.goto('/peppercorn/')

    const brand=page.locator('.page-shell-dashboard .mobile-brandbar')
    await expect(brand).toBeVisible()
    expect((await brand.evaluate(e=>getComputedStyle(e).backdropFilter)).includes('blur')).toBe(true)
    expect(parseFloat(await brand.evaluate(e=>getComputedStyle(e).borderBottomWidth))).toBeGreaterThan(0)

    await expect(page.locator('.home-regime')).toBeVisible()
    await expect(page.locator('.home-class-grid button')).toHaveCount(4)
    await expect(page.locator('.home-today-list')).toBeVisible()
    await expect(page.locator('.home-insight')).toContainText('STRUCTURED')
    await expect(page.locator('.spotlight-chart')).toHaveCount(0)
    await expect(page.locator('.dashboard-sector-panel')).toHaveCount(0)

    await expect(page.locator('.mobile-bottom-nav b')).toHaveText(['홈','신호','리더십','Stock'])
    const bottom=page.locator('.mobile-bottom-nav')
    expect((await bottom.evaluate(e=>getComputedStyle(e).backdropFilter)).includes('blur')).toBe(true)

    await page.locator('.mobile-bottom-nav').getByRole('button',{name:'신호'}).click()
    await expect(page.locator('.market-signal-page')).toBeVisible()
    await expect(page.locator('.market-signal-metrics > div')).toHaveCount(4)
    await expect(page.locator('.mobile-sector-list')).toBeVisible()

    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    await context.close()
  })
}
