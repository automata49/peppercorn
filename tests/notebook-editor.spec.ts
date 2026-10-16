import {test,expect,type Page} from '@playwright/test'
import {parseNotebook,type JournalEntry} from '../src/lib/lifetimeJournal'
import {demoRows} from '../src/data/mock'
import {openPage} from './journey-helpers'
async function setup(page:Page){
 await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.goto('/peppercorn/');await openPage(page,'저널');await page.getByRole('button',{name:'새 페이지',exact:true}).click()
 await page.getByLabel('기록 제목').fill('나의 노트')
}
async function draw(page:Page,from={x:100,y:120},to={x:250,y:170}){
 const layer=page.getByRole('img',{name:'손글씨 입력 영역'});await layer.evaluate(n=>n.scrollIntoView({block:'start'}));const r=(await layer.boundingBox())!
 await page.mouse.move(r.x+from.x,r.y+from.y+160);await page.mouse.down();await page.mouse.move(r.x+to.x,r.y+to.y+160,{steps:12});await page.mouse.up()
}
async function stored(page:Page){return page.evaluate(()=>new Promise<JournalEntry[]>(resolve=>{const r=indexedDB.open('folio-lifetime-journal',1);r.onsuccess=()=>{const q=r.result.transaction('notebooks').objectStore('notebooks').get('guest');q.onsuccess=()=>resolve(q.result)}}))}
for(const width of [390,834,1366,1440])for(const theme of ['light','dark'])test(`note writing ${width} ${theme}: paper, toolbar, saved ink and text`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(t=>localStorage.setItem('folio-theme',t),theme);await setup(page)
 await page.getByRole('textbox',{name:'기록 본문',exact:true}).fill('노트에 남긴 생각')
 await page.getByRole('button',{name:'용지 설정',exact:true}).click();await page.getByLabel('노트 용지').selectOption('grid')
 await page.getByRole('button',{name:'펜',exact:true}).click();await page.getByRole('button',{name:'파랑',exact:true}).click();await page.getByLabel('펜 굵기').selectOption('9')
 // The writing surface scrolls while the dock remains reachable at the bottom.
 const dock=page.getByRole('toolbar',{name:'노트 도구',exact:true});await expect(dock).toBeVisible()
 expect(await dock.evaluate(n=>n.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1000)
 const target=page.getByRole('button',{name:'펜',exact:true});const box=(await target.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44)
 await draw(page,{x:60,y:150},{x:170,y:190});await expect(page.locator('.notebook-ink path')).toHaveCount(1)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.screenshot({path:`test-results/notebook-${width}-${theme}.png`})
 await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 const [entry]=await stored(page);expect(entry.paper).toBe('grid');expect(entry.text).toBe('노트에 남긴 생각');expect(entry.ink[0][0]).toMatchObject({tool:'pen',color:'blue',size:9})
 await page.reload();await openPage(page,'저널');await page.getByRole('button',{name:'나의 노트 기록 열기'}).click();await expect(page.locator('.notebook-paper-grid')).toBeVisible();await expect(page.locator('.notebook-ink path')).toHaveCount(1)
})
test('ink undo/redo, selection move/delete, eraser and photo survive backup',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'형광펜',exact:true}).click();await draw(page)
 await expect(page.locator('.notebook-ink path')).toHaveCount(1);await expect(page.locator('.notebook-ink path')).toHaveAttribute('opacity','0.3')
 await page.getByRole('button',{name:'실행 취소',exact:true}).click();await expect(page.locator('.notebook-ink path')).toHaveCount(0)
 await page.getByRole('button',{name:'다시 실행',exact:true}).click();await expect(page.locator('.notebook-ink path')).toHaveCount(1)
 await page.getByRole('button',{name:'영역 선택',exact:true}).click();await draw(page,{x:80,y:100},{x:270,y:190});await expect(page.getByRole('button',{name:'선택 삭제',exact:true})).toBeEnabled()
 const before=await page.locator('.notebook-ink path').getAttribute('d');await draw(page,{x:150,y:145},{x:190,y:175});expect(await page.locator('.notebook-ink path').getAttribute('d')).not.toBe(before)
 await page.getByRole('button',{name:'선택 삭제',exact:true}).click();await expect(page.locator('.notebook-ink path')).toHaveCount(0)
 await page.getByRole('button',{name:'실행 취소',exact:true}).click();await page.getByRole('button',{name:'지우개',exact:true}).click();await draw(page,{x:180,y:160},{x:190,y:175});await expect(page.locator('.notebook-ink path')).toHaveCount(0)
 await page.getByRole('button',{name:'실행 취소',exact:true}).click();await page.getByLabel('기록 사진').setInputFiles('public/folio-brand-photography.webp');await expect(page.locator('.journal-cover')).toBeVisible()
 await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 const entries=await stored(page);expect(parseNotebook(JSON.stringify({format:'folio-journal',version:1,entries}))).toEqual(entries)
})
test('reflection shares tools and preserves structured judgement and original notebook',async({page})=>{
 await setup(page);await page.getByLabel('기록 분류').selectOption('investment');await page.getByLabel('내 가설').fill('이전 가설')
 await page.getByRole('textbox',{name:'기록 본문',exact:true}).fill('원래 본문');await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 await openPage(page,'여정');await page.getByRole('button',{name:'재검토하기'}).click();await page.getByLabel('회고 결과',{exact:true}).fill('새로 확인한 증거');await page.getByText('배운 점 남기기 · 선택',{exact:true}).click();await page.getByLabel('회고 배운 점').fill('배운 점');await page.getByText('증거 노트 · 사진·필기',{exact:true}).click();await page.getByRole('textbox',{name:'회고 노트 본문',exact:true}).fill('추가 서식 노트');await page.getByRole('textbox',{name:'회고 노트 본문',exact:true}).selectText();await page.getByRole('button',{name:'굵게',exact:true}).click()
 await page.getByRole('button',{name:'연필',exact:true}).click();await draw(page)
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'목록으로 돌아가기'}).click();await expect(page.getByRole('dialog')).toBeVisible()
 await page.getByLabel('다음 점검 조건').fill('새 공시 확인');await page.getByRole('button',{name:'판단 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 const entries=await stored(page),entry=entries[0];expect(entry.text).toBe('원래 본문');expect(entry.hypothesis).toBe('이전 가설');expect(entry.ink).toEqual([]);expect(entry.reflections?.[0].note?.text).toBe('추가 서식 노트');expect(entry.reflections?.[0].note?.ink).toHaveLength(1)
 expect(parseNotebook(JSON.stringify({format:'folio-journal',version:1,entries}))).toEqual(entries)
 await page.getByRole('button',{name:'재검토하기'}).click();await page.getByText('원본·판단 이력 1회',{exact:true}).click();await expect(page.locator('.journal-revision').last()).toContainText('추가 서식 노트');await expect(page.locator('.journal-revision .ink-preview')).toBeVisible();await expect(page.locator('.journal-revision strong')).toHaveText('추가 서식 노트')
})
test('tall imported ink stays visible after shortening text and reopening',async({page})=>{
 await page.addInitScript(()=>{
  const r=indexedDB.open('folio-lifetime-journal',1);r.onupgradeneeded=()=>r.result.createObjectStore('notebooks')
  r.onsuccess=()=>{const t=r.result.transaction('notebooks','readwrite');t.objectStore('notebooks').put([{id:'tall',title:'긴 필기',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'오래 남길 필기'}]}]},text:'오래 남길 필기',question:'질문',answer:'',ink:[[{x:100,y:1800,size:5,color:'blue',tool:'pen'},{x:300,y:1850}]],photos:[],kind:'life',ticker:'',reviewDate:'',place:'',expense:'',currency:'KRW',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',revisions:[]}],'guest')}
 })
 await setup(page);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'목록으로 돌아가기'}).click()
 await page.getByRole('button',{name:'긴 필기 기록 열기'}).click();await page.getByRole('textbox',{name:'기록 본문',exact:true}).fill('짧은 글')
 const svg=page.locator('.notebook-ink');await expect.poll(async()=>Number((await svg.getAttribute('viewBox'))?.split(' ')[3])).toBeGreaterThan(1900)
 await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.getByRole('button',{name:'긴 필기 기록 열기'}).click();await expect.poll(async()=>Number((await svg.getAttribute('viewBox'))?.split(' ')[3])).toBeGreaterThan(1900);await expect(svg.locator('path')).toHaveCount(1)
})
test('pen pressure is retained, cancellation rolls back, and touch scroll does not draw',async({browser})=>{
 const context=await browser.newContext({viewport:{width:834,height:1000},hasTouch:true});const page=await context.newPage()
 await setup(page);await page.getByRole('button',{name:'펜',exact:true}).click()
 const svg=page.locator('.notebook-ink');await svg.evaluate(node=>{for(const name of ['pointerdown','pointermove'])node.addEventListener(name,event=>{if((event as PointerEvent).pointerType==='mouse')Object.defineProperties(event,{pointerType:{value:'pen'},pressure:{value:.75}})},{capture:true})})
 await draw(page);await expect(svg.locator('path')).toHaveCount(1)
 const r=(await svg.boundingBox())!;await page.mouse.move(r.x+100,r.y+200);await page.mouse.down();await page.mouse.move(r.x+150,r.y+220)
 await svg.dispatchEvent('pointercancel',{pointerId:1,pointerType:'pen'});await page.mouse.up();await expect(svg.locator('path')).toHaveCount(1)
 const before=await page.getByRole('dialog').evaluate(n=>n.scrollTop),cdp=await context.newCDPSession(page)
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:420,y:700}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:420,y:500}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
 await expect.poll(()=>page.getByRole('dialog').evaluate(n=>n.scrollTop)).toBeGreaterThan(before);await expect(svg.locator('path')).toHaveCount(1)
 await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect((await stored(page))[0].ink[0][0].pressure).toBe(.75)
 await context.close()
})
