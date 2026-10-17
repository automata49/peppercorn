import {test,expect} from '@playwright/test'
import {openPage} from './journey-helpers'
import {demoRows} from '../src/data/mock'
for(const [width,height] of [[320,568],[390,844],[844,390],[834,1194],[1194,834],[1366,1024],[1440,900]])test(`photo-led home ${width}x${height}: hero, responsive stories, actions and no document overflow`,async({page})=>{
 await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'})
 await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
 for(const feed of ['leaderboard','stock-flags','leader-insights'])await page.route(`**/data/${feed}.json*`,r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}));await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}));await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.goto('/peppercorn/');const cards=page.locator('.home-motion-card');await expect(cards).toHaveCount(4)
 const hero=(await cards.first().boundingBox())!,title=(await page.locator('.home-heading').boundingBox())!,second=(await cards.nth(1).boundingBox())!
 if(width>height){expect(hero.width).toBeCloseTo(width,0);expect(title.y).toBeGreaterThanOrEqual(hero.y);expect(title.y+title.height).toBeLessThan(hero.y+hero.height);expect(second.y).toBeGreaterThanOrEqual(hero.y+hero.height)}
 else{expect(hero.x).toBeLessThan(second.x);expect(hero.height).toBeGreaterThan(second.height);expect(title.y+title.height).toBeLessThanOrEqual(hero.y)}
 expect(title.x).toBeGreaterThanOrEqual(0);expect(title.x+title.width).toBeLessThanOrEqual(width+1)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.screenshot({path:`test-results/patagonia-home-${width}-${height}.png`})
 await cards.first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(cards.first()).toBeFocused()
 for(const label of ['발견','저널','여정']){await page.getByRole('button',{name:`${label} 카드 열기`}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape')}
 await expect(page.getByRole('navigation',{name:'홈에서 페이지로 바로 이동'})).toHaveCount(0)
 for(const [label,selector] of [['발견','.discovery-workspace'],['저널','.lifetime-journal'],['여정','.journey-workspace']]){await openPage(page,label);await expect(page.locator(selector)).toBeVisible();await openPage(page,'오늘')}
})
