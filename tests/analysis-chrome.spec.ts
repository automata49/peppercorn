import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'
import { openPage } from './journey-helpers'
for(const width of [390,834,1366,1440])for(const appearance of ['light-on-dark-os','system-light','dark','system-dark'])test(`analysis chrome ${width} ${appearance}`,async({browser})=>{
 const light=appearance==='light-on-dark-os'||appearance==='system-light'
 const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<1440,colorScheme:appearance==='system-light'?'light':'dark',reducedMotion:'reduce'}),page=await context.newPage()
 await page.addInitScript(mode=>{localStorage.setItem('folio-theme',mode);localStorage.setItem('folio-stock-size','all');sessionStorage.setItem('peppercorn-intro-seen','1')},appearance.startsWith('system')?'system':light?'light':'dark')
 for(const path of ['leaderboard','stock-flags','leader-insights'])await page.route(`**/data/${path}.json*`,r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows.map(r=>({...r,leadership_class:'핵심 주도',rs_rank:99}))}}));await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}));await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}));await page.goto('/peppercorn/')
 await openPage(page,'발견');await expect(page.locator('.analysis-idea-list .stock-trend-row').first()).toBeVisible()
 async function chrome(){for(const selector of ['.mobile-bottom-nav','.analysis-actionbar','.analysis-actionbar button:not(.primary)'])for(const el of await page.locator(selector).all()){if(!await el.isVisible())continue;const value=await el.evaluate(el=>{const s=getComputedStyle(el),canvas=document.createElement('canvas'),c=canvas.getContext('2d')!;// Inline Obra actions inherit the page paper; sample the composited surface.
c.fillStyle=getComputedStyle(el.closest('.obra-detail')||document.body).backgroundColor;c.fillRect(0,0,1,1);c.fillStyle=s.backgroundColor;c.fillRect(0,0,1,1);return {background:[...c.getImageData(0,0,1,1).data],ink:s.color}});if(light)expect(value.background[0],selector).toBeGreaterThan(230);else expect(value.background[0],selector).toBeLessThan(40)}}
 await chrome();await page.locator('.analysis-idea-list .stock-trend-row').first().click();await expect(page.locator('.analysis-body')).toBeVisible();await chrome()
 expect(await page.locator('.hero-name').evaluate(el=>getComputedStyle(el).color)).toBe(light?'rgb(17, 17, 19)':'rgb(250, 250, 250)')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await context.close()
})
