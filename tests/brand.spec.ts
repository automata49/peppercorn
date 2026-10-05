import {test,expect} from '@playwright/test'

const views=[
  {name:'phone',width:390,height:844,touch:true,compact:true},
  {name:'ipad-portrait',width:834,height:1194,touch:true,compact:true},
  {name:'ipad-landscape',width:1194,height:834,touch:true,compact:true},
  {name:'ipad-pro',width:1366,height:1024,touch:true,compact:false},
  {name:'desktop',width:1440,height:900,touch:false,compact:false}
]
const shots=process.env.BRAND_SHOTS

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
}

for(const view of views){
 test(view.name+' uses the Folio xx identity from launch through home',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  await boot(page)

  const launch=page.locator('.launch-overlay')
  await expect(launch.getByRole('img',{name:'Folio xx'})).toBeVisible()
  await expect(launch.locator('.launch-slogan')).toHaveText('Fewer decisions. Greater conviction')
  await expect(launch.locator('.launch-description')).toContainText('데이터 기반 투자 분석 플랫폼')
  await expect(launch.locator('.launch-footer')).toContainText('Peppercorn Capital')
  if(shots)await page.screenshot({path:`${shots}/${view.name}-launch.png`})
  await expect(launch).toHaveCount(0,{timeout:15000})

  if(view.compact){
    const homeBrand=page.locator('.mobile-brandbar .folio-wordmark-system')
    await expect(homeBrand).toBeVisible()
    await expect(homeBrand).toHaveAttribute('aria-label','Folio xx')
    await expect(page.locator('.page-dashboard .topbar')).toBeHidden()
    await expect(page.locator('.mobile-brand-menu')).toBeVisible()
  }else{
    await expect(page.locator('.sidebar .folio-wordmark-system')).toBeVisible()
    await expect(page.locator('.page-dashboard .topbar')).toBeVisible()
  }

  const xx=page.locator('.folio-wordmark-system:visible .folio-xx').first()
  expect(await xx.evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('linear-gradient')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true)
  if(shots)await page.screenshot({path:`${shots}/${view.name}-page.png`,fullPage:true})

  const menu=view.compact?page.locator('.mobile-brand-menu'):page.locator('.mobile-brand-menu')
  if(view.compact){
    await menu.click()
    const drawer=page.locator('.menu-drawer')
    await expect(drawer.getByRole('img',{name:'Folio xx'})).toBeVisible()
    await expect(drawer.locator('.theme-control')).toBeVisible()
    await page.keyboard.press('Escape')
  }
  await context.close()
 })
}

test('home-screen icons and manifest use versioned Folio identity assets',async({page,request})=>{
 await page.goto('http://127.0.0.1:4173/peppercorn/')
 const touch=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
 expect(touch).toBe('./folio-identity-180.png')
 const manifest=await (await request.get('manifest.webmanifest')).json()
 expect(manifest.name).toBe('Folio xx')
 expect(manifest.background_color).toBe('#f8f5f1')
 const srcs=[touch!,...manifest.icons.map((i:{src:string})=>i.src)]
 expect(srcs.every(s=>s.includes('folio-identity-'))).toBe(true)
 for(const src of srcs){
  const res=await request.get(src.replace('./',''))
  expect(res.status(),src).toBe(200)
  expect(res.headers()['content-type']).toContain('image/png')
 }
})

test('share metadata carries Folio xx and the new identity icon',async({page,request})=>{
 const description='모멘텀·성장·가치 전략으로 시장 주도주를 찾고 포트폴리오까지 관리하는 투자 분석 플랫폼'
 await page.goto('http://127.0.0.1:4173/peppercorn/')
 const meta=(sel:string)=>page.locator(sel).getAttribute('content')
 expect(await meta('meta[property="og:title"]')).toBe('Folio xx')
 expect(await meta('meta[property="og:description"]')).toBe(description)
 expect(await meta('meta[name="application-name"]')).toBe('Folio xx')
 const image=await meta('meta[property="og:image"]')
 expect(image).toContain('folio-identity-512.png')
 const res=await request.get(new URL(image!).pathname.replace('/peppercorn/',''))
 expect(res.status()).toBe(200)
})
