import {test,expect} from '@playwright/test'
const base={asset_class:'Equity',sector:'Technology',industry:'Semiconductors',index_memberships:[],rs_rank:99,ibd_rs_estimate:95,high_52w_distance:-.05,leader_tt:true,leadership_class:'핵심 주도',stage:'▲ 돌파',rs_1m:.05,rs_3m:.1,rs_6m:.2,rs_12m:.3,rs_5d:.01,rs_20d:.02,rs_50d:.03,rs_120d:.04,rs_200d:.05,ma50:90,ma200:80,return_5d:.01,return_20d:.02,return_50d:.03,return_120d:.04,return_200d:.05,return_12m:.06,action_guide:'테스트 전용'}
const rows=[
 {...base,id:'1',ticker:'NVDA',market:'US',name:'엔비디아',exchange:'NASDAQ',price:100},
 {...base,id:'2',ticker:'247540',market:'KR',name:'에코프로비엠',exchange:'KOSDAQ',price:200000,rs_rank:98},
]
test('current price refreshes from live quotes without touching daily metrics',async({page})=>{
 const requested:string[]=[]
 let nvda=123.45
 await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
 await page.route('**/functions/v1/quotes?*',route=>{
  const symbols=new URL(route.request().url()).searchParams.get('symbols')||''
  requested.push(symbols)
  const quotes:Record<string,unknown>={}
  if(symbols.includes('NVDA'))quotes.NVDA={price:nvda,time:Date.UTC(2026,8,30,14,31),previous_close:120,currency:'USD'}
  if(symbols.includes('247540.KQ'))quotes['247540.KQ']={price:210500,time:Date.UTC(2026,8,30,5,0),previous_close:200000,currency:'KRW'}
  return route.fulfill({json:{as_of:new Date().toISOString(),quotes,failed:[]}})
 })
 await page.clock.install()
 await page.goto('http://127.0.0.1:4173/peppercorn/')
 await page.clock.runFor(6000)
 await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
 await page.clock.runFor(1000)
 // Leading stocks now open in a popup; the 핵심 주도 card lists both markets.
 await page.locator('.leadership-card-grid button').filter({hasText:'핵심 주도'}).click()
 await page.clock.runFor(1000)
 const nvdaRow=page.locator('.stock-row').filter({hasText:'엔비디아'}).first()
 await expect(nvdaRow.locator('.stock-price')).toHaveText('123.45')
 await expect(nvdaRow.locator('.stock-price')).toHaveClass(/live-price/)
 // 현재가 등락: live price against the previous close.
 await expect(nvdaRow.locator('.live-change')).toHaveText('+2.9%')
 await expect(page.locator('.stock-row').filter({hasText:'에코프로비엠'}).first().locator('.stock-price')).toHaveText('210,500')
 expect(requested.some(s=>s.includes('247540.KQ'))).toBe(true)
 // Daily metrics stay: the 5D return cell is unchanged.
 await expect(nvdaRow.locator('span').last()).toHaveText('-5.0%')
 // The next 30-second poll picks up a new price.
 nvda=130
 await page.clock.runFor(31_000)
 await expect(nvdaRow.locator('.stock-price')).toHaveText('130')
 await nvdaRow.click()
 await expect(page.locator('.live-badge').first()).toContainText('실시간')
})

test('stock detail links to Finviz for US tickers and no longer to the Google Sheet',async({page})=>{
 await page.setViewportSize({width:1440,height:900})
 await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[{...rows[0],ticker:'MU',name:'마이크론'},rows[1],{...rows[0],id:'3',ticker:'CRAK',name:'정유 ETF',asset_class:'ETF',leadership_class:'해당 없음'}]}}))
 await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{},failed:[]}}))
 await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
 await page.goto('http://127.0.0.1:4173/peppercorn/')
 await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
 await page.locator('.sidebar nav').getByRole('button',{name:'종목 분석'}).click()
 await page.locator('.analysis-browse > summary').click()
 const list=page.locator('.stock-list')
 await page.locator('.analysis-browse').getByRole('tab',{name:'전체'}).click()
 const finviz=page.locator('.external-links').first().getByRole('link',{name:'Finviz ↗'})
 await list.locator('> button').filter({hasText:'MU'}).click()
 await expect(finviz).toHaveAttribute('href','https://finviz.com/stock?t=MU&p=d')
 await expect(page.getByRole('link',{name:/Google Sheet/})).toHaveCount(0)
 await list.locator('> button').filter({hasText:'CRAK'}).click()
 await expect(finviz).toHaveAttribute('href','https://finviz.com/stock?t=CRAK&ty=c&ta=1&p=d')
 await list.locator('> button').filter({hasText:'247540'}).click()
 await expect(finviz).toHaveCount(0)
})

test('주도 종목 현재가 기준 orders leaders by live change',async({page})=>{
 await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
 await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{as_of:new Date().toISOString(),failed:[],quotes:{
  NVDA:{price:123,time:null,previous_close:120,currency:'USD'},'247540.KQ':{price:210000,time:null,previous_close:200000,currency:'KRW'}}}}))
 await page.goto('http://127.0.0.1:4173/peppercorn/')
 await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
 const basis=page.locator('.leader-basis button')
 await expect(basis).toHaveText(['종가 기준','현재가 기준'])
 await expect(page.locator('.leadership-card-grid')).toBeVisible()
 await basis.nth(1).click()
 await expect(page.locator('.leadership-card-grid')).toHaveCount(0)
 const list=page.locator('.live-leaders .stock-row')
 await expect(list.locator('.live-change')).toHaveText(['+5.0%','+2.5%'])
 await expect(list.locator('.stock-id b')).toHaveText(['에코프로비엠','엔비디아'])
 await expect(page.locator('.live-leaders-note')).toContainText('시세 2/2')
 await basis.nth(0).click()
 await expect(page.locator('.leadership-card-grid')).toBeVisible()
})
