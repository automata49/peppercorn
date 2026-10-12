import {test,expect,type Page} from '@playwright/test'
const APP='/peppercorn/'
const session=(id:string)=>({access_token:id,refresh_token:'refresh-'+id,expires_at:Math.floor(Date.now()/1000)+3600,user:{id,email:id+'@example.com'}})
async function base(page:Page){
 await page.addInitScript(()=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-stock-size','all')})
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
}
async function login(page:Page,id:string){
 await page.locator('.top-actions').getByRole('button',{name:'로그인',exact:true}).click()
 await page.getByLabel('이메일',{exact:true}).fill(id+'@example.com');await page.getByLabel('비밀번호',{exact:true}).fill('test-password')
 await page.locator('.auth-submit').click();await expect(page.locator('.auth-card')).toHaveCount(0)
}
test('public registration needs no setup code and confirmation does not create a session',async({page})=>{
 await base(page);let request:any
 await page.route('**/functions/v1/auth',r=>{request=r.request().postDataJSON();return r.fulfill({json:{confirmation_required:true}})})
 await page.goto(APP);await page.locator('.top-actions').getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('button',{name:'회원가입',exact:true}).click()
 await expect(page.getByText('Setup Code',{exact:true})).toHaveCount(0)
 await page.getByLabel('이메일',{exact:true}).fill('new@example.com');await page.getByLabel('비밀번호',{exact:true}).fill('test-password');await page.getByRole('button',{name:'가입하기',exact:true}).click()
 await expect(page.getByRole('status').filter({hasText:'가입 확인 메일'})).toBeVisible();expect(request).toEqual({action:'signup',email:'new@example.com',password:'test-password'})
 expect(await page.evaluate(()=>localStorage.getItem('peppercorn-session'))).toBeNull();await page.getByRole('button',{name:'닫기',exact:true}).click();await expect(page.locator('.top-actions').getByRole('button',{name:'로그인',exact:true})).toBeVisible()
})
test('email confirmation strips URL tokens and returns to email login',async({page})=>{
 await base(page);await page.goto(APP+'?email-confirmed=1#access_token=must-not-store&refresh_token=must-not-store')
 await expect(page.locator('.auth-info')).toContainText('이메일 확인이 완료');await expect(page).toHaveURL(/\/peppercorn\/$/)
 expect(await page.evaluate(()=>localStorage.getItem('peppercorn-session'))).toBeNull()
})
test('two users never inherit each other or guest records, including failed reads and reload',async({page})=>{
 await base(page)
 await page.addInitScript(()=>localStorage.setItem('peppercorn-analysis',JSON.stringify([{id:'guest-note',ticker:'AAPL',conclusion:'guest private thought'}])))
 await page.route('**/functions/v1/auth',r=>r.fulfill({json:session(r.request().postDataJSON().email.split('@')[0])}))
 let bobFails=true
 await page.route('**/functions/v1/workspace?*',r=>{const id=r.request().headers().authorization?.replace('Bearer ','');const resource=new URL(r.request().url()).searchParams.get('resource');if(id==='bob'&&bobFails)return r.fulfill({status:503,json:{error:'offline'}});return r.fulfill({json:{rows:resource==='analysis'?[{id:id+'-note',ticker:'AAPL',conclusion:id+' private thought'}]:[]}})})
 await page.goto(APP);await login(page,'alice');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-analysis:alice')||'[]')[0]?.conclusion)).toBe('alice private thought')
 await page.locator('.top-actions').getByRole('button',{name:'로그아웃',exact:true}).click();await login(page,'bob');await expect(page.locator('.sync-state')).toContainText('오류')
 await page.getByRole('button',{name:'저널 카드 열기'}).click();await expect(page.getByRole('dialog')).not.toContainText('alice private thought');await expect(page.getByRole('dialog')).not.toContainText('guest private thought');await page.keyboard.press('Escape')
 expect(await page.evaluate(()=>localStorage.getItem('peppercorn-analysis:bob'))).toBeNull()
 await page.reload();await expect(page.locator('.sync-state')).toContainText('오류')
 expect(await page.evaluate(()=>localStorage.getItem('peppercorn-analysis:bob'))).toBeNull()
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-analysis')||'[]')[0]?.conclusion)).toBe('guest private thought')
 bobFails=false;await page.reload();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-analysis:bob')||'[]')[0]?.conclusion)).toBe('bob private thought')
 await page.locator('.top-actions').getByRole('button',{name:'로그아웃',exact:true}).click();await login(page,'alice');await expect(page.locator('.sync-state')).toContainText('저장됨')
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-analysis:alice')||'[]')[0]?.conclusion)).toBe('alice private thought')
})
test('existing signed-in legacy caches migrate away from guest and logout clears them from view',async({page})=>{
 await base(page);await page.addInitScript(s=>{localStorage.setItem('peppercorn-session',JSON.stringify(s));localStorage.setItem('peppercorn-analysis',JSON.stringify([{id:'legacy',ticker:'AAPL',conclusion:'legacy private thought'}]))},session('alice'))
 await page.route('**/functions/v1/workspace?*',r=>r.fulfill({status:503,json:{error:'offline'}}))
 await page.goto(APP);await expect(page.locator('.sync-state')).toContainText('오류');expect(await page.evaluate(()=>localStorage.getItem('peppercorn-analysis'))).toBeNull()
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-analysis:alice')||'[]')[0]?.conclusion)).toBe('legacy private thought')
 await page.locator('.top-actions').getByRole('button',{name:'로그아웃',exact:true}).click();await page.getByRole('button',{name:'저널 카드 열기'}).click();await expect(page.getByRole('dialog')).not.toContainText('legacy private thought')
})
test('closing a pending login prevents its late session from signing in',async({page})=>{
 await base(page);let release!:()=>void;const gate=new Promise<void>(r=>release=r)
 await page.route('**/functions/v1/auth',async r=>{await gate;await r.fulfill({json:session('alice')}).catch(()=>{})})
 await page.goto(APP);await page.locator('.top-actions').getByRole('button',{name:'로그인',exact:true}).click();await page.getByLabel('이메일',{exact:true}).fill('alice@example.com');await page.getByLabel('비밀번호',{exact:true}).fill('test-password');await page.locator('.auth-submit').click();await page.getByRole('button',{name:'닫기',exact:true}).click();release()
 await page.waitForTimeout(150);expect(await page.evaluate(()=>localStorage.getItem('peppercorn-session'))).toBeNull();await expect(page.locator('.top-actions').getByRole('button',{name:'로그인',exact:true})).toBeVisible()
})
test('another tab signing in invalidates an earlier pending authentication attempt',async({page})=>{
 await base(page);let release!:()=>void;const gate=new Promise<void>(r=>release=r)
 await page.route('**/functions/v1/auth',async r=>{await gate;await r.fulfill({json:session('alice')}).catch(()=>{})})
 await page.route('**/functions/v1/workspace?*',r=>r.fulfill({json:{rows:[]}}))
 await page.goto(APP);await page.locator('.top-actions').getByRole('button',{name:'로그인',exact:true}).click();await page.getByLabel('이메일',{exact:true}).fill('alice@example.com');await page.getByLabel('비밀번호',{exact:true}).fill('test-password');await page.locator('.auth-submit').click()
 const other=await page.context().newPage();await other.goto(APP);await other.evaluate(s=>localStorage.setItem('peppercorn-session',JSON.stringify(s)),session('bob'))
 await expect(page.locator('.auth-card')).toHaveCount(0);release();await page.waitForTimeout(150)
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-session')||'null')?.user.id)).toBe('bob');await other.close()
})
test('expired-session startup shares one refresh across all six workspace reads',async({page})=>{
 await base(page);const old={...session('alice'),expires_at:1};await page.addInitScript(s=>localStorage.setItem('peppercorn-session',JSON.stringify(s)),old)
 let refreshes=0;const resources=new Set<string>()
 await page.route('**/functions/v1/auth',async r=>{expect(r.request().postDataJSON().action).toBe('refresh');refreshes++;await new Promise(resolve=>setTimeout(resolve,100));return r.fulfill({json:{...session('alice'),access_token:'renewed-alice',refresh_token:'new-refresh'}})})
 await page.route('**/functions/v1/workspace?*',r=>{expect(r.request().headers().authorization).toBe('Bearer renewed-alice');resources.add(new URL(r.request().url()).searchParams.get('resource')!);return r.fulfill({json:{rows:[]}})})
 await page.goto(APP);await expect(page.locator('.sync-state')).toContainText('저장됨');expect(refreshes).toBe(1);expect([...resources].sort()).toEqual(['analysis','journal','portfolio','research','temperature','watchlist'])
})
