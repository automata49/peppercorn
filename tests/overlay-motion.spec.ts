import { test, expect } from '@playwright/test'
import { openPage } from './journey-helpers'

for (const viewport of [{width:390,height:844},{width:834,height:1194},{width:1440,height:900}]) {
 test(`overlay surfaces open and close smoothly ${viewport.width}`, async ({browser}) => {
  const context=await browser.newContext({viewport,reducedMotion:'no-preference'})
  const page=await context.newPage()
  await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
  await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.goto('/peppercorn/')
  // Primary menu: reversible open/close animation and no trapped focus.
  for (let i=0;i<2;i++) {
   const bottom=page.locator('.mobile-bottom-menu')
   const sidebar=page.locator('.sidebar-tools')
   if(await bottom.isVisible())await bottom.click()
   else if(await sidebar.isVisible())await sidebar.click()
   else await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click()
   const drawer=page.locator('.menu-drawer')
   await expect(drawer).toBeVisible()
   expect(await drawer.evaluate(el=>getComputedStyle(el).animationName)).toMatch(/menuSlideIn/)
   await page.keyboard.press('Escape')
   await expect(drawer).toHaveCount(0)
  }
  // The generic modal, alert and popover share paired animation names.
  const names=await page.evaluate(()=>{
   const out:Record<string,string[]>={}
   for(const cls of ['ui-dialog-content','ui-alert-content','ui-popover-content','catalog-filter-drawer ui-dialog-content']) {
    const el=document.createElement('div');el.className=cls;document.body.appendChild(el)
    el.setAttribute('data-state','open')
    const opened=getComputedStyle(el).animationName
    el.setAttribute('data-state','closed')
    const closed=getComputedStyle(el).animationName
    out[cls]=[opened,closed];el.remove()
   }
   return out
  })
  expect(names['ui-dialog-content']).toEqual(['folio-surface-in','folio-surface-out'])
  expect(names['ui-alert-content']).toEqual(['folio-surface-in','folio-surface-out'])
  expect(names['ui-popover-content']).toEqual(['folio-popover-in','folio-popover-out'])
  expect(names['catalog-filter-drawer ui-dialog-content']).toEqual(['folio-filter-right-enter','folio-filter-right-exit'])
  if(viewport.width===390) {
   await openPage(page,'발견')
   const toggle=page.locator('.catalog-filter-toggle')
   await expect(toggle).toBeVisible()
   await toggle.click()
   const panel=page.locator('.catalog-filter-drawer.ui-dialog-content')
   await expect(panel).toBeVisible()
   expect(await panel.evaluate(el=>getComputedStyle(el).animationName)).toBe('folio-filter-right-enter')
   await page.getByRole('button',{name:'필터 닫기'}).click()
   await expect(panel).toHaveCount(0)
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await context.close()
 })
}
test('reduced motion disables entry and exit animations',async({browser})=>{
 const context=await browser.newContext({reducedMotion:'reduce'})
 const page=await context.newPage()
 await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
 await page.goto('/peppercorn/')
 const results=await page.evaluate(()=>{
  return ['ui-dialog-content','ui-alert-content','ui-popover-content','catalog-filter-drawer ui-dialog-content','menu-drawer'].flatMap(cls=>{
   const el=document.createElement('div');el.className=cls;document.body.appendChild(el)
   const values=['open','closed'].map(state=>{el.setAttribute('data-state',state);return getComputedStyle(el).animationName})
   el.remove();return values
  })
 })
 expect(results.every(n=>n==='none')).toBe(true)
 await context.close()
})
