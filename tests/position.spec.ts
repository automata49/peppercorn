import {test,expect} from '@playwright/test'
const row={id:'1',ticker:'NVDA',market:'US',name:'엔비디아',asset_class:'Equity',sector:'Technology',industry:'Semiconductors',exchange:'NASDAQ',index_memberships:[],price:100,rs_rank:99,ibd_rs_estimate:95,high_52w_distance:-.05,leader_tt:true,leadership_class:'핵심 주도',stage:'▲ 돌파',rs_3m:.1,rs_6m:.2,ma50:90,ma200:80,action_guide:'테스트 전용'}
const other={...row,id:'2',ticker:'AAPL',name:'애플',rs_rank:90}
const snapshot={as_of:'2026-07-26',status:'unavailable',rules_version:'unavailable-v1',fcf_method:'US-FCF-1',roic_method:'US-ROIC-2',
 checks:[['분기 연속성',true,''],['공시 식별',true,''],['최신성',true,'']],
 metrics:{roic:.812,incremental_roic:1.2,roe:.95,operating_margin:.62,gross_margin:.75,fcf_margin:.48,fcf_conversion:.9,revenue_yoy:.56,revenue_cagr_3y:.9,net_income_cagr_3y:null,dilution_yoy:-.004,ttm_revenue:187.1e9,ttm_operating_income:116e9,ttm_net_income:99e9,ttm_fcf:90e9,owner_earnings:84e9,net_debt:-50e9,roic_lease_basis:'included'},
 type_label:null,quality_label:null,growth_label:null,value_label:null,label_reasons:{},pipeline_version:'persist-v3',computed_at:'2026-09-30T06:01:00Z'}
const facts={reported:292,unknown:8,first_period:'2008-04-27',last_period:'2026-07-26',latest_filed:'2026-08-27',sources:['SEC'],collected_at:'2026-09-30T06:01:00Z'}
for(const view of [{name:'phone',width:390,height:844,touch:true},{name:'desktop',width:1440,height:900,touch:false}]){
 test(view.name+' 종목 분석 Swing and Position sections',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[row,other]}}))
  const asked:string[]=[]
  await page.route('**/functions/v1/position-read?*',route=>{
   const url=new URL(route.request().url());asked.push(url.searchParams.get('market')+':'+url.searchParams.get('ticker'))
   if(url.searchParams.get('ticker')==='NVDA')return route.fulfill({json:{ok:true,market:'US',ticker:'NVDA',instrument:true,snapshot,facts}})
   return route.fulfill({json:{ok:true,market:'US',ticker:'AAPL',instrument:true,snapshot:null,facts:null}})
  })
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await page.evaluate(()=>{(document.querySelector('.sidebar nav button:nth-child(3)') as HTMLButtonElement)?.click()})
  await expect(page.locator('.topbar h1')).toHaveText('종목 분석')
  await page.locator('.stock-list button').filter({hasText:'엔비디아'}).click()
  const tabs=page.getByRole('tab')
  await expect(tabs).toHaveText(['Swing','Position'])
  await expect(page.getByRole('tabpanel',{name:'Swing'}).locator('.action-box')).toBeVisible()
  await tabs.nth(1).click()
  const panel=page.getByRole('tabpanel',{name:'Position'})
  await expect(panel.locator('.position-head h3')).toHaveText('2026-07-26 분기 기준')
  await expect(panel.locator('.position-head .pill')).toHaveText('라벨 비활성')
  // Labels stay hidden until a validated rule set exists; no placeholder verdicts.
  await expect(panel.locator('.position-label strong')).toHaveText(['—','—','—','—'])
  await expect(panel.locator('.position-note')).toContainText('라벨을 표시하지 않습니다')
  const metric=(label:string)=>panel.locator('.position-metric').filter({has:page.getByText(label,{exact:true})}).locator('strong')
  await expect(metric('ROIC')).toHaveText('+81.2%')
  await expect(metric('순이익 3Y CAGR')).toHaveText('—')
  await expect(metric('매출')).toHaveText('$187.1B')
  await expect(metric('순부채')).toHaveText('-$50.0B')
  await expect(panel.locator('.position-meta')).toContainText('점검 3/3 통과')
  await expect(panel.locator('.position-meta')).toContainText('공시 사실 292건')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()
  if(view.width<700){const b=await panel.locator('.position-label').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y));expect(b[0]).toBe(b[1]);expect(b[2]).toBeGreaterThan(b[0])}
  await page.locator('.stock-list button').filter({hasText:'애플'}).click()
  await expect(panel.locator('.position-empty')).toContainText('아직 Position 수집 대상이 아닙니다')
  expect(asked).toEqual(['US:NVDA','US:AAPL'])
  await context.close()
 })
}
test('Position section recovers from a failed read',async({page})=>{
 await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[row]}}))
 let calls=0
 await page.route('**/functions/v1/position-read?*',route=>{calls++;return calls===1?route.fulfill({status:502,json:{error:'read_failed'}}):route.fulfill({json:{ok:true,instrument:true,snapshot,facts}})})
 await page.goto('http://127.0.0.1:4173/peppercorn/')
 await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
 await page.locator('.sidebar nav').getByRole('button',{name:'종목 분석'}).click()
 await page.locator('.stock-list button').first().click()
 await page.getByRole('tab',{name:'Position'}).click()
 await expect(page.locator('.position-empty')).toContainText('불러오지 못했습니다')
 await page.getByRole('button',{name:'다시 시도'}).click()
 await expect(page.locator('.position-head .pill')).toHaveText('라벨 비활성')
})
