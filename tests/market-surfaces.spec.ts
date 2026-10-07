import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {heatColor} from '../src/lib/marketColors'
import {openPage,backToExplore} from './journey-helpers'
const rows=(['KR','US'] as const).flatMap(m=>[.1,-.1,0].map((v,i)=>({...demoRows[0],id:m+'-'+i,market:m,ticker:m+['UP','DOWN','ZERO'][i],name:m+' '+['상승','하락','보합'][i],asset_class:'Equity',leadership_class:'핵심 주도',rs_rank:99-i,return_20d:v,return_50d:v,high_52w_distance:-.1,market_cap:1e10,traded_value_20d:1e8})))
const rgb=(hex:string)=>'rgb('+hex.slice(1).match(/../g)!.map(h=>parseInt(h,16)).join(', ')+')'
test('signed heatmap colours use the instrument market, zero/missing remain neutral',()=>{
 expect(heatColor(.1,[.02,.06],'KR').bg).toBe('#b3261e');expect(heatColor(-.1,[.02,.06],'KR').bg).toBe('#1c5cab')
 expect(heatColor(.1,[.02,.06],'US').bg).toBe('#196b42');expect(heatColor(-.1,[.02,.06],'US').bg).toBe('#b3261e')
 expect(heatColor(0,[.02,.06],'KR')).toEqual(heatColor(0,[.02,.06],'US'))
 expect(heatColor(null,[.02,.06],'KR')).toEqual(heatColor(null,[.02,.06],'US'))
})
for(const width of [390,834,1366,1440])for(const theme of ['light','dark'] as const)test(`${width} ${theme}: market colours, shared glass regions and unboxed metrics`,async({page})=>{
 await page.setViewportSize({width,height:1000})
 await page.addInitScript(t=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-stock-size','all');localStorage.setItem('folio-theme',t)},theme)
 await page.route('**/data/leaderboard.json',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>{const ids=new URL(r.request().url()).searchParams.get('ids')!.split(',');return r.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,Array.from({length:21},(_,i)=>['2026-09-'+String(i+1).padStart(2,'0'),id.endsWith('-1')?120-i:100+i])]))}})})
 await page.goto('/peppercorn/');await expect(page.locator('.journey-home')).toBeVisible()
 for(const selector of ['.journey-market','.journey-today','.journey-insight','.journey-classes button']){
  for(const el of await page.locator(selector).all()){await expect(el).toHaveCSS('backdrop-filter','blur(18px) saturate(1.22)')
  expect(await el.evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('linear-gradient')
  expect(parseFloat(await el.evaluate(e=>getComputedStyle(e).borderRadius))).toBeGreaterThan(20)
  }
 }
 if(width===390)await page.screenshot({path:`test-results/market-pebble-${theme}.png`})
 await openPage(page,'탐색')
 await expect(page.locator('.analysis-idea-list > button')).toHaveCount(6)
 const colors=theme==='dark'?{KR:['#ff8580','#78b4ff'],US:['#72d5a2','#ff8580']}:{KR:['#b3261e','#1c5cab'],US:['#196b42','#b3261e']}
 for(const m of ['KR','US'] as const){
  for(const [i,name] of ['UP','DOWN'].entries()){
   const row=page.locator('.analysis-idea-list .stock-trend-row').filter({hasText:m+name})
   await expect(row.locator('.stock-trend-price>small')).toHaveCSS('color',rgb(colors[m][i]))
   await expect(row.locator('svg')).toHaveCSS('color',rgb(colors[m][i]))
  }
  await page.locator('.analysis-idea-list .stock-trend-row').filter({hasText:m+'DOWN'}).click()
  await page.locator('.analysis-detail-tabs').getByRole('tab',{name:'Analysis',exact:true}).click()
  const strip=page.locator('.stock-snapshot .signal-strip').last()
  await expect(strip.locator('.neg').first()).toHaveCSS('color',rgb(colors[m][1]))
  await expect(strip.locator('>div').first()).toHaveCSS('border-top-width','0px')
  await expect(strip.locator('>div').first()).toHaveCSS('box-shadow','none')
  await backToExplore(page)
 }
 await openPage(page,'홈');await page.locator('.journey-market').getByRole('button',{name:'전체 보기 →'}).click()
 await expect(page.locator('.signal-journey-heading h2')).toHaveText('시장 신호')
 await expect(page.locator('.dashboard-explore-expanded')).toBeVisible()
 await page.locator('.market-metrics-trigger').click()
 const dialog=page.locator('.market-metrics-dialog')
 await expect(dialog).toBeVisible()
 await expect(dialog).toHaveCSS('backdrop-filter','blur(18px) saturate(1.22)')
 for(const metric of await dialog.locator('.market-metric-card').all()){
  await expect(metric).toHaveCSS('border-top-width','0px')
  await expect(metric).toHaveCSS('box-shadow','none')
  await expect(metric).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
 }
 await page.keyboard.press('Escape')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})
