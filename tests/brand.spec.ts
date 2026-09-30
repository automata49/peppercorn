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
  // Layout heights: the icon's 3D tilt changes its on-screen box, not its size.
  const h=(l:ReturnType<typeof page.locator>)=>l.evaluate(e=>(e as HTMLElement).offsetHeight)
  expect(Math.abs(await h(launch.locator('.launch-emblem'))-await h(launch.locator('.launch-wordmark')))).toBeLessThanOrEqual(1)
  await expect(launch.locator('.launch-description')).toHaveText('모멘텀·성장주·가치투자 전략을 통합해 시장 주도주 발굴, 기업 펀더멘털 및 내재가치 분석, 투자 기회 평가부터 포트폴리오 관리까지 체계적으로 지원하는 데이터 기반 투자 분석 플랫폼')
  const db=(await launch.locator('.launch-description').boundingBox())!
  expect(db.x).toBeGreaterThanOrEqual(0);expect(db.x+db.width).toBeLessThanOrEqual(view.width)
  expect(await launch.locator('.launch-emblem').evaluate(e=>getComputedStyle(e).transform)).toContain('matrix3d')
  if(shots)await page.screenshot({path:`${shots}/${view.name}-launch.png`})
  await expect(launch).toHaveCount(0,{timeout:15000})

  const visibleBrands=page.locator('.folio-brand:visible')
  const menu=page.locator('.topbar-menu')
  if(view.brand){
   await expect(visibleBrands).toHaveCount(1)
   await expect(menu).toBeHidden()
   const heights=await visibleBrands.evaluate(e=>[...e.querySelectorAll('img')].map(i=>(i as HTMLElement).offsetHeight))
   expect(Math.abs(heights[0]-heights[1])).toBeLessThanOrEqual(1)
   expect(await visibleBrands.locator('.brand-icon').evaluate(e=>getComputedStyle(e).transform)).toContain('matrix3d')
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
   const dh=await brand.evaluate(e=>[...e.querySelectorAll('img')].map(i=>(i as HTMLElement).offsetHeight))
   expect(Math.abs(dh[0]-dh[1])).toBeLessThanOrEqual(1)
   expect(dw!.x+dw!.width).toBeLessThanOrEqual(dc!.x)
   expect(dh[0]).toBeGreaterThanOrEqual(28)
   expect(dd!.x+dd!.width).toBeLessThanOrEqual(view.width)
   await page.waitForTimeout(400)
   if(shots)await page.screenshot({path:`${shots}/${view.name}-menu.png`})
   await page.keyboard.press('Escape')
   await expect(drawer).toHaveCount(0)
  }
  await context.close()
 })
}

test('home-screen icons point to the Folio app icon',async({page,request})=>{
 await page.goto('http://127.0.0.1:4173/peppercorn/')
 const touch=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
 expect(touch).toBe('./folio-apple-touch-icon.png')
 const manifest=await (await request.get('manifest.webmanifest')).json()
 const srcs=[touch!,...manifest.icons.map((i:{src:string})=>i.src)]
 expect(srcs.every(s=>s.includes('folio-'))).toBe(true)
 for(const src of srcs){
  const res=await request.get(src.replace('./',''))
  expect(res.status(),src).toBe(200)
  expect(res.headers()['content-type']).toContain('image/png')
 }
})
