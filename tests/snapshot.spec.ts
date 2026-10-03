import {test,expect,type Page} from '@playwright/test'
test.use({viewport:{width:1440,height:900}})
// LEADERBOARD-STATIC-1: scheduled loads read data/leaderboard.json; stale or missing snapshots and manual refresh use the function.
const row=(ticker:string)=>({id:ticker,ticker,market:'US',name:'스냅샷 '+ticker,asset_class:'Equity',sector:'Technology',industry:'Semiconductors',exchange:'NASDAQ',index_memberships:[],price:100,rs_rank:99,ibd_rs_estimate:95,high_52w_distance:-.05,leader_tt:true,leadership_class:'핵심 주도',stage:'▲ 돌파 매수권',rs_3m:.1,rs_6m:.1,ma50:90,ma200:80,action_guide:'테스트'})
async function setup(page:Page,snapshot:{status:number;age_h?:number}){
  const calls={live:0,snapshot:0}
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/price-history?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/leaderboard?*',route=>{calls.live++;return route.fulfill({json:{rows:[row('LIVE')]}})})
  await page.route('**/data/leaderboard.json',route=>{calls.snapshot++
    if(snapshot.status!==200)return route.fulfill({status:snapshot.status,body:'not found'})
    return route.fulfill({json:{published_at:new Date(Date.now()-(snapshot.age_h??1)*3600_000).toISOString(),rows:[row('SNAP')]}})})
  await page.goto('/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await page.locator('.sidebar nav').getByRole('button',{name:'종목 분석'}).click()
  return calls
}
test('fresh snapshot is used without calling the live function',async({page})=>{
  const calls=await setup(page,{status:200,age_h:2})
  await expect(page.locator('.stock-list > button b').first()).toContainText('SNAP')
  expect(calls).toEqual({live:0,snapshot:1})
  await page.getByRole('button',{name:'시장 데이터 새로고침'}).click()
  await expect(page.locator('.stock-list > button b').first()).toContainText('LIVE')
  expect(calls.live).toBe(1)
})
test('stale or missing snapshot falls back to the live function',async({page})=>{
  const stale=await setup(page,{status:200,age_h:30})
  await expect(page.locator('.stock-list > button b').first()).toContainText('LIVE')
  expect(stale.live).toBe(1)
})
test('missing snapshot falls back to the live function',async({page})=>{
  const missing=await setup(page,{status:404})
  await expect(page.locator('.stock-list > button b').first()).toContainText('LIVE')
  expect(missing.live).toBe(1)
})
