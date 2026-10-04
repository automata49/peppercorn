import {test,expect,type Page} from '@playwright/test'

const base={asset_class:'Equity',sector:'Information Technology',industry:'Semiconductors',exchange:'NASDAQ',index_memberships:[],price:100,verdict:'관찰',stage:'▲ 돌파',action_guide:'테스트',return_1w:.01,return_1m:.02,return_3m:.03,return_6m:.04,return_12m:.05,return_5d:.01,return_20d:.02,return_50d:.03,return_120d:.04,return_200d:.05,rs_1w:.01,rs_1m:.02,rs_3m:.03,rs_6m:.04,rs_12m:.05,rs_5d:.01,rs_20d:.02,rs_50d:.03,rs_120d:.04,rs_200d:.05,rs_rank:80,high_52w_distance:-.1,volume_ratio:1,adr20_pct:.02,rsi14:60,atr_multiple:1.2,ma50:90,ma200:80,leader_tt:true}
const rows=[
  {...base,id:'us-aapl',market:'US',ticker:'AAPL',name:'Apple',price:341.07,rs_rank:75,industry:'Consumer Electronics'},
  {...base,id:'us-adi',market:'US',ticker:'ADI',name:'Analog Devices',price:393.6,rs_rank:69},
  {...base,id:'us-aem',market:'US',ticker:'AEM',name:'Agnico Eagle Mines',price:194.48,rs_rank:58,sector:'Materials',industry:'Gold Mining'},
  {...base,id:'kr-000660',market:'KR',ticker:'000660',name:'SK하이닉스',exchange:'KOSPI',price:298000,rs_rank:91},
]

async function mock(page:Page){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/price-history?*',route=>route.fulfill({json:{series:{}}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{AAPL:{price:350,time:null,previous_close:340,currency:'USD'}},failed:[]}}))
}

test('phone Watchlist is decision-first and keeps editing secondary',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  await mock(page)
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'관심'}).click()
  await expect(page.locator('.watchlist-page-note')).toBeHidden()
  const list=page.locator('.watch-decision-list')
  await expect(list.locator('.decision-row')).toHaveCount(4)
  await expect(list.locator('.decision-main>b').first()).toHaveText('Apple')
  await expect(list.locator('.decision-badge').first()).toHaveText('A')
  await expect(list.locator('.decision-value>small').first()).toHaveText('RS 75')
  await expect(list.locator('.decision-value>b').first()).toHaveText('350')
  const edit=page.locator('.workspace-edit-disclosure')
  await expect(edit).not.toHaveAttribute('open','')
  await edit.locator(':scope > summary').click()
  await expect(edit).toHaveAttribute('open','')
  await expect(edit.locator('.ag-root')).toBeVisible()
  await edit.locator(':scope > summary').click()
  await list.locator('.decision-row').first().click()
  await expect(page.locator('.analysis-body .hero-name')).toContainText('Apple')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()
  await context.close()
})

test('desktop Watchlist keeps the full editable grid primary',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  await mock(page)
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await page.locator('.sidebar nav').getByRole('button',{name:'Watchlist'}).click()
  await expect(page.locator('.watch-mobile-panel')).toBeHidden()
  const edit=page.locator('.workspace-edit-disclosure')
  await expect(edit).toHaveAttribute('open','')
  await expect(edit.locator(':scope > summary')).toBeHidden()
  await expect(edit.locator('.ag-root')).toBeVisible()
})
