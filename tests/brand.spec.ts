import {test,expect} from '@playwright/test'
const views=[{name:'phone',width:390,height:844,touch:true,brand:false},{name:'ipad-portrait',width:834,height:1194,touch:true,brand:false},{name:'ipad-landscape',width:1194,height:834,touch:true,brand:false},{name:'ipad-pro',width:1366,height:1024,touch:true,brand:true},{name:'desktop',width:1440,height:900,touch:false,brand:true}]
const shots=process.env.BRAND_SHOTS
for(const view of views){
 test(view.name+' Folio brand, loading page and menu',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[]}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  const launch=page.locator('.launch-overlay')
  await expect(launch.locator('.launch-wordmark')).toHaveAttribute('alt','Folio')
  await expect(launch.locator('.launch-slogan')).toHaveText('Fewer decisions. Greater conviction')
  const footer=launch.locator('.launch-footer')
  await expect(footer).toContainText('Peppercorn Capital')
  await expect(footer).toContainText('©')
  await page.waitForTimeout(1900) // let the entrance animation settle before measuring
  // One small line at the bottom; the house icon is as tall as its brand text.
  const [fb,ib,tb]=await Promise.all([footer.boundingBox(),footer.locator('img').boundingBox(),footer.locator('span').boundingBox()])
  expect(fb!.height).toBeLessThanOrEqual(14)
  expect(fb!.y+fb!.height).toBeGreaterThan(view.height-40)
  expect(Math.abs(ib!.height-tb!.height)).toBeLessThanOrEqual(1)
  const [li,lw]=await Promise.all([launch.locator('.launch-emblem').boundingBox(),launch.locator('.launch-wordmark').boundingBox()])
  expect(Math.abs(li!.height-lw!.height)).toBeLessThanOrEqual(1)
  if(shots)await page.screenshot({path:`${shots}/${view.name}-launch.png`})
  await expect(launch).toHaveCount(0,{timeout:15000})

  const visibleBrands=page.locator('.folio-brand:visible')
  const menu=page.locator('.topbar-menu')
  if(view.brand){
   await expect(visibleBrands).toHaveCount(1)
   await expect(menu).toBeHidden()
   const [bi,bw]=await Promise.all([visibleBrands.locator('.brand-icon').boundingBox(),visibleBrands.locator('.brand-wordmark-img').boundingBox()])
   expect(Math.abs(bi!.height-bw!.height)).toBeLessThanOrEqual(1)
  }else{
   await expect(visibleBrands).toHaveCount(0)
   await expect(menu).toBeVisible()
   const [mb,tb2]=await Promise.all([menu.boundingBox(),page.locator('.topbar h1').boundingBox()])
   expect(mb!.y).toBeLessThan(20)
   expect(mb!.x+mb!.width).toBeLessThanOrEqual(tb2!.x)
  }
  if(shots)await page.screenshot({path:`${shots}/${view.name}-page.png`})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)

  if(!view.brand||view.touch){
   await (view.brand?page.locator('.mobile-brand-menu'):menu).click()
   const drawer=page.locator('.menu-drawer')
   const brand=drawer.locator('.folio-brand')
   await expect(brand).toBeVisible()
   await expect(page.getByRole('dialog',{name:'Folio'})).toBeVisible()
   const [di,dw,dc,dd]=await Promise.all([brand.locator('.brand-icon').boundingBox(),brand.locator('.brand-wordmark-img').boundingBox(),drawer.locator('.menu-drawer-close').boundingBox(),drawer.boundingBox()])
   expect(Math.abs(di!.height-dw!.height)).toBeLessThanOrEqual(1)
   expect(dw!.x+dw!.width).toBeLessThanOrEqual(dc!.x)
   expect(di!.height).toBeGreaterThanOrEqual(28)
   expect(dd!.x+dd!.width).toBeLessThanOrEqual(view.width)
   await page.waitForTimeout(400)
   if(shots)await page.screenshot({path:`${shots}/${view.name}-menu.png`})
   await page.keyboard.press('Escape')
   await expect(drawer).toHaveCount(0)
  }
  await context.close()
 })
}
