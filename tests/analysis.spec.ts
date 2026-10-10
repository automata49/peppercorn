import {openPage} from './journey-helpers'
import {backToExplore,pickFirstStock} from './journey-helpers'
import {test,expect,type Page} from '@playwright/test'
const rows=Array.from({length:20},(_,i)=>({id:String(i),ticker:'TEST'+i,market:i%2?'KR':'US',name:'검증 종목 '+i,asset_class:'Equity',sector:'Technology',industry:'Semiconductors',exchange:i%2?'KOSPI':'NASDAQ',index_memberships:[],price:100,rs_rank:99-i,ibd_rs_estimate:95,high_52w_distance:-.1,leader_tt:true,leadership_class:i<10?'핵심 주도':'중립',stage:'▲ 돌파',rs_3m:.1,rs_6m:.2,rs_5d:.01,rs_20d:.02,rs_50d:.03,rs_120d:.04,rs_200d:.05,rs_12m:.06,ma50:90,ma200:80,return_5d:.01,return_20d:.02,return_50d:.03,return_120d:.04,return_200d:.05,return_12m:.06,action_guide:'테스트 전용'}))
const metrics=(over:Record<string,unknown>={})=>({as_of:'2026-06-30',ttm_revenue:5e10,ttm_operating_income:1e10,ttm_net_income:8e9,ttm_fcf:6e9,ttm_operating_cash_flow:9e9,revenue_yoy:.2,revenue_yoy_q:.25,revenue_cagr_3y:.18,net_income_cagr_3y:.2,gross_margin:.5,operating_margin:.2,fcf_margin:.12,roic:.22,roic_method:'US-ROIC-2',roe:.3,net_debt:-1e9,debt_ratio:.4,eps_ttm:5,eps_yoy_q:.3,eps_cagr_3y:.2,diluted_shares_latest:1.6e9,shares_common:null,shares_preferred:null,dilution_yoy:0,...over})
const noLabels={type:null,quality:null,growth:null,value:null}
const position=[
  {market:'US',ticker:'TEST0',as_of:'2026-06-30',status:'unavailable',rules_version:'uncalibrated',methods:{fcf:'US-FCF-1',roic:'US-ROIC-2'},failed_checks:[],metrics:metrics(),labels:noLabels,label_reasons:{},computed_at:'2026-09-30T02:00:00Z'},
  {market:'KR',ticker:'TEST1',as_of:'2026-06-30',status:'check_failed',rules_version:'uncalibrated',methods:{fcf:'KR-FCF-PPE-2',roic:'KR-ROIC-1'},failed_checks:[['분기 연속성 (최근 16분기)','공백 1곳']],metrics:metrics({eps_ttm:null,debt_ratio:null}),labels:noLabels,label_reasons:{},computed_at:'2026-09-30T02:00:00Z'},
]
async function openAnalysis(page:Page){
  const side=page.locator('.sidebar nav').getByRole('button',{name:'발견',exact:true})
  if(await side.isVisible()){await side.click();return}
  const bottom=page.locator('.mobile-bottom-nav').getByRole('button',{name:'발견',exact:true})
  if(await bottom.isVisible()){await bottom.click();return}
  await page.getByRole('button',{name:/메뉴 열기/}).first().click()
  await page.locator('.menu-drawer').getByRole('button',{name:'발견',exact:true}).click()
}
for(const view of [{name:'phone',width:390,height:844,touch:true},{name:'ipad-portrait',width:834,height:1194,touch:true},{name:'ipad-landscape',width:1194,height:834,touch:true},{name:'ipad-pro',width:1366,height:1024,touch:true},{name:'desktop',width:1440,height:900,touch:false}]){
 test(view.name+' stock analysis shows Analysis, Financials and Thesis',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:position}}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await openAnalysis(page)
  const browse=page.locator('.analysis-browse')
  const list=page.locator('.stock-list')
  await expect(list.locator('> button')).toHaveCount(10)
  const scope=browse.getByRole('group',{name:'주도 분류'})
  await expect(scope.getByRole('button')).toHaveText(['핵심 주도','주도 후보','강세 전환','조정 중'])
  await expect(scope.getByRole('button',{name:'Position'})).toHaveCount(0)
  await scope.getByRole('button',{name:'핵심 주도',exact:true}).click()
  await expect(list.locator('> button')).toHaveCount(20)
  await scope.getByRole('button',{name:'핵심 주도',exact:true}).click()
  await list.locator('> button').filter({hasText:'TEST0'}).click()
  const card=page.locator('.analysis-body')
  await card.getByRole('tab',{name:'Financials'}).click()
  const panel=card.locator('.position-panel')
  await expect(panel.locator('.position-status')).toHaveText('라벨 검증 중')
  await expect(panel.locator('.position-label-card strong')).toHaveText(['검증 중','검증 중','검증 중','검증 중'])
  const fact=(label:string)=>panel.locator('.position-facts > div').filter({hasText:label}).locator('strong')
  await expect(fact('PER (현재가/EPS)')).toHaveText('20.0배')
  await expect(fact('PEG')).toHaveText('1.00')
  await expect(fact('부채비율 (부채/자본)')).toHaveText('40.0%')
  await expect(fact('분기 매출 성장 (YoY)')).toHaveText('+25.0%')
  await expect(panel).toContainText('SEC 공시 · 기준 분기 2026-06-30')
  await panel.screenshot({path:`test-results/analysis-position-${view.name}.png`})
  await backToExplore(page);await list.locator('> button').filter({hasText:'TEST1'}).click();await card.getByRole('tab',{name:'Financials'}).click()
  await expect(panel.locator('.position-alert')).toContainText('분기 연속성')
  await expect(panel.locator('.position-label-card strong')).toHaveText(['—','—','—','—'])
  await expect(fact('PER (현재가/EPS)')).toHaveText('—')
  await backToExplore(page);await list.locator('> button').filter({hasText:'TEST2'}).click();await card.getByRole('tab',{name:'Financials'}).click()
  await expect(card.locator('.position-empty')).toContainText('아직 적재되지 않은 종목')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy()
  await page.screenshot({path:`test-results/analysis-${view.name}.png`,fullPage:true})
  await context.close()
 })
}

test('stock analysis survives a failed fundamentals load',async({page})=>{
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({status:502,json:{error:'read_failed'}}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await openAnalysis(page)
  await pickFirstStock(page)
  const card=page.locator('.analysis-card')
  await card.getByRole('tab',{name:'Financials'}).click()
  await expect(card.locator('.position-empty')).toContainText('불러오지 못했습니다')
  await expect(card.locator('.checklist')).toHaveCount(0)
  await card.getByRole('tab',{name:'Analysis'}).click()
  await expect(card.locator('.checklist')).toBeVisible()
})
