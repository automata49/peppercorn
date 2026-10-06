import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'

const VISUAL_IDENTITY_VIEWPORTS=[
  {name:'phone-390',width:390,height:844,touch:true,compact:true},
  {name:'ipad-834',width:834,height:1194,touch:true,compact:true},
  {name:'ipad-pro-1366',width:1366,height:1024,touch:true,compact:true},
  {name:'desktop-1440',width:1440,height:900,touch:false,compact:false},
] as const

async function boot(page:any){
  await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.route('**/functions/v1/price-history?*',route=>{
    const ids=new URL(route.request().url()).searchParams.get('ids')?.split(',')||[]
    return route.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,[
      ['2026-09-28',100],['2026-09-29',104],['2026-09-30',102],['2026-10-01',108]
    ]]))}})
  })
  await page.goto('http://127.0.0.1:4173/peppercorn/')
}

for(const view of VISUAL_IDENTITY_VIEWPORTS){
  test(view.name+' locks the Sunset Editorial B visual signature',async({browser})=>{
    const context=await browser.newContext({
      viewport:{width:view.width,height:view.height},
      hasTouch:view.touch,
      isMobile:view.touch,
      colorScheme:'light',
      reducedMotion:'reduce',
    })
    const page=await context.newPage()
    await boot(page)

    const rootVars=await page.evaluate(()=>{
      const s=getComputedStyle(document.documentElement)
      return {
        paper:s.getPropertyValue('--folio-paper').trim(),
        ink:s.getPropertyValue('--folio-ink').trim(),
        black:s.getPropertyValue('--folio-black').trim(),
        sand:s.getPropertyValue('--folio-warm-sand').trim(),
      }
    })
    expect(rootVars).toEqual({
      paper:'#f4f1ec',
      ink:'#111113',
      black:'#0b0b0d',
      sand:'#e8ded4',
    })

    const compactBrand=page.locator('.mobile-brandbar .folio-wordmark-system')
    const desktopBrand=page.locator('.sidebar .folio-wordmark-system')
    const topbar=page.locator('.page-dashboard .topbar')

    if(view.compact){
      await expect(compactBrand).toBeVisible()
      await expect(topbar).toBeHidden()
      const box=await page.locator('.mobile-brandbar').boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(67.5)
      expect(box!.height).toBeLessThanOrEqual(68.5)
      await expect(compactBrand.locator('.folio-wordmark-text')).toHaveText('Folio')
      await expect(compactBrand.locator('.folio-xx-vector')).toBeVisible()
    }else{
      await expect(desktopBrand).toBeVisible()
      await expect(topbar).toBeVisible()
      await expect(desktopBrand.locator('.folio-wordmark-text')).toHaveText('Folio')
      await expect(desktopBrand.locator('.folio-xx-vector')).toBeVisible()
    }

    await expect(page.locator('.folio-motif-panel img')).toHaveAttribute('src','./folio-b-motif.svg')
    if(!view.compact)await expect(page.locator('.folio-photo-panel img')).toHaveAttribute('src','./folio-c-photography.webp')

    const leader=page.locator('.leadership-overview')
    await expect(leader).toBeVisible()
    expect(await leader.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(11, 11, 13)')
    const line=page.locator('.spotlight-line')
    await expect(line).toBeVisible()
    expect(await line.evaluate(e=>getComputedStyle(e).stroke)).toBe('rgb(247, 244, 241)')
    expect(parseFloat(await page.locator('.spotlight-area').evaluate(e=>getComputedStyle(e).opacity))).toBeLessThanOrEqual(.05)

    const period=page.locator('.spotlight-periods button.on')
    expect(parseFloat(await period.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)
    expect(await period.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')

    if(view.compact){
      await page.locator('.mobile-bottom-nav').getByRole('button',{name:'분석'}).click()
    }else{
      await page.locator('.sidebar nav').getByRole('button',{name:'종목 분석'}).click()
    }
    const analysis=page.locator('.analysis-page')
    await expect(analysis).toBeVisible()
    expect(await analysis.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(11, 11, 13)')
    await expect(analysis.locator('.analysis-detail-tabs').getByRole('tab')).toHaveText(['Overview','Analysis','Financials','Thesis'])
    await expect(analysis.locator('.folio-insight')).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true)
    await context.close()
  })
}

test('launch is Folio-only and keeps the exact B hero',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  const launch=page.locator('.launch-overlay')
  await expect(launch.getByRole('img',{name:'Folio xx visual'})).toHaveAttribute('src','./folio-b-launch-hero.webp')
  await expect(launch).not.toContainText('SUNSET EDITORIAL')
  await expect(launch.locator('.launch-footer .folio-wordmark-system')).toBeVisible()
  await expect(launch).not.toContainText('Peppercorn Capital')
})
