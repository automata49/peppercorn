import {openPage} from './journey-helpers'
import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

test('phone navigation uses one SVG icon language',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  await boot(page)

  const bottom=page.locator('.mobile-bottom-nav')
  await expect(bottom.locator('button')).toHaveCount(5)
  await expect(bottom.locator('button > svg.app-icon')).toHaveCount(5)
  await expect(page.locator('.topbar-menu > svg.app-icon')).toHaveCount(1)
  await expect(page.locator('.topbar-refresh > svg.app-icon')).toHaveCount(1)

  await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
  const drawer=page.locator('.menu-drawer')
  const menuCount=await drawer.locator('nav button').count()
  expect(menuCount).toBeGreaterThanOrEqual(12)
  await expect(drawer.locator('nav button .nav-icon > svg.app-icon')).toHaveCount(menuCount)
  await expect(drawer.locator('.menu-drawer-close > svg.app-icon')).toHaveCount(1)

  await drawer.getByRole('button',{name:'발견',exact:true}).click()
  await expect(bottom.getByRole('button',{name:'발견',exact:true})).toHaveClass(/active/)
  await context.close()
})

test('desktop sidebar uses the same line icon system',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  await boot(page)
  await openPage(page,'오늘')
  const tools=page.locator('.sidebar-tools')
  const contrast=await tools.evaluate(e=>{const luminance=(color:string)=>{const c=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2]};const ink=luminance(getComputedStyle(e).color),paper=luminance(getComputedStyle(e.closest('.sidebar')!).backgroundColor);return (Math.max(ink,paper)+.05)/(Math.min(ink,paper)+.05)})
  expect(contrast).toBeGreaterThanOrEqual(4.5)
  const side=page.locator('.sidebar nav')
  await expect(side.locator('button')).toHaveCount(4)
  await expect(side.locator('button .nav-icon > svg.app-icon')).toHaveCount(4)

  const active=side.locator('button.active .app-icon').first()
  const inactive=side.locator('button:not(.active) .app-icon').first()
  expect(parseFloat(await active.evaluate(e=>getComputedStyle(e).strokeWidth))).toBeGreaterThanOrEqual(
    parseFloat(await inactive.evaluate(e=>getComputedStyle(e).strokeWidth))
  )
})
