import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

test('fresh install starts in Light even when the device prefers dark',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,colorScheme:'dark'})
  const page=await context.newPage()
  await boot(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode','light')
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('folio-theme'))).toBe('light')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#faf8f5')
  await context.close()
})

test('desktop theme control persists Light Dark and System modes',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  await boot(page)
  const control=page.locator('.sidebar .theme-control')

  await control.getByRole('button',{name:'Dark'}).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('folio-theme'))).toBe('dark')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#0a0a0c')

  await control.getByRole('button',{name:'Light'}).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('folio-theme'))).toBe('light')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#faf8f5')

  await control.getByRole('button',{name:'System'}).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode','system')
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('folio-theme'))).toBe('system')
})

test('compact layouts expose appearance in the menu drawer',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  await boot(page)
  await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
  const control=page.locator('.menu-drawer .theme-control')
  await expect(control).toBeVisible()
  await control.getByRole('button',{name:'Dark'}).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  await context.close()
})
