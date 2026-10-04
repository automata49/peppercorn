import {test,expect,type Page} from '@playwright/test'\nimport {draftFromCaptureMessage,saveToPepperBookmarklet} from '../src/lib/research'

const token='x.'+btoa(JSON.stringify({sub:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'})).replace(/=/g,'')+'.x'
const session={access_token:token,refresh_token:'r',expires_at:4102444800,user:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',email:'owner@example.com'}}
const feed={id:'11111111-1111-1111-1111-111111111111',source:'telegram',source_key:'hs_academy',external_id:'123',source_url:'https://t.me/HS_academy/123',linked_url:'https://contents.premium.naver.com/hsacademy/hsacademy1/contents/261003083419860vz',linked_type:'naver_premium',title:'모닝효 테스트',excerpt:'공개 Telegram 미리보기',published_at:'2026-10-03T00:34:19Z',discovered_at:'2026-10-03T00:35:00Z'}
async function goTemperature(page:Page){
  const side=page.locator('.sidebar nav')
  if(await side.isVisible())await side.getByRole('button',{name:'시장 온도계'}).click()
  else{await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click();await page.locator('.menu-drawer').getByRole('button',{name:'시장 온도계'}).click()}
}
async function prepare(page:Page){
  await page.addInitScript(s=>localStorage.setItem('peppercorn-session',JSON.stringify(s)),session)
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/price-history?*',route=>route.fulfill({json:{series:{}}}))
  await page.route('**/functions/v1/workspace?*',route=>route.fulfill({json:{rows:[]}}))
}

test('External Research shows public discovery and saves only user supplied body',async({page})=>{
  await prepare(page)
  let post:any=null
  await page.route('**/functions/v1/research-capture*',async route=>{
    const req=route.request()
    if(req.method()==='GET')return route.fulfill({json:{feed:[feed],captures:[]}})
    if(req.method()==='POST'){post=req.postDataJSON();return route.fulfill({json:{ok:true,capture:{id:'22222222-2222-2222-2222-222222222222',feed_item_id:post.feed_item_id||null,source_url:post.source_url,title:post.title,source_type:'naver_premium',captured_text:post.captured_text,content_hash:'a'.repeat(64),analysis_status:'provider_unavailable',analysis:null,captured_at:'2026-10-04T00:00:00Z',updated_at:'2026-10-04T00:00:00Z'}})}
    return route.fulfill({json:{ok:true}})
  })
  await page.goto('/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await goTemperature(page)
  const inbox=page.locator('.research-inbox')
  await expect(inbox).toBeVisible()
  await expect(inbox).toContainText('모닝효 테스트')
  await expect(inbox).toContainText('구독 본문은 서버가 크롤링하지 않고')
  await inbox.getByRole('button',{name:'본문 붙여넣기 준비'}).click()
  await inbox.getByRole('textbox',{name:'External Research 본문 텍스트'}).fill('내가 구독 페이지에서 직접 읽고 넘긴 본문입니다.')
  await inbox.getByRole('button',{name:'Research 저장'}).click()
  await expect(inbox).toContainText('저장 완료')
  expect(post.source_url).toContain('contents.premium.naver.com')
  expect(post.captured_text).toBe('내가 구독 페이지에서 직접 읽고 넘긴 본문입니다.')
  await expect(inbox.locator('.research-capture-item')).toContainText('AI 미연결')
})

test('Save to Pepper handoff validates sender origin and auto-saves after login',async({page})=>{
  expect(draftFromCaptureMessage({type:'pepper-capture',payload:{url:'https://contents.premium.naver.com/test',title:'x',text:'body'}},'https://evil.example')).toBeNull()
  expect(saveToPepperBookmarklet('https://automata49.github.io/peppercorn/')).toContain('postMessage')
  await prepare(page)
  const body='브라우저에서 직접 캡처한 프리미엄 본문'
  let posted:any=null
  await page.route('**/functions/v1/research-capture*',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{feed:[],captures:[]}})
    if(route.request().method()==='POST'){posted=route.request().postDataJSON();return route.fulfill({json:{ok:true,capture:{id:'33333333-3333-3333-3333-333333333333',feed_item_id:null,source_url:posted.source_url,title:posted.title,source_type:'naver_premium',captured_text:posted.captured_text,content_hash:'b'.repeat(64),analysis_status:'provider_unavailable',analysis:null,captured_at:'2026-10-04T00:00:00Z',updated_at:'2026-10-04T00:00:00Z'}})}
    return route.fulfill({json:{ok:true}})
  })
  await page.goto('/peppercorn/?capture=1')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await expect(page.locator('.research-inbox')).toBeVisible()
  await page.evaluate(({body})=>window.dispatchEvent(new MessageEvent('message',{origin:'https://contents.premium.naver.com',data:{type:'pepper-capture',payload:{url:'https://contents.premium.naver.com/test',title:'캡처 제목',text:body}}})),{body})
  await expect(page.locator('.research-inbox')).toContainText('저장 완료',{timeout:10000})
  expect(posted.captured_text).toBe(body)
  expect(page.url()).not.toContain('capture=1')
})
