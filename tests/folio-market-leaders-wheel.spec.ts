import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'

const labels=['핵심 주도','주도 후보','강세 전환','조정 중','전체']
for(const [width,height] of [[390,844],[834,1194],[1194,834],[1440,900]]){
 test(`Market Leaders typography and five scrollable categories at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height})
  await page.addInitScript(()=>{
   sessionStorage.setItem('peppercorn-intro-seen','1')
   localStorage.setItem('folio-stock-size','all')
   if(!sessionStorage.getItem('folio-wheel-test-seeded')){
    localStorage.setItem('folio-discovery-leadership','core')
    sessionStorage.setItem('folio-wheel-test-seeded','1')
   }
  })
  await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.goto('/peppercorn/')
  async function discover(){
   const mobile=page.locator('.mobile-bottom-nav').getByRole('button',{name:'발견',exact:true})
   if(await mobile.isVisible())await mobile.click()
   else await page.locator('.sidebar nav').getByRole('button',{name:'발견',exact:true}).click()
  }
  const style=async(selector:string)=>page.locator(selector).first().evaluate(el=>{
   const s=getComputedStyle(el)
   return [s.fontSize,s.fontWeight,s.lineHeight,s.letterSpacing,s.fontFamily]
  })
  await discover()
  const signal=page.locator('.discovery-home .folio-editorial-map-heading').first()
  await expect(signal.locator('h2')).toHaveText('주도 섹터')
  const signalHeading=await style('.discovery-home .folio-editorial-map-heading h2')
  const signalKicker=await style('.discovery-home .folio-editorial-map-heading .journey-kicker')
  await page.getByRole('tab',{name:'종목 검토',exact:true}).click()
  const heading=page.locator('.analysis-finder .folio-editorial-map-heading')
  await expect(heading.locator('.journey-kicker')).toHaveText('MARKET LEADERS')
  await expect(heading.locator('h2')).toHaveText('주도 종목')
  expect(await style('.analysis-finder .folio-editorial-map-heading h2')).toEqual(signalHeading)
  expect(await style('.analysis-finder .folio-editorial-map-heading .journey-kicker')).toEqual(signalKicker)
  const rail=page.locator('.analysis-finder [data-wheel="주도 분류"] .catalog-wheel-track')
  await expect(rail.getByRole('button')).toHaveText(labels)
  const metrics=await rail.evaluate(el=>({height:el.clientHeight,scrollHeight:el.scrollHeight,mask:getComputedStyle(el).maskImage}))
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.height+44)
  expect(metrics.height).toBe(width>=1100?136:128)
  expect(metrics.mask).toBe('none')
  for(const label of labels){
   const option=rail.getByRole('button',{name:label,exact:true})
   await option.click()
   await expect(option).toHaveAttribute('aria-pressed','true')
   const centerOffset=await option.evaluate(el=>{
    const track=el.parentElement!.getBoundingClientRect(),rect=el.getBoundingClientRect()
    return Math.abs((track.top+track.bottom)/2-(rect.top+rect.bottom)/2)
   })
   expect(centerOffset).toBeLessThanOrEqual(26)
  }
  await rail.getByRole('button',{name:'전체'}).focus()
  await page.keyboard.press('ArrowUp')
  await expect(rail.getByRole('button',{name:'조정 중'})).toHaveAttribute('aria-pressed','true')
  await page.keyboard.press('ArrowUp')
  await expect(rail.getByRole('button',{name:'강세 전환'})).toHaveAttribute('aria-pressed','true')
  await expect.poll(async()=>page.evaluate(()=>localStorage.getItem('folio-discovery-leadership'))).toBe('turns')
  await page.reload()
  await discover()
  await page.getByRole('tab',{name:'종목 검토',exact:true}).click()
  await expect(page.locator('.analysis-finder [data-wheel="주도 분류"]').getByRole('button',{name:'강세 전환'})).toHaveAttribute('aria-pressed','true')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 })
}
