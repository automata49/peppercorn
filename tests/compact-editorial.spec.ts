import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'

const views=[
  {name:'phone',width:390,height:844},
  {name:'ipad',width:834,height:1194},
  {name:'ipad-pro',width:1366,height:1024}
]

for(const view of views){
  test(view.name+' uses Sunset Editorial B on the compact Dashboard',async({browser})=>{
    const context=await browser.newContext({
      viewport:{width:view.width,height:view.height},
      hasTouch:true,
      isMobile:true,
      colorScheme:'light'
    })
    const page=await context.newPage()
    await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
    await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
    await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
    await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
    await page.route('**/functions/v1/price-history?*',r=>{
      const ids=new URL(r.request().url()).searchParams.get('ids')?.split(',')||[]
      return r.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,[
        ['2026-09-28',100],['2026-09-29',104],['2026-09-30',102],['2026-10-01',108]
      ]]))}})
    })
    await page.goto('/peppercorn/')

    const brand=page.locator('.page-shell-dashboard .mobile-brandbar')
    await expect(brand).toBeVisible()
    expect(await brand.evaluate(e=>getComputedStyle(e).backdropFilter)).toBe('none')
    expect(parseFloat(await brand.evaluate(e=>getComputedStyle(e).borderBottomWidth))).toBeGreaterThan(0)

    const bodyColor=await page.locator('body').evaluate(e=>getComputedStyle(e).color)
    const line=page.locator('.spotlight-line')
    await expect(line).toBeVisible()
    expect(await line.evaluate(e=>getComputedStyle(e).stroke)).toBe('rgb(247, 244, 241)')
    expect(parseFloat(await page.locator('.spotlight-area').evaluate(e=>getComputedStyle(e).opacity))).toBeLessThanOrEqual(.05)

    const period=page.locator('.spotlight-periods button.on')
    expect(parseFloat(await period.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)
    expect(await period.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')

    const evidence=page.locator('.spotlight-evidence')
    expect(parseFloat(await evidence.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)

    const sector=page.locator('.mobile-sector-list .decision-row').first()
    await expect(sector).toBeVisible()
    expect(parseFloat(await sector.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)
    expect(await sector.evaluate(e=>getComputedStyle(e).boxShadow)).toBe('none')

    const bottomActive=page.locator('.mobile-bottom-nav button.active')
    await expect(bottomActive).toBeVisible()
    expect(await bottomActive.evaluate(e=>getComputedStyle(e).color)).toBe(bodyColor)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    await context.close()
  })
}
