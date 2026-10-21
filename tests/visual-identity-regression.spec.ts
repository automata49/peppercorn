import {openFilters,closeFilters} from './journey-helpers'
import {openPage} from './journey-helpers'
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
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약')
}

for(const view of VISUAL_IDENTITY_VIEWPORTS){
  test(view.name+' locks the Sunset Editorial + Pebble Liquid Glass visual signature',async({browser})=>{
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
        surface:s.getPropertyValue('--folio-surface').trim(),
      }
    })
    expect(rootVars).toEqual({
      paper:'#fff',
      ink:'#111113',
      black:'#0b0b0d',
      sand:'#ededed',
      surface:'#f5f5f5',
    })

    const compactBrand=page.locator('.mobile-brandbar .folio-wordmark-system')
    const desktopBrand=page.locator('.sidebar .folio-wordmark-system')
    const topbar=page.locator('.page-dashboard .topbar')

    await expect(compactBrand).toHaveCount(0)
    await expect(desktopBrand).toHaveCount(0)
    if(view.compact){
      await expect(topbar).toBeHidden()
      const box=await page.locator('.mobile-brandbar').boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(59.5)
      expect(box!.height).toBeLessThanOrEqual(60.5)
    }else await expect(topbar).toBeVisible()
    await openPage(page,'오늘')
    const homeBrand=view.compact?compactBrand:desktopBrand
    await expect(homeBrand.locator('.folio-wordmark-image-light')).toBeVisible()
    await openPage(page,'시장 요약')

    await expect(page.locator('.folio-motif-panel img')).toHaveAttribute('src','./folio-brand-typography.webp?v=u2')
    if(!view.compact)await expect(page.locator('.folio-photo-panel img')).toHaveAttribute('src','./folio-brand-photography.webp?v=u2')

    await expect(page.locator('.journey-today')).toBeVisible()
    await expect(page.locator('.leader-spotlight')).toHaveCount(0)
    const category=page.getByRole('group',{name:'분류'})
    await expect(category.getByRole('button')).toHaveText(['대형주','중소형주','전체','ETF'])
    await expect(category.locator('.stock-size-equities button')).toHaveCount(3)
    await expect(category.locator('.stock-size-divider')).toHaveText('/')
    await expect(category.locator(':scope > .stock-size-etf')).toHaveText('ETF')
    const pebble=category.getByRole('button',{name:'대형주',exact:true})
    // Prefix order preserves both declarations after CSS minification.
    await expect(pebble).toHaveCSS('backdrop-filter','blur(18px) saturate(1.22)')
    expect(await pebble.evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('linear-gradient')
    expect(await pebble.evaluate(e=>getComputedStyle(e).boxShadow)).toContain('inset')
    expect(await pebble.evaluate(e=>getComputedStyle(e,'::before').backgroundImage)).toContain('linear-gradient')
    expect(parseFloat(await pebble.evaluate(e=>getComputedStyle(e).borderRadius))).toBeGreaterThan(20)
    await expect(page.locator('.journey-classes button span')).toHaveText(['핵심 주도','주도 후보','강세 전환','조정 중'])
    const todayBox=await page.locator('.journey-today').boundingBox()
    const classesBox=await page.locator('.journey-classes').boundingBox()
    expect(todayBox).not.toBeNull();expect(classesBox).not.toBeNull()
    expect(todayBox!.y).toBeLessThan(classesBox!.y)

    if(view.compact){
      await page.locator('.mobile-bottom-nav').getByRole('button',{name:'발견',exact:true}).click()
    }else{
      await page.locator('.sidebar nav').getByRole('button',{name:'발견',exact:true}).click()
    }
    await openFilters(page)
    const scope=page.locator('.analysis-scope')
    // Active leadership selection is now idempotent. Choose the explicit 전체
    // category when the visual baseline needs the complete fixture list.
    await scope.getByRole('button',{name:'전체',exact:true}).click()
    await closeFilters(page)
    await page.getByRole('group',{name:'종목 보기 방식'}).getByRole('button',{name:'카드형'}).click()
    await page.locator('.analysis-idea-list .stock-trend-row').first().click()
    const analysis=page.locator('.analysis-page')
    await expect(analysis).toBeVisible()
    expect(await analysis.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 255)')
    await expect(analysis.locator('.analysis-detail-tabs').getByRole('tab')).toHaveText(['Overview','Analysis','Financials','Thesis'])
    await expect(analysis.locator('.folio-insight')).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true)
    await context.close()
  })
}

test('Light theme keeps one Folio visual system across every product workspace',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'light',reducedMotion:'reduce'})
  const page=await context.newPage()
  await boot(page)
  const destinations=[
    ['시장 요약','dashboard'],['발견','analysis'],['저널','notebook'],['여정','tracking'],
    ['시장 신호','signal'],['시장 온도계','temperature'],['Watchlist','watchlist'],
    ['Portfolio','portfolio'],['Leaderboard','leaderboard'],
    ['Universe','universe'],['Settings','settings']
  ] as const
  const nav=page.locator('.sidebar nav')
  for(const [label,key] of destinations){
    await openPage(page,label)
    const main=page.locator('.app-main.page-'+key)
    await expect(main).toBeVisible()
    const signature=await main.evaluate(e=>{
      const s=getComputedStyle(e)
      return {background:s.backgroundColor,color:s.color}
    })
    expect(signature.background).toBe('rgb(255, 255, 255)')
    expect(signature.color).toBe('rgb(17, 17, 19)')
    const content=main.locator('.content')
    expect(await content.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 255)')
    expect(await content.evaluate(e=>getComputedStyle(e).backgroundImage)).toBe('none')
    const structural=main.locator('.panel,.page-note,.workspace-grid-panel,.catalog-grid-panel,.temp-card,.ticker-entry')
    for(const node of await structural.all()){
      if(await node.isVisible()){const channels=await node.evaluate(e=>getComputedStyle(e).backgroundColor.match(/[\d.]+/g)?.slice(0,3).map(Number)||[]);expect(Math.max(...channels)-Math.min(...channels)).toBeLessThan(6)}
    }
  }
  await context.close()
})

test('launch shows only the canonical Folio wordmark',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/')
  const launch=page.locator('.launch-overlay')
  await expect(launch.getByRole('img',{name:'Folio xx',exact:true})).toBeVisible()
  await expect(launch.locator('.launch-b-hero,.launch-progress')).toHaveCount(0)
  await expect(launch).toHaveCount(0,{timeout:3000})

  await expect(launch.locator('.launch-footer')).toBeHidden()

})
