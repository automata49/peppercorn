import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

for(const view of [
  {name:'phone',width:390,height:844},
  {name:'ipad',width:834,height:1194},
  {name:'ipad-landscape',width:1194,height:834},
  {name:'ipad-pro-touch',width:1366,height:1024}
]){
  test(view.name+' uses the Folio brand-first compact header',async({browser})=>{
    const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:true,isMobile:true})
    const page=await context.newPage()
    await boot(page)
    const top=page.locator('.topbar')
    if(view.width<=1500){
      await expect(top).toBeHidden()
      const brandbar=page.locator('.mobile-brandbar')
      await expect(brandbar).toBeVisible()
      const box=await brandbar.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(59.5)
      expect(box!.height).toBeLessThanOrEqual(60.5)
    }else{
      await expect(top.locator('h1')).toBeVisible()
      await expect(top.locator('p')).toBeHidden()
    }
    await context.close()
  })
}

test('desktop keeps the contextual header subtitle',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  await boot(page)
  await expect(page.locator('.topbar p')).toBeVisible()
  await expect(page.locator('.topbar p')).toContainText('Home → Market Signal')
})
