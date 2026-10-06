import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'

async function boot(page:any){
  await page.addInitScript(()=>{
    sessionStorage.setItem('peppercorn-intro-seen','1')
    localStorage.setItem('folio-theme','light')
  })
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
}

test('phone consumes the Level-0 design baseline',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,colorScheme:'light'})
  const page=await context.newPage()
  await boot(page)

  const tokens=await page.evaluate(()=>{
    const s=getComputedStyle(document.documentElement)
    const get=(name:string)=>s.getPropertyValue(name).trim()
    return {
      gutter:get('--folio-ds-gutter-phone'),
      touch:get('--folio-ds-touch-min'),
      header:get('--folio-ds-header-compact'),
      nav:get('--folio-ds-nav-item'),
      icon:get('--folio-ds-icon-size'),
      stroke:get('--folio-ds-icon-stroke'),
      word:get('--folio-ds-wordmark-phone'),
      markHeight:get('--folio-ds-wordmark-mark-height'),
      markRatio:get('--folio-ds-wordmark-mark-ratio'),
      plum:get('--folio-brand-plum'),
      coral:get('--folio-brand-coral'),
    }
  })
  expect(tokens).toEqual({gutter:'16px',touch:'44px',header:'60px',nav:'52px',icon:'20px',stroke:'1.55',word:'25px',markHeight:'1ex',markRatio:'184 / 104',plum:'#54265f',coral:'#f06a45'})

  const header=await page.locator('.page-shell-dashboard .mobile-brandbar').boundingBox()
  expect(header).not.toBeNull()
  expect(header!.height).toBeGreaterThanOrEqual(59.5)
  expect(header!.height).toBeLessThanOrEqual(60.5)

  const brand=page.locator('.mobile-brand-home .folio-wordmark-system')
  const brandBox=await brand.boundingBox()
  expect(brandBox).not.toBeNull()
  expect(brandBox!.x).toBeGreaterThanOrEqual(15.5)
  expect(brandBox!.x).toBeLessThanOrEqual(16.5)

  const word=brand.locator('.folio-wordmark-image-light')
  await expect(word).toBeVisible()
  const wordmarkMetrics=await word.evaluate((img:any)=>({ratio:img.naturalWidth/img.naturalHeight,height:img.getBoundingClientRect().height}))
  expect(wordmarkMetrics.height).toBeCloseTo(25,1)
  expect(wordmarkMetrics.ratio).toBeGreaterThanOrEqual(3.9)
  expect(wordmarkMetrics.ratio).toBeLessThanOrEqual(4.1)

  for(const selector of ['.mobile-brand-menu','.mobile-brand-search']){
    const box=await page.locator(selector).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(43.9)
    expect(box!.height).toBeGreaterThanOrEqual(43.9)
  }

  const navButton=page.locator('.mobile-bottom-nav').getByRole('button',{name:'홈'})
  const navBox=await navButton.boundingBox()
  expect(navBox).not.toBeNull()
  expect(navBox!.height).toBeGreaterThanOrEqual(51.9)

  const icons=page.locator('.page-shell-dashboard .app-icon')
  const iconCount=await icons.count()
  expect(iconCount).toBeGreaterThan(0)
  for(let i=0;i<iconCount;i++){
    const icon=icons.nth(i)
    const box=await icon.boundingBox()
    if(!box)continue
    expect(box.width).toBeCloseTo(20,1)
    expect(box.height).toBeCloseTo(20,1)
    const stroke=parseFloat(await icon.evaluate(e=>getComputedStyle(e).strokeWidth))
    expect(stroke).toBeGreaterThanOrEqual(1.54)
    expect(stroke).toBeLessThanOrEqual(1.76)
  }

  await context.close()
})

test('home-screen icons are full square before platform masking',async({page})=>{
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  const samples=await page.evaluate(async()=>{
    const files=['folio-b-icon-180.png?v=u1','folio-b-icon-192.png?v=u1','folio-b-icon-512.png?v=u1','folio-b-icon-512-maskable.png?v=u1']
    const out:any[]=[]
    for(const src of files){
      const img=new Image()
      img.src=src
      await img.decode()
      const canvas=document.createElement('canvas')
      canvas.width=img.naturalWidth
      canvas.height=img.naturalHeight
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!
      ctx.drawImage(img,0,0)
      const points=[[0,0],[img.naturalWidth-1,0],[0,img.naturalHeight-1],[img.naturalWidth-1,img.naturalHeight-1]]
      const corners=points.map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data))
      out.push({src,w:img.naturalWidth,h:img.naturalHeight,corners})
    }
    return out
  })
  for(const icon of samples){
    expect(icon.w).toBe(icon.h)
    for(const [r,g,b,a] of icon.corners){
      expect(a).toBe(255)
      expect(Math.max(r,g,b)).toBeLessThan(30)
    }
  }
})
