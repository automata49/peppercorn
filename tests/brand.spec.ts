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
  const hero=launch.getByRole('img',{name:'Folio xx visual'})
  await expect(hero).toBeVisible()
  await expect(hero).toHaveAttribute('src','./folio-brand-launch.webp?v=u1')
  await expect(launch.locator('.launch-editorial-caption')).toBeHidden()
  await expect(launch.locator('.launch-footer')).toBeHidden()
  if(view.name==='phone'){
    const frame=await launch.locator('.launch-editorial-frame').boundingBox()
    expect(frame).not.toBeNull()
    expect(frame!.width/frame!.height).toBeGreaterThan(.55)
    expect(frame!.width/frame!.height).toBeLessThan(.575)
    expect(frame!.x).toBeGreaterThanOrEqual(0)
    expect(frame!.y).toBeGreaterThanOrEqual(0)
  }
  if(shots)await page.screenshot({path:`${shots}/${view.name}-launch.png`})
  await expect(launch).toHaveCount(0,{timeout:15000})

  if(view.compact){
    const homeBrand=page.locator('.mobile-brandbar .folio-wordmark-system')
    await expect(homeBrand).toBeVisible()
    await expect(homeBrand).toHaveAttribute('aria-label','Folio xx')
    await expect(homeBrand.locator('.folio-wordmark-image-light')).toBeVisible()
    await expect(homeBrand.locator('.folio-wordmark-image-light')).toHaveAttribute('src','./folio-brand-wordmark-light.webp?v=u1')
    if(view.name==='phone'){
      const brandBox=await homeBrand.boundingBox()
      expect(brandBox).not.toBeNull()
      expect(brandBox!.height).toBeGreaterThanOrEqual(24.5)
      expect(brandBox!.height).toBeLessThanOrEqual(25.5)
      const ratio=await homeBrand.locator('.folio-wordmark-image-light').evaluate((e:any)=>e.naturalWidth/e.naturalHeight)
      expect(ratio).toBeGreaterThanOrEqual(3.9)
      expect(ratio).toBeLessThanOrEqual(4.1)
      const navIcon=page.locator('.mobile-bottom-nav .app-icon').first()
      const navIconBox=await navIcon.boundingBox()
      expect(navIconBox).not.toBeNull()
      expect(navIconBox!.width).toBeGreaterThanOrEqual(19.5)
      expect(navIconBox!.width).toBeLessThanOrEqual(20.5)
      const motifBox=await page.locator('.folio-motif-panel img').boundingBox()
      expect(motifBox).not.toBeNull()
      expect(motifBox!.height).toBeGreaterThanOrEqual(299)
    }
    await expect(page.locator('.page-dashboard .topbar')).toBeHidden()
    await expect(page.locator('.mobile-brand-menu')).toBeVisible()
  }else{
    const sideBrand=page.locator('.sidebar .folio-wordmark-system')
    await expect(sideBrand).toBeVisible()
    await expect(sideBrand.locator('.folio-wordmark-image-dark')).toBeVisible()
    await expect(sideBrand.locator('.folio-wordmark-image-dark')).toHaveAttribute('src','./folio-brand-wordmark-dark.webp?v=u1')
    await expect(page.locator('.page-dashboard .topbar')).toBeVisible()
  }

  await expect(page.locator('.folio-motif-panel img')).toHaveAttribute('src','./folio-brand-typography.webp?v=u1')
  if(!view.compact)await expect(page.locator('.folio-photo-panel img')).toHaveAttribute('src','./folio-brand-photography.webp?v=u1')
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
 expect(touch).toBe('./folio-b-icon-180.png?v=u1')
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

test('user supplied wordmark, hero, typography and photography assets are deployable',async({request})=>{
 for(const asset of [
  'folio-brand-launch.webp',
  'folio-brand-typography.webp',
  'folio-brand-photography.webp',
  'folio-brand-wordmark-light.webp',
  'folio-brand-wordmark-dark.webp',
  'folio-brand-icon-black.webp',
  'folio-brand-icon-glossy.webp',
  'folio-brand-icon-light.webp'
 ]){
  const res=await request.get(asset)
  expect(res.status(),asset).toBe(200)
  expect(res.headers()['content-type'],asset).toContain('image/')
 }
})

test('B app icon keeps the approved board-scale xx and negative diamond',async({page})=>{
 await page.goto('http://127.0.0.1:4173/peppercorn/')
 const box=await page.evaluate(async()=>{
   const img=new Image()
   img.src='./folio-b-icon-512.png'
   await img.decode()
   const canvas=document.createElement('canvas')
   canvas.width=512;canvas.height=512
   const ctx=canvas.getContext('2d',{willReadFrequently:true})!
   ctx.drawImage(img,0,0)
   const data=ctx.getImageData(0,0,512,512).data
   let x0=512,y0=512,x1=-1,y1=-1
   for(let y=0;y<512;y++)for(let x=0;x<512;x++){
     const i=(y*512+x)*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3]
     if(a>180&&Math.max(r,g,b)>45){
       if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y
     }
   }
   const p=(x:number,y:number)=>{const i=(y*512+x)*4;return [data[i],data[i+1],data[i+2],data[i+3]]}
   return {x0,y0,x1,y1,w:x1-x0+1,h:y1-y0+1,cx:(x0+x1)/2,cy:(y0+y1)/2,center:p(256,256)}
 })
 expect(box.w/512).toBeGreaterThanOrEqual(.70)
 expect(box.w/512).toBeLessThanOrEqual(.76)
 expect(box.h/512).toBeGreaterThanOrEqual(.35)
 expect(box.h/512).toBeLessThanOrEqual(.41)
 expect(box.w/box.h).toBeGreaterThanOrEqual(1.85)
 expect(box.w/box.h).toBeLessThanOrEqual(2.02)
 expect(Math.abs(box.cx-255.5)).toBeLessThanOrEqual(5)
 expect(Math.abs(box.cy-255.5)).toBeLessThanOrEqual(5)
 expect(Math.max(...box.center.slice(0,3))).toBeLessThan(40)
})

test('share metadata carries Folio xx and the B icon',async({page,request})=>{
 const description='모멘텀·성장·가치 전략으로 시장 주도주를 찾고 포트폴리오까지 관리하는 투자 분석 플랫폼'
 await page.goto('http://127.0.0.1:4173/peppercorn/')
 const meta=(sel:string)=>page.locator(sel).getAttribute('content')
 expect(await meta('meta[property="og:title"]')).toBe('Folio xx')
 expect(await meta('meta[property="og:description"]')).toBe(description)
 expect(await meta('meta[name="application-name"]')).toBe('Folio xx')
 const image=await meta('meta[property="og:image"]')
 expect(image).toContain('folio-b-icon-512.png?v=u1')
 expect(await meta('meta[name="twitter:image"]')).toContain('folio-b-icon-512.png?v=u1')
 const res=await request.get(new URL(image!).pathname.replace('/peppercorn/',''))
 expect(res.status()).toBe(200)
})
