import {test,expect} from '@playwright/test'

const views=[
  {name:'phone',width:390,height:844,touch:true,compact:true},
  {name:'ipad-portrait',width:834,height:1194,touch:true,compact:true},
  {name:'ipad-landscape',width:1194,height:834,touch:true,compact:true},
  {name:'ipad-pro',width:1366,height:1024,touch:true,compact:true},
  {name:'desktop',width:1440,height:900,touch:false,compact:false}
]
const shots=process.env.BRAND_SHOTS

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
}

for(const view of views){
 test(view.name+' keeps exact Sunset Editorial B identity from launch through Home',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch,colorScheme:'light'})
  const page=await context.newPage()
  await boot(page)

  const launch=page.locator('.launch-overlay')
  const hero=launch.getByRole('img',{name:'Folio xx Sunset Editorial'})
  await expect(hero).toBeVisible()
  await expect(hero).toHaveAttribute('src','./folio-b-launch-hero.webp')
  await expect(launch.locator('.launch-editorial-caption')).toContainText('SUNSET EDITORIAL')
  await expect(launch.locator('.launch-editorial-caption')).toContainText('더 멀리 보고')
  await expect(launch.locator('.launch-footer')).toContainText('Peppercorn Capital')
  if(shots)await page.screenshot({path:`${shots}/${view.name}-launch.png`})
  await expect(launch).toHaveCount(0,{timeout:15000})

  if(view.compact){
    const homeBrand=page.locator('.mobile-brandbar .folio-wordmark-system')
    await expect(homeBrand).toBeVisible()
    await expect(homeBrand).toHaveAttribute('aria-label','Folio xx')
    await expect(homeBrand.locator('.folio-wordmark-art-light')).toHaveAttribute('src','./folio-b-wordmark-light.webp')
    await expect(homeBrand.locator('.folio-wordmark-art-light')).toBeVisible()
    await expect(page.locator('.page-dashboard .topbar')).toBeHidden()
    await expect(page.locator('.mobile-brand-menu')).toBeVisible()
  }else{
    const sideBrand=page.locator('.sidebar .folio-wordmark-system')
    await expect(sideBrand).toBeVisible()
    await expect(sideBrand.locator('.folio-wordmark-art-dark')).toHaveAttribute('src','./folio-b-wordmark-dark.webp')
    await expect(sideBrand.locator('.folio-wordmark-art-dark')).toBeVisible()
    await expect(page.locator('.page-dashboard .topbar')).toBeVisible()
  }

  await expect(page.locator('.folio-motif-panel img')).toHaveAttribute('src','./folio-b-motif.webp')
  if(!view.compact)await expect(page.locator('.folio-photo-panel img')).toHaveAttribute('src','./folio-c-photography.webp')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true)
  if(shots)await page.screenshot({path:`${shots}/${view.name}-page.png`,fullPage:true})

  if(view.compact){
    await page.locator('.mobile-brand-menu').click()
    const drawer=page.locator('.menu-drawer')
    await expect(drawer.getByRole('img',{name:'Folio xx'})).toBeVisible()
    await expect(drawer.locator('.theme-control')).toBeVisible()
    await page.keyboard.press('Escape')
  }
  await context.close()
 })
}

test('home-screen metadata uses exact B icon assets',async({page,request})=>{
 await page.goto('http://127.0.0.1:4173/peppercorn/')
 const touch=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
 expect(touch).toBe('./folio-b-icon-180.png')
 const manifest=await (await request.get('manifest.webmanifest')).json()
 expect(manifest.name).toBe('Folio xx')
 expect(manifest.background_color).toBe('#f4f1ec')
 const srcs=[touch!,...manifest.icons.map((i:{src:string})=>i.src)]
 expect(srcs.every(s=>s.includes('folio-b-icon-'))).toBe(true)
 for(const src of srcs){
  const res=await request.get(src.replace('./',''))
  expect(res.status(),src).toBe(200)
  expect(res.headers()['content-type']).toContain('image/png')
 }
})

test('B wordmark, hero, motif and C photography assets are deployable',async({request})=>{
 for(const asset of [
  'folio-b-wordmark-light.webp',
  'folio-b-wordmark-dark.webp',
  'folio-b-launch-hero.webp',
  'folio-b-motif.webp',
  'folio-c-photography.webp'
 ]){
  const res=await request.get(asset)
  expect(res.status(),asset).toBe(200)
  expect(res.headers()['content-type'],asset).toContain('image/')
 }
})

test('share metadata carries Folio xx and the B icon',async({page,request})=>{
 const description='모멘텀·성장·가치 전략으로 시장 주도주를 찾고 포트폴리오까지 관리하는 투자 분석 플랫폼'
 await page.goto('http://127.0.0.1:4173/peppercorn/')
 const meta=(sel:string)=>page.locator(sel).getAttribute('content')
 expect(await meta('meta[property="og:title"]')).toBe('Folio xx')
 expect(await meta('meta[property="og:description"]')).toBe(description)
 expect(await meta('meta[name="application-name"]')).toBe('Folio xx')
 const image=await meta('meta[property="og:image"]')
 expect(image).toContain('folio-b-icon-512.png')
 const res=await request.get(new URL(image!).pathname.replace('/peppercorn/',''))
 expect(res.status()).toBe(200)
})
