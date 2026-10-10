import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {openPage} from './journey-helpers'
const rows=[
 {...demoRows[0],id:'KR:351320',market:'KR',ticker:'351320',name:'넥스다이내믹스',price:4410,asset_class:'Equity',leadership_class:'핵심 주도',market_cap:1e10},
 {...demoRows[0],id:'US:NVDA',market:'US',ticker:'NVDA',name:'NVIDIA Corporation',price:1091.67,asset_class:'Equity',leadership_class:'핵심 주도',market_cap:1e10},
 {...demoRows[0],id:'KR:379810',market:'KR',ticker:'379810',name:'KODEX 미국나스닥100TR',price:175000,asset_class:'ETF',etf_rs_rank:99,market_cap:1e10}
]
const screens=[['phone',390,844],['small-phone',320,568],['ipad',834,1194],['ipad-pro',1024,1366],['desktop',1440,900]] as const
for(const [device,width,height] of screens)for(const theme of ['light','dark'])test(`${device} ${theme}: readable KR/US/ETF cards and glass tracking across orientations`,async({page})=>{
 await page.addInitScript(t=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-theme',t);localStorage.setItem('folio-stock-size','all')},theme)
 await page.route('**/data/leaderboard.json',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:Object.fromEntries(rows.map(row=>[row.id,Array.from({length:21},(_,i)=>['2026-09-'+String(i+1).padStart(2,'0'),100+i])]))}}))
 await page.setViewportSize({width,height});await page.goto('/peppercorn/');await openPage(page,'시장 요약')
 for(const [w,h] of [[width,height],[height,width]]){
  await page.setViewportSize({width:w,height:h});await openPage(page,'탐색')
  const core=page.locator('.analysis-scope button').first()
  if(await core.getAttribute('aria-pressed')==='true')await core.click()
  const list=page.locator('.analysis-idea-list')
  await expect(list.locator('.stock-trend-row')).toHaveCount(3)
  await expect(page.locator('.stock-avatar')).toHaveCount(0)
  for(const row of rows){
   const card=list.getByRole('listitem',{name:row.name+' 종목 상세 보기'})
   await expect(card.locator('.stock-trend-copy>b')).toHaveText(row.market==='KR'?row.name:row.ticker)
   await expect(card.locator('.stock-trend-copy>small')).toHaveText(row.market==='KR'?row.ticker:row.name)
   expect(parseFloat(await card.locator('.stock-trend-copy>b').evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(20)
   expect(parseFloat(await card.locator('.stock-trend-price>b').evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(18)
   expect(await card.evaluate(e=>{const b=e.getBoundingClientRect();return [...e.children].every(c=>{const r=c.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1})})).toBe(true)
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  if(device==='phone'&&w===width&&theme==='light')await page.screenshot({path:'test-results/stock-cards-phone.png',fullPage:true})
  await openPage(page,'추적')
  const tabs=page.getByRole('tablist',{name:'추적 영역'})
  await expect(tabs).toHaveCSS('border-bottom-width','0px')
  await expect(tabs).toHaveCSS('gap','8px')
  for(const name of ['회고','관심종목','보유종목','투자일지']){
   const tab=tabs.getByRole('tab',{name});await tab.click()
   await expect(tab).toHaveAttribute('aria-selected','true')
   await expect(tab).toHaveCSS('border-top-width','0px')
   await expect(tab).toHaveCSS('border-radius','24px')
   await expect(tab).toHaveCSS('backdrop-filter','blur(18px) saturate(1.22)')
   expect(await tab.evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('linear-gradient')
   expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }
})
