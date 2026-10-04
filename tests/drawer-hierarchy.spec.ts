import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

test('compact drawer shows primary destinations first and reopens the active secondary group',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})

  await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
  let drawer=page.locator('.menu-drawer')
  const more=drawer.locator('.menu-nav-more')
  await expect(more).not.toHaveAttribute('open','')
  await expect(drawer.getByRole('button',{name:'Dashboard'})).toBeVisible()
  await expect(drawer.getByRole('button',{name:'Journal'})).toBeVisible()
  await expect(drawer.getByRole('button',{name:'Leaderboard'})).toBeHidden()
  await expect(drawer.getByRole('button',{name:'Universe'})).toBeHidden()
  await expect(drawer.getByRole('button',{name:'Settings'})).toBeHidden()

  await more.locator(':scope > summary').click()
  await expect(more).toHaveAttribute('open','')
  await expect(drawer.getByRole('button',{name:'Leaderboard'})).toBeVisible()
  await drawer.getByRole('button',{name:'Leaderboard'}).click()
  await expect(page.locator('.topbar h1')).toHaveText('Leaderboard')

  await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
  drawer=page.locator('.menu-drawer')
  const reopened=drawer.locator('.menu-nav-more')
  await expect(reopened).toHaveAttribute('open','')
  await expect(drawer.getByRole('button',{name:'Leaderboard'})).toHaveAttribute('aria-current','page')
  await context.close()
})
