import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'

const VISUAL_IDENTITY_VIEWPORTS=[
  {name:'phone-390',width:390,height:844,touch:true,compact:true},
  {name:'ipad-834',width:834,height:1194,touch:true,compact:true},
  {name:'ipad-pro-1366',width:1366,height:1024,touch:true,compact:true},
  {name:'desktop-1440',width:1440,height:900,touch:false,compact:false},
] as const

async function boot(page:any){
  await page.addInitScript(()=>{
    sessionStorage.setItem('peppercorn-intro-seen','1')
    localStorage.setItem('folio-theme','light')
  })
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
}

for(const view of VISUAL_IDENTITY_VIEWPORTS){
  test(view.name+' locks the bright Sunset Editorial decision signature',async({browser})=>{
    const context=await browser.newContext({
      viewport:{width:view.width,height:view.height},
      hasTouch:view.touch,
      isMobile:view.width<900,
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
        glass:s.getPropertyValue('--folio-ds-glass-bg').trim(),
      }
    })
    expect(rootVars).toEqual({
      paper:'#faf8f5',
      ink:'#111113',
      black:'#0b0b0d',
      glass:'rgba(255,255,255,.68)',
    })

    const compactBrand=page.locator('.mobile-brandbar .folio-wordmark-system')
    const desktopBrand=page.locator('.sidebar .folio-wordmark-system')
    const topbar=page.locator('.page-dashboard .topbar')

    if(view.compact){
      await expect(compactBrand).toBeVisible()
      await expect(topbar).toBeHidden()
      const box=await page.locator('.mobile-brandbar').boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(59.5)
      expect(box!.height).toBeLessThanOrEqual(60.5)
      expect((await page.locator('.mobile-brandbar').evaluate(e=>getComputedStyle(e).backdropFilter)).includes('blur')).toBe(true)
      await expect(compactBrand.locator('.folio-wordmark-text')).toHaveText('Folio')
      await expect(compactBrand.locator('.folio-xx-vector')).toBeVisible()
    }else{
      await expect(desktopBrand).toBeVisible()
      await expect(topbar).toBeVisible()
      await expect(desktopBrand.locator('.folio-wordmark-text')).toHaveText('Folio')
      await expect(desktopBrand.locator('.folio-xx-vector')).toBeVisible()
    }

    await expect(page.locator('.home-regime')).toBeVisible()
    await expect(page.locator('.home-class-grid button')).toHaveCount(4)
    await expect(page.locator('.home-today-list')).toBeVisible()
    await expect(page.locator('.home-insight')).toContainText('AI INSIGHT')
    await expect(page.locator('.spotlight-chart')).toHaveCount(0)
    await expect(page.locator('.folio-motif-panel')).toHaveCount(0)
    await expect(page.locator('.folio-photo-panel')).toHaveCount(0)

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
  await expect(launch.getByRole('img',{name:'Folio xx visual'})).toHaveAttribute('src','./folio-b-launch-hero.webp?v=b5')
  await expect(launch).not.toContainText('SUNSET EDITORIAL')
  await expect(launch.locator('.launch-footer .folio-wordmark-system')).toBeVisible()
  await expect(launch).not.toContainText('Peppercorn Capital')
})
