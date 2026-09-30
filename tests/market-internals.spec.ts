import {test,expect} from '@playwright/test'
const base={asset_class:'Equity',sector:'Technology',industry:'Semiconductors',index_memberships:[],rs_rank:80,ibd_rs_estimate:80,leader_tt:false,leadership_class:'중립',stage:'횡보',rs_3m:.01,rs_6m:.01,return_1w:.01,ma50:90,ma200:80,exchange:'NASDAQ'}
// 25 stocks, 8 within 10% of the 52W high (32%); one row has no high history.
const rows=Array.from({length:26},(_,i)=>({...base,id:String(i),ticker:'T'+i,market:'US',name:'종목 '+i,price:100,high_52w_distance:i===25?null:i<8?-.05:-.3}))
for(const view of [{name:'phone',width:390,height:844,touch:true},{name:'ipad-portrait',width:834,height:1194,touch:true},{name:'ipad-landscape',width:1194,height:834,touch:true},{name:'ipad-pro',width:1366,height:1024,touch:true},{name:'desktop',width:1440,height:900,touch:false}]){
 test(view.name+' market metrics popup rows line up and 52W shows a share',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{},failed:[]}}))
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await page.getByRole('button',{name:'시장 지표',exact:true}).click()
  const cards=page.locator('.market-metrics-dialog .market-metric-card')
  await expect(cards).toHaveCount(4)
  const high=cards.filter({hasText:'52W 고점 근접'})
  await expect(high.locator('.market-metric-value')).toHaveText('32%')
  await expect(high.locator('.market-metric-sub')).toHaveText('8 / 25 종목 · 고점 -10% 이내')
  await expect(cards.filter({hasText:'MA50 위 비율'}).locator('.market-metric-sub')).toHaveText('/ 26 종목')
  const boxes=await cards.evaluateAll(es=>es.map(e=>{
   const top=(s:string)=>e.querySelector(s)!.getBoundingClientRect().top
   const v=e.querySelector('.market-metric-value')!.getBoundingClientRect(),d=e.querySelector('.market-metric-sub')!.getBoundingClientRect()
   return {card:e.getBoundingClientRect().top,value:top('.market-metric-value'),sub:d.top,valueBottom:v.bottom,track:top('.market-metric-track'),height:e.getBoundingClientRect().height}
  }))
  for(const b of boxes)expect(b.sub).toBeGreaterThanOrEqual(b.valueBottom-1) // description on its own line
  const rowsOfCards=new Map<number,typeof boxes>()
  for(const b of boxes){const k=Math.round(b.card);rowsOfCards.set(k,[...(rowsOfCards.get(k)||[]),b])}
  for(const group of rowsOfCards.values()){
   for(const key of ['value','sub','track','height'] as const){
    const values=group.map(b=>b[key]);expect(Math.max(...values)-Math.min(...values),key).toBeLessThanOrEqual(1)
   }
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await context.close()
 })
}
