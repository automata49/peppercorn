import {test,expect,type BrowserContext,type Page,type Route} from '@playwright/test'
import {blankSnapshot,snapshot,type JournalEntry} from '../src/lib/lifetimeJournal'
import {demoRows} from '../src/data/mock'
import {openPage} from './journey-helpers'
const SESSION={access_token:'sync-owner',refresh_token:'refresh-sync-owner',expires_at:9999999999,user:{id:'sync-owner',email:'synthetic@example.com'}}
function server(){
 const entries=new Map<string,JournalEntry>(),basket=new Map<string,any>();let offline=false
 const handle=async(route:Route)=>{
  if(offline)return route.fulfill({status:503,json:{error:'offline'}})
  const request=route.request(),url=new URL(request.url())
  if(url.searchParams.get('resource')==='basket'){
   if(request.method()==='POST')for(const item of request.postDataJSON().changes)basket.set(item.market+':'+item.ticker,item)
   return route.fulfill({json:{known:[...basket.keys()],items:[...basket.values()].filter(i=>!i.removed).map(({market,ticker,name})=>({market,ticker,name}))}})
  }
  if(request.method()==='POST'){
   const updates:JournalEntry[]=request.postDataJSON().entries
   if(updates.some(e=>{const previous=entries.get(e.id);return previous&&previous.updatedAt!==e.updatedAt&&!e.revisions.some(r=>r.at===previous.updatedAt)}))return route.fulfill({status:409,json:{error:'edit_conflict'}})
   for(const e of updates)entries.set(e.id,e)
   return route.fulfill({json:{entries:updates}})
  }
  return route.fulfill({json:{entries:[...entries.values()]}})
 }
 return {entries,handle,setOffline:(value:boolean)=>offline=value}
}
async function setup(context:BrowserContext,cloud:ReturnType<typeof server>){
 await context.addInitScript(s=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('peppercorn-session',JSON.stringify(s))},SESSION)
 await context.route('**/functions/v1/notebook*',cloud.handle)
 await context.route('**/functions/v1/workspace?*',r=>r.fulfill({json:{rows:[]}}))
 await context.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await context.route('**/functions/v1/source-reports*',r=>r.fulfill({json:{reports:[]}}))
 await context.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await context.route('**/data/*.json*',r=>r.fulfill({status:404,body:''}))
}
async function journal(page:Page){await page.goto('/peppercorn/');await openPage(page,'저널');await expect(page.getByRole('button',{name:'새 페이지',exact:true})).toBeEnabled()}
async function save(page:Page,title:string){await page.getByLabel('기록 제목').fill(title);await page.getByRole('textbox',{name:'기록 본문'}).fill('수요를 확인한 근거');await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)}
const entry=(id='same'):JournalEntry=>({...blankSnapshot(),id,title:'원래의 판단',kind:'investment',hypothesis:'수요 증가',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',revisions:[]})
test('separate devices share notebook, formatting and reflection with same account',async({browser})=>{
 const cloud=server(),a=await browser.newContext({reducedMotion:'reduce'}),b=await browser.newContext({reducedMotion:'reduce'});await setup(a,cloud);await setup(b,cloud)
 const first=await a.newPage(),second=await b.newPage();await journal(first);await first.getByRole('button',{name:'새 페이지',exact:true}).click();await first.getByLabel('기록 분류').selectOption('investment');await first.getByLabel('내 가설').fill('수요가 늘어난다');await save(first,'같은 계정 기록')
 await expect.poll(()=>cloud.entries.size).toBe(1);await journal(second);await expect(second.getByRole('button',{name:'같은 계정 기록 기록 열기'})).toBeVisible();await second.getByRole('button',{name:'같은 계정 기록 기록 열기'}).click();await expect(second.getByLabel('내 가설')).toHaveValue('수요가 늘어난다')
 await second.getByRole('textbox',{name:'기록 본문'}).selectText();await second.getByRole('button',{name:'밑줄',exact:true}).click();await second.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(second.getByRole('dialog')).toHaveCount(0)
 await openPage(second,'여정');await second.getByRole('button',{name:'회고 남기기'}).click();await second.getByLabel('회고 결과').fill('실적에서 수요 증가를 확인했다');await second.getByLabel('회고 배운 점').fill('가격보다 근거를 먼저 확인한다');await second.getByRole('button',{name:'회고 저장',exact:true}).click();await expect(second.getByRole('dialog')).toHaveCount(0)
 await first.bringToFront();await first.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect.poll(()=>first.evaluate(()=>new Promise<any>(resolve=>{const r=indexedDB.open('folio-lifetime-journal',1);r.onsuccess=()=>{const q=r.result.transaction('notebooks').objectStore('notebooks').get('sync-owner');q.onsuccess=()=>resolve(q.result?.[0]?.reflections?.[0]?.lesson)}}))).toBe('가격보다 근거를 먼저 확인한다')
 await openPage(first,'여정');await first.getByRole('button',{name:/회고 완료 · 1/}).click();await expect(first.locator('.review-gallery-item')).toHaveCount(1)
 await a.close();await b.close()
})
test('offline multiple edits retry same ID and merge remote pages',async({browser})=>{
 const cloud=server();cloud.entries.set('same',entry());const context=await browser.newContext({reducedMotion:'reduce'});await setup(context,cloud);const page=await context.newPage();await journal(page);await expect(page.getByRole('button',{name:'원래의 판단 기록 열기'})).toBeVisible();cloud.setOffline(true)
 await page.getByRole('button',{name:'원래의 판단 기록 열기'}).click();await save(page,'오프라인 B');await expect(page.getByRole('alert')).toContainText('동기화')
 await page.getByRole('button',{name:'오프라인 B 기록 열기'}).click();await save(page,'오프라인 C');cloud.entries.set('other',{...entry('other'),title:'다른 기기의 기록'});cloud.setOffline(false);await page.getByRole('button',{name:'동기화 다시 시도'}).click()
 await expect.poll(()=>cloud.entries.get('same')?.title).toBe('오프라인 C');expect(cloud.entries.size).toBe(2);await expect(page.getByRole('button',{name:'다른 기기의 기록 기록 열기'})).toBeVisible();await expect(page.getByRole('button',{name:'오프라인 C 기록 열기'})).toBeVisible();await context.close()
})
test('divergent legacy pages are retained as a conflict copy',async({browser})=>{
 const cloud=server(),context=await browser.newContext({reducedMotion:'reduce'});await setup(context,cloud);const page=await context.newPage();await journal(page)
 const local={...entry(),title:'기기에만 있던 수정',updatedAt:'2026-10-02T00:00:00Z'}
 await page.evaluate(local=>new Promise<void>(resolve=>{const r=indexedDB.open('folio-lifetime-journal',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('notebooks','readwrite'),s=t.objectStore('notebooks');s.put([local],'sync-owner');s.delete('sync-owner::pending');s.delete('sync-owner::cloud-v1');t.oncomplete=()=>resolve()}}),local)
 cloud.entries.set('same',entry());await page.reload();await openPage(page,'저널');await expect(page.getByRole('button',{name:'기기에만 있던 수정 · 기기에서 복원 기록 열기'})).toBeVisible();await expect(page.getByRole('button',{name:'원래의 판단 기록 열기'})).toBeVisible();await expect.poll(()=>cloud.entries.size).toBe(2);await context.close()
})
test('journal photo occupies one home cover, captions never cover photos, reflection drafts are protected',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),cloud=server();const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII='
 cloud.entries.set('same',{...entry(),photos:[photo],photo,reviewDate:'2026-10-01'});await setup(context,cloud);const page=await context.newPage();await journal(page)
 const card=page.getByRole('button',{name:'원래의 판단 기록 열기'});await expect(card).toBeVisible();const image=(await card.locator('img').boundingBox())!,caption=(await card.locator('.journal-story-copy').boundingBox())!;expect(caption.y).toBeGreaterThanOrEqual(image.y+image.height)
 await openPage(page,'오늘');await expect(page.locator('.home-journal>img')).toHaveAttribute('src',photo);expect(await page.locator('.home-motion-card>img').evaluateAll((images,photo)=>images.filter(image=>image.getAttribute('src')===photo).length,photo)).toBe(1)
 await openPage(page,'여정');await page.getByRole('button',{name:'회고 남기기'}).click();await page.getByLabel('회고 결과').fill('작성 중인 회고');let prompted=false;page.once('dialog',async dialog=>{prompted=true;await dialog.dismiss()});await page.keyboard.press('Escape');await expect(page.getByLabel('회고 결과')).toHaveValue('작성 중인 회고');expect(prompted).toBe(true);await context.close()
})

test('basket changes sync across devices and a removed item is not resurrected',async({browser})=>{
 const cloud=server(),a=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),b=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await setup(a,cloud);await setup(b,cloud)
 await a.addInitScript(()=>localStorage.setItem('folio-stock-basket:sync-owner',JSON.stringify([{market:'US',ticker:'NVDA',name:'NVIDIA'}])))
 const first=await a.newPage(),second=await b.newPage();await first.goto('/peppercorn/');await expect.poll(()=>first.evaluate(()=>localStorage.getItem('folio-stock-basket:sync-owner:pending'))).toBe('{}')
 await second.goto('/peppercorn/');await second.getByRole('button',{name:/장바구니 \d+종목/}).first().click();await expect(second.locator('.stock-basket-list')).toContainText('NVDA');await second.getByRole('button',{name:'NVDA 장바구니에서 삭제'}).click();await expect(second.locator('.stock-basket-list')).toHaveCount(0);await expect.poll(()=>second.evaluate(()=>localStorage.getItem('folio-stock-basket:sync-owner:pending'))).toBe('{}')
 await first.bringToFront();await first.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect.poll(()=>first.evaluate(()=>JSON.parse(localStorage.getItem('folio-stock-basket:sync-owner')||'[]').length)).toBe(0);await a.close();await b.close()
})

test('failed workspace writes survive reload and retry before accepting remote snapshots',async({browser})=>{
 const cloud=server(),context=await browser.newContext({reducedMotion:'reduce'});await setup(context,cloud)
 await context.addInitScript(()=>{const rows=[{id:'synthetic-watch',market:'US',ticker:'NVDA',note:'오프라인에서 남긴 관찰'}];localStorage.setItem('folio-workspace-outbox:sync-owner',JSON.stringify({watchlist:rows}));localStorage.setItem('peppercorn-watchlist:sync-owner',JSON.stringify(rows))})
 let offline=true,remote:any[]=[],writes=0
 await context.route('**/functions/v1/workspace?*',route=>{const request=route.request(),resource=new URL(request.url()).searchParams.get('resource');if(offline)return route.fulfill({status:503,json:{error:'offline'}});if(request.method()==='POST'){writes++;remote=request.postDataJSON().rows;return route.fulfill({json:{ok:true}})}return route.fulfill({json:{rows:resource==='watchlist'?remote:[]}})})
 const page=await context.newPage();await journal(page);await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-watchlist:sync-owner')||'[]')[0]?.note)).toBe('오프라인에서 남긴 관찰')
 offline=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>writes).toBe(1);await expect.poll(()=>page.evaluate(()=>localStorage.getItem('folio-workspace-outbox:sync-owner'))).toBeNull();expect(remote[0].note).toBe('오프라인에서 남긴 관찰');await context.close()
})
