import {test,expect} from '@playwright/test'
import {openPage} from './journey-helpers'
import {demoRows} from '../src/data/mock'
for(const width of [390,834,1194,1440])test(`settings previews stay bounded and preferences persist at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900})
 await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.goto('/peppercorn/');await openPage(page,'Settings')
 const previews=page.locator('.visual-style-options img')
 await expect(previews).toHaveCount(2)
 for(const img of await previews.all())expect((await img.boundingBox())!.height).toBeLessThanOrEqual(180)
 await page.getByRole('button',{name:'Vivid · 아트 저널',exact:false}).click()
 await expect(page.locator('html')).toHaveAttribute('data-photo-style','vivid')
 await page.reload();await openPage(page,'Settings')
 await expect(page.locator('html')).toHaveAttribute('data-photo-style','vivid')
 await page.locator('.typography-settings select').selectOption('classic')
 await expect(page.locator('html')).toHaveAttribute('data-editorial','classic')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})
