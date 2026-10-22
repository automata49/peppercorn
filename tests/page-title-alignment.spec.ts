// Release gate: only update approved visual reference images after this geometric alignment check passes.
import { test, expect } from '@playwright/test'
import { openPage } from './journey-helpers'

const cases = [
  { width:390, height:844 },
  { width:844, height:390 },
  { width:834, height:1194 },
  { width:1194, height:834 },
  { width:1366, height:1024 },
  { width:1440, height:900 },
]

for (const viewport of cases) {
 test(`page headings share a common start at ${viewport.width}x${viewport.height}`, async ({browser}) => {
  const context = await browser.newContext({viewport,reducedMotion:'reduce'})
  const page = await context.newPage()
  await page.addInitScript(() => sessionStorage.setItem('peppercorn-intro-seen','1'))
  await page.route('**/data/leaderboard.json*',route=>route.fulfill({status:404,body:''}))
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.goto('/peppercorn/')
  const values: {page:string; x:number; y:number;titleX:number;titleY:number}[]=[]
  const compact=viewport.width<1280
  for (const [label,container] of [
   ['발견','.discovery-workspace'],
   ['저널','.lifetime-journal'],
   ['여정','.journey-workspace'],
  ] as const) {
   await openPage(page,label)
   const bodyHeading=page.locator(`${container} > .section-heading`)
   const heading=compact?page.locator('.mobile-brandbar .mobile-brand-title'):bodyHeading
   const kicker=heading.locator('.journey-kicker')
   const title=heading.locator(compact?'h1':'h2')
   await expect(title).toBeVisible()
   if(compact){
    await expect(bodyHeading.locator('h2')).toBeHidden()
    await expect(page.locator('.mobile-brandbar').getByRole('button',{name:'오늘로 이동'})).toHaveCount(0)
    await expect(page.locator('.mobile-brandbar').getByRole('button',{name:'종목 검색'})).toBeVisible()
    await expect(page.locator('.mobile-bottom-nav').getByRole('button',{name:'오늘'})).toBeVisible()
   }
   // openPage may explicitly select card view in Discover; Playwright scrolls that
   // below-the-fold control into view. Compare headings at a common scroll origin.
   await page.evaluate(async()=>{
     window.scrollTo({top:0,behavior:'instant'})
     await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))
   })
   const marker=await kicker.boundingBox(),name=await title.boundingBox()
   expect(marker).toBeTruthy()
   expect(name).toBeTruthy()
   values.push({page:label,x:marker!.x,y:marker!.y,titleX:name!.x,titleY:name!.y})
  }
  const baseline=values[0]
  for (const target of values.slice(1)) {
   expect(Math.abs(target.x-baseline.x),`${target.page} kicker x`).toBeLessThan(2)
   expect(Math.abs(target.y-baseline.y),`${target.page} kicker y`).toBeLessThan(2)
   expect(Math.abs(target.titleX-baseline.titleX),`${target.page} title x`).toBeLessThan(2)
   expect(Math.abs(target.titleY-baseline.titleY),`${target.page} title y`).toBeLessThan(2)
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true)
  await context.close()
 })
}
