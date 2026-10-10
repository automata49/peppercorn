import {test,expect,type Page} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {openPage} from './journey-helpers'
import {blankSnapshot,cleanDocument,parseNotebook,type JournalEntry} from '../src/lib/lifetimeJournal'
async function setup(page:Page){
 await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>{const ids=new URL(r.request().url()).searchParams.get('ids')!.split(',');return r.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,[['2026-10-01',100],['2026-10-02',105],['2026-10-05',102]]]))}})})
 await page.goto('/peppercorn/')
 await expect(page.getByRole('button',{name:'첫 페이지 쓰기'})).toBeEnabled()
}
async function compose(page:Page,title:string){await page.getByRole('textbox',{name:'기록 제목'}).fill(title);await page.getByRole('textbox',{name:'기록 본문'}).fill('관찰: 수요가 늘었다. 해석과 증거는 구분한다.');await page.getByLabel('질문에 대한 나의 답').fill('반대 증거도 확인한다.')}
for(const width of [390,834,1366,1440])test(`lifetime ${width}: create, ink, revisit, revise and keyboard tabs`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<1440});const page=await context.newPage();await setup(page)
 await expect(page.locator('.journey-today')).toHaveCount(0)
 if(width<1440){await expect(page.locator('.mobile-brandbar')).toBeVisible();expect(await page.locator('.mobile-brandbar .folio-wordmark-system>img:visible').count()).toBe(1)}
 await expect(page.locator('.mobile-bottom-nav b')).toHaveText(['오늘','발견','저널','여정'])
 await page.getByRole('button',{name:'첫 페이지 쓰기'}).click();await compose(page,'기다림도 하나의 결정')
 await page.getByRole('button',{name:'필기 시작',exact:true}).click()
 await page.getByRole('img',{name:'손글씨 입력 영역'}).scrollIntoViewIfNeeded();const box=(await page.getByRole('img',{name:'손글씨 입력 영역'}).boundingBox())!;await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+100,box.y+60,{steps:4});await page.mouse.up()
 await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'기다림도 하나의 결정 기록 열기'})).toBeVisible();await expect(page.locator('.ink-preview')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.screenshot({path:`test-results/lifetime-today-${width}.png`,fullPage:true})
 await page.reload();await page.getByRole('button',{name:'기다림도 하나의 결정 기록 열기'}).click();await expect(page.getByLabel('질문에 대한 나의 답')).toHaveValue('반대 증거도 확인한다.')
 await page.getByLabel('질문에 대한 나의 답').fill('새 증거를 보고 판단을 바꿨다.');await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 await openPage(page,'저널');await page.getByRole('tab',{name:'일상',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'투자',exact:true})).toHaveAttribute('data-state','active')
 await page.getByRole('tab',{name:'전체',exact:true}).click();await page.getByRole('button',{name:'기다림도 하나의 결정 기록 열기'}).click();await page.getByText('이전 생각 1개',{exact:true}).click();await expect(page.locator('.journal-revision')).toContainText('반대 증거도 확인한다.')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.screenshot({path:`test-results/lifetime-editor-${width}.png`,fullPage:true});await page.getByRole('button',{name:'기록 닫기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 await openPage(page,'여정');await expect(page.locator('.journal-timeline')).toContainText('생각의 변화 1회')
 await context.close()
})
test('backup round trips long answers, ink and more than 100 revisions',()=>{
 const base={...blankSnapshot(),title:'old',text:'x'.repeat(120000),answer:'a'.repeat(10001),ink:Array.from({length:501},()=>[{x:10,y:20}])}
 const entry:JournalEntry={...base,id:'one',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z',revisions:Array.from({length:101},(_,i)=>({at:`revision ${i}`,snapshot:{...base,text:'note',ink:[]}}))}
 expect(parseNotebook(JSON.stringify({format:'folio-journal',version:1,entries:[entry]}))).toEqual([entry])
})
test('two tabs preserve separate new pages and detect stale edits',async({browser})=>{
 const context=await browser.newContext();const a=await context.newPage(),b=await context.newPage();await setup(a);await setup(b)
 await a.getByRole('button',{name:'첫 페이지 쓰기'}).click();await b.getByRole('button',{name:'첫 페이지 쓰기'}).click();await compose(a,'창 A');await compose(b,'창 B')
 await a.getByRole('button',{name:'페이지 저장',exact:true}).click();await b.getByRole('button',{name:'페이지 저장',exact:true}).click()
 await a.reload();await openPage(a,'저널');await expect(a.locator('.journal-gallery .journal-story')).toHaveCount(2)
 await openPage(b,'저널');await a.getByRole('button',{name:'창 A 기록 열기'}).click();await b.getByRole('button',{name:'창 A 기록 열기'}).click();await a.getByLabel('질문에 대한 나의 답').fill('A 변경');await a.getByRole('button',{name:'페이지 저장',exact:true}).click();await b.getByLabel('질문에 대한 나의 답').fill('B 변경');await b.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(b.getByRole('alert')).toContainText('다른 창')
 await context.close()
})
test('reduced motion, dirty dismissal, photo preview and real close-price chart',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await setup(page);await page.getByRole('button',{name:'첫 페이지 쓰기'}).click();await compose(page,'사진 기록')
 await page.getByLabel('기록 사진').setInputFiles('public/folio-brand-photography.webp')
 await expect(page.locator('.journal-cover')).toBeVisible()
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'기록 닫기'}).click();await expect(page.getByRole('dialog')).toBeVisible()
 await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.locator('.journal-story-hero>img')).toBeVisible()
 await openPage(page,'발견');const active=page.locator('.analysis-scope button[aria-pressed=true]');if(await active.count())await active.click();await page.getByRole('group',{name:'분류'}).getByRole('button',{name:'전체',exact:true}).click();await page.locator('.analysis-idea-list>button').first().click();await page.getByRole('button',{name:'종가 확대',exact:true}).click()
 await expect(page.locator('.close-price-chart canvas').first()).toBeVisible();await expect(page.getByRole('slider',{name:'종가 날짜 탐색'})).toHaveAttribute('aria-valuetext',/102/)
 await page.getByRole('button',{name:'가격 · RS 비교',exact:true}).click();await expect(page.locator('.scrubbable-chart')).toBeVisible()
})
for(const [width,height] of [[390,844],[1440,1000]])test(`Motion home ${width}: covers expand, return focus and preserve scroll`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage();await setup(page)
 await expect(page.locator('.today-story')).toHaveCount(4)
 await expect(page.locator('.today-story>img').first()).toBeVisible()
 expect(await page.locator('.today-story').first().evaluate(e=>{const b=e.getBoundingClientRect();return b.height>=360&&b.width>280})).toBe(true)
 await page.screenshot({path:`test-results/motion-home-${width}.png`,fullPage:true})
 const card=page.getByRole('button',{name:'시장 발견 카드 열기'});await card.scrollIntoViewIfNeeded();await card.focus()
 const scroll=await page.evaluate(()=>scrollY)
 await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('button',{name:'기록 닫기'})).toBeFocused()
 await expect(page.getByRole('button',{name:'오늘의 주도주 →',exact:true})).toBeVisible()
 await expect.poll(async()=>Math.round((await page.getByRole('dialog').boundingBox())!.y)).toBe(width===390?0:40)
 await page.waitForTimeout(500);await page.screenshot({path:`test-results/motion-detail-${width}.png`})
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(card).toBeFocused()
 expect(Math.abs(await page.evaluate(()=>scrollY)-scroll)).toBeLessThan(3)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await context.close()
})

test('ordered list numbering survives reopen and backup cleanup',()=>{
 const body={type:'doc',content:[{type:'orderedList',attrs:{start:5},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'다섯 번째 증거'}]}]}]}]}
 expect(cleanDocument(body)).toEqual(body)
 expect(cleanDocument({type:'doc',content:[{type:'heading',attrs:{level:6},content:[{type:'text',text:'여섯 번째'}]}]}).content?.[0].attrs?.level).toBe(6)
})
