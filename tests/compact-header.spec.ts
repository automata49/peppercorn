import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

async function boot(page:any,calls:{n:number}){
  await page.route('**/functions/v1/leaderboard?*',route=>{calls.n++;return route.fulfill({json:{rows:demoRows}})})
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

for(const view of [
  {name:'phone',width:390,height:844},
  {name:'ipad',width:834,height:1194}
]){
  test(view.name+' keeps manual refresh in the drawer, not the primary header',async({browser})=>{
    const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:true,isMobile:true})
    const page=await context.newPage()
    const calls={n:0}
    await boot(page,calls)

    await expect(page.locator('.topbar-refresh')).toBeHidden()
    await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
    const action=page.locator('.menu-drawer').getByRole('button',{name:'데이터 새로고침'})
    await expect(action).toBeVisible()
    const before=calls.n
    await action.click()
    await expect.poll(()=>calls.n).toBeGreaterThan(before)
    await expect(page.locator('.menu-drawer')).toBeHidden()
    await context.close()
  })
}

test('desktop keeps the direct header refresh control',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  const calls={n:0}
  await boot(page,calls)
  await expect(page.locator('.topbar-refresh')).toBeVisible()
  await expect(page.locator('.topbar-refresh > svg.app-icon')).toHaveCount(1)
})
