import {test,expect} from '@playwright/test'

// GOOGLE-LOGIN-1: Google sign-in through Supabase Auth with PKCE; the auth function exchanges the code.
const APP='http://127.0.0.1:4173/peppercorn/'
async function base(page:import('@playwright/test').Page){
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
  await page.route('**/functions/v1/workspace?*',r=>r.fulfill({json:{rows:[]}}))
}

test('Google button sends a PKCE request and the returned code signs in',async({page})=>{
  await base(page)
  let exchange:any=null,authorize:URL|null=null
  await page.route('**/auth/v1/authorize?*',route=>{authorize=new URL(route.request().url());return route.fulfill({status:302,headers:{location:APP+'?code=test-code-123'}})})
  await page.route('**/functions/v1/auth',route=>{exchange=route.request().postDataJSON();return route.fulfill({json:{access_token:'a.b.c',refresh_token:'r',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'u1',email:'owner@example.com'}}})})
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto(APP)
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await page.locator('.top-actions').getByRole('button',{name:'로그인',exact:true}).click()
  await page.getByRole('button',{name:'Google 계정으로 로그인'}).click()
  await expect.poll(()=>exchange).not.toBeNull()
  const u=authorize as unknown as URL
  expect(u.searchParams.get('provider')).toBe('google')
  expect(u.searchParams.get('code_challenge_method')).toBe('s256')
  expect(u.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(u.searchParams.get('redirect_to')).toBe(APP)
  expect(exchange.action).toBe('pkce')
  expect(exchange.auth_code).toBe('test-code-123')
  // The verifier hashes to the challenge sent to Google.
  const challenge=await page.evaluate(async v=>{const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));return btoa(String.fromCharCode(...d)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')},exchange.code_verifier)
  expect(challenge).toBe(u.searchParams.get('code_challenge'))
  await expect(page).toHaveURL(APP)
  await expect(page.locator('.top-actions').getByRole('button',{name:'로그아웃'})).toBeVisible()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-session')||'null')?.user?.email)).toBe('owner@example.com')
  expect(await page.evaluate(()=>sessionStorage.getItem('peppercorn-pkce-verifier'))).toBeNull()
})

test('an unlinked Google account is refused with a reason',async({page})=>{
  await base(page)
  await page.addInitScript(()=>sessionStorage.setItem('peppercorn-pkce-verifier','x'.repeat(64)))
  await page.route('**/functions/v1/auth',route=>route.fulfill({status:403,json:{error:'google_not_linked'}}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto(APP+'?code=other')
  await expect(page.locator('.auth-error')).toContainText('등록된 계정과 연결되어 있지 않습니다')
  await expect(page).toHaveURL(APP)
  expect(await page.evaluate(()=>localStorage.getItem('peppercorn-session'))).toBeNull()
})

test('a Google error in the redirect is shown without a request',async({page})=>{
  await base(page)
  let calls=0
  await page.route('**/functions/v1/auth',route=>{calls++;return route.fulfill({json:{}})})
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto(APP+'?error=access_denied&error_description=Signups+not+allowed+for+this+instance')
  await expect(page.locator('.auth-error')).toContainText('등록된 계정과 연결되어 있지 않습니다')
  await expect(page).toHaveURL(APP)
  expect(calls).toBe(0)
})
