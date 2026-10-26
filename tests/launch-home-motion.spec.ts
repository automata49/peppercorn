// Release regression: preserve optical glyph centering and the bidirectional home-card frame transition.
import { test, expect } from '@playwright/test'
import { launchPhysicalScreenShift } from '../src/lib/centerLaunchWordmark'

test('installed iPhone splash is centered against the physical screen, not below the status bar',()=>{
 // Screenshot reference: 1179 x 2556 (393 x 852 CSS pixels), ink is 88 device
 // pixels below the center. A 58-60px native top inset needs -29/-30 CSS px.
 expect(launchPhysicalScreenShift(true,60,852,792)).toBe(-30)
 expect(launchPhysicalScreenShift(true,58,852,794)).toBe(-29)
 expect(launchPhysicalScreenShift(true,0,852,792)).toBe(-30)
 expect(launchPhysicalScreenShift(false,60,852,792)).toBe(0)
 expect(launchPhysicalScreenShift(true,0,852,852)).toBe(0)
 // iOS reports portrait screen dimensions while its content is landscape.
 expect(launchPhysicalScreenShift(true,0,852,393,393,852)).toBe(0)
 expect(launchPhysicalScreenShift(true,0,1194,834,834,1194)).toBe(0)
})


for (const viewport of [{width:390,height:844},{width:844,height:390},{width:834,height:1194},{width:1194,height:834},{width:1440,height:900},{width:852,height:393,standalone:true},{width:1194,height:834,standalone:true}]) {
 test(`optical splash center at ${viewport.width}x${viewport.height}${'standalone' in viewport?' installed':''}`,async({browser})=>{
  const installed='standalone' in viewport
  const context=await browser.newContext({viewport,reducedMotion:'reduce',...(installed?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',screen:{width:Math.min(viewport.width,viewport.height),height:Math.max(viewport.width,viewport.height)}}:{})})
  if(installed)await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}))
  const page=await context.newPage()
  await page.clock.install({time:new Date('2026-10-17T00:00:00Z')})
  await page.clock.pauseAt(new Date('2026-10-17T00:00:00Z'))
  await page.goto('/peppercorn/')
  const logo=page.locator('.launch-overlay .launch-wordmark')
  await expect(logo).toBeVisible()
  await expect.poll(()=>logo.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true)
  const bounds=await logo.evaluate((img:HTMLImageElement)=>{
   const scale=Math.min(1,640/Math.max(img.naturalWidth,img.naturalHeight))
   const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*scale);c.height=Math.round(img.naturalHeight*scale)
   const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(img,0,0,c.width,c.height)
   const d=ctx.getImageData(0,0,c.width,c.height).data
   let left=c.width,top=c.height,right=-1,bottom=-1
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const n=(y*c.width+x)*4
    if(d[n+3]>70&&Math.min(d[n],d[n+1],d[n+2])<185){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
   }
   const r=img.getBoundingClientRect()
   return {ink:right>=0&&bottom>=0,x:r.x+r.width*(left+right+1)/(2*c.width),y:r.y+r.height*(top+bottom+1)/(2*c.height)}
  })
  expect(bounds.ink).toBe(true)
  expect(Math.abs(bounds.x-viewport.width/2)).toBeLessThan(2)
  expect(Math.abs(bounds.y-viewport.height/2)).toBeLessThan(2)
  await context.close()
 })
}

for(const viewport of [{width:390,height:844},{width:834,height:1194},{width:1440,height:900}]){
 test(`home 2-column cards open and reverse smoothly at ${viewport.width}`,async({browser})=>{
  const context=await browser.newContext({viewport,reducedMotion:'no-preference'})
  const page=await context.newPage()
  await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
  await page.goto('/peppercorn/')
  const cards=page.locator('.home-motion-card')
  await expect(cards).toHaveCount(4)
  for(const title of ['발견','저널','여정']){
   const card=page.getByRole('button',{name:`${title} 카드 열기`})
   await card.scrollIntoViewIfNeeded()
   await card.click()
   await expect(page.locator('.home-detail')).toBeVisible()
   await expect(page.locator('.home-detail')).toHaveAttribute('data-state','open')
   await page.getByRole('button',{name:'카드 닫기'}).click()
   await expect(page.locator('.home-detail')).toHaveCount(0)
   await expect(card).toBeFocused()
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await context.close()
 })
}
