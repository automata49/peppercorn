import { test, expect, type Page } from '@playwright/test'

const userSession={access_token:'test.token.value',refresh_token:'refresh',expires_at:4102444800,user:{id:'test-user'}}
const marketRow={id:'a',market:'US',ticker:'TEST',name:'Test',asset_class:'Equity',sector:'Technology',industry:'Software',price:100,verdict:'중립',stage:'■ 베이스 형성',action_guide:'',return_1w:.01,return_1m:.02,return_3m:.03,return_6m:.04,return_12m:.05,rs_1w:.01,rs_1m:.02,rs_3m:.03,rs_6m:.04,rs_12m:.05,rs_rank:80,high_52w_distance:-.1,volume_ratio:1,adr20_pct:.02,rsi14:55,atr_multiple:1,ma50:95,ma200:90,leader_tt:true}

async function openTemperature(page:Page){
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  const nav=page.locator('.sidebar nav')
  if(await nav.isVisible())await nav.getByRole('button',{name:'시장 온도계'}).click()
  else{await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click();await page.locator('.menu-drawer').getByRole('button',{name:'시장 온도계'}).click()}
}

test('Research Inbox accepts a same-origin source message and saves it',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  await context.addInitScript((s)=>{localStorage.setItem('peppercorn-session',JSON.stringify(s));sessionStorage.setItem('peppercorn-intro-seen','1')},userSession)
  const page=await context.newPage()
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[marketRow]}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/workspace?*',route=>route.fulfill({json:{rows:[]}}))
  let saved:any
  await page.route('**/functions/v1/research-ingest',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{rows:[]}})
    saved=route.request().postDataJSON()
    return route.fulfill({json:{ok:true,row:{id:'r1',captured_at:'2026-10-04T05:00:00Z',created_at:'2026-10-04T05:00:00Z',updated_at:'2026-10-04T05:00:00Z',analysis_status:'provider_unavailable',analysis:null,...saved}}})
  })
  await page.goto('./')
  await openTemperature(page)
  await expect(page.getByRole('heading',{name:'Research Inbox'})).toBeVisible()
  await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://contents.premium.naver.com',data:{type:'pepper-research-capture-v1',source_url:'https://contents.premium.naver.com/example/channel/contents/123',title:'리서치 테스트',content:'선택한 본문',source_name:'Example',selection:true}})))
  await expect(page.locator('.research-capture-form input').nth(1)).toHaveValue('리서치 테스트')
  await expect(page.locator('.research-capture-form textarea')).toHaveValue('선택한 본문')
  await page.getByRole('button',{name:'Inbox에 저장'}).click()
  await expect.poll(()=>saved?.source_kind).toBe('bookmarklet')
  expect(saved.source_url).toContain('contents.premium.naver.com')
  expect(saved.content).toBe('선택한 본문')
  await context.close()
})
