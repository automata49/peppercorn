import { test, expect, type Page } from '@playwright/test'
import { demoRows } from '../src/data/mock'
import { blankSnapshot, type JournalEntry } from '../src/lib/lifetimeJournal'
import { calendarGroup, matchesCalendar } from '../src/lib/journalGallery'
import { openPage } from './journey-helpers'

async function boot(page: Page, theme = 'light', intro = false) {
 await page.addInitScript(({theme,intro})=>{localStorage.setItem('folio-theme',theme);localStorage.setItem('folio-stock-size','all');if(!intro)sessionStorage.setItem('peppercorn-intro-seen','1')}, {theme,intro})
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/data/stock-flags.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/data/leader-insights.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:[...demoRows.map(r=>({...r,leadership_class:'핵심 주도'})),{...demoRows[0],id:'us-bug',market:'US',ticker:'BUG',name:'Global X Cybersecurity ETF',asset_class:'ETF',rs_rank:null,etf_rs_rank:99}]}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.goto('/peppercorn/')
}
async function seed(page:Page,entries:JournalEntry[]){await page.evaluate(async entries=>{await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('folio-lifetime-journal',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('notebooks','readwrite');t.objectStore('notebooks').put(entries,'guest');t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>reject(t.error)};r.onerror=()=>reject(r.error)})},entries);await page.reload()}
for(const width of [390,834,1366,1440])for(const theme of ['light','dark'])test(`lifestyle ${width} ${theme}: fixed covers, expansions, focus and detail contrast`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<1440,reducedMotion:'reduce'}),page=await context.newPage();await boot(page,theme)
 const covers=page.locator('.home-motion-card');await expect(covers).toHaveCount(4);await expect(covers.locator('h3')).toHaveText(['오늘','발견','저널','여정'])
 await expect(page.locator('.leader-cover')).toHaveCount(0)
 for(const label of ['오늘','발견','저널','여정']){const card=page.getByRole('button',{name:`${label} 카드 열기`});await card.scrollIntoViewIfNeeded();await card.focus();const scroll=await page.evaluate(()=>scrollY);await page.keyboard.press('Enter');const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(page.getByRole('button',{name:'카드 닫기'})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(card).toBeFocused();expect(Math.abs(await page.evaluate(()=>scrollY)-scroll)).toBeLessThan(3)}
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/lifestyle-home-${width}-${theme}.png`,fullPage:true})
 await page.getByRole('button',{name:'발견 카드 열기'}).click();await page.locator('.home-leader-preview>button').first().click();await expect(page.locator('.analysis-body')).toBeVisible()
 const palette=await page.locator('.analysis-page').evaluate(el=>{const root=getComputedStyle(document.documentElement),p=getComputedStyle(el),hero=getComputedStyle(el.querySelector('.hero-name')!);return{root:root.getPropertyValue('--folio-paper').trim(),paper:p.getPropertyValue('--folio-paper').trim(),background:p.backgroundColor,ink:p.getPropertyValue('--folio-ink').trim(),hero:hero.color}})
 expect(palette.paper).toBe(palette.root);expect(palette.background).toBe(theme==='light'?'rgb(255, 255, 255)':'rgb(10, 10, 12)');expect(palette.hero).toBe(theme==='light'?'rgb(17, 17, 19)':'rgb(250, 250, 250)')
 await page.screenshot({path:`test-results/lifestyle-detail-${width}-${theme}.png`,fullPage:true});await context.close()
})
for(const theme of ['light','dark'])test(`launch ${theme}: source image on white for exactly 2000ms`,async({page})=>{
 await page.clock.install({time:new Date('2026-10-12T00:00:00Z')});await page.clock.pauseAt(new Date('2026-10-12T00:00:00Z'));await boot(page,theme,true)
 const launch=page.locator('.launch-overlay');await expect(launch).toBeVisible();await expect(launch).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(launch.locator('img')).toHaveCount(1);await expect(launch.locator('img')).toHaveAttribute('src','./folio-brand-wordmark-light.webp?v=u2');await expect(launch.locator('.folio-wordmark-system')).toHaveCount(0)
 await page.clock.runFor(1999);await expect(launch).toBeVisible();await page.clock.runFor(1);await expect(launch).toHaveCount(0)
})
test('calendar filtering preserves date-only values and supports unknown dates',()=>{expect(calendarGroup('2026-02-01','month')).toBe('2026-02');expect(matchesCalendar('2026-02-01','2026','02','01')).toBe(true);expect(matchesCalendar('2026-02-01','2025','','')).toBe(false);expect(calendarGroup('','day')).toBe('날짜 미제공')})
test('gallery: date drilldown, bounded thumbnails, exact record editor and investment-only review',async({page})=>{
 await boot(page);const base=blankSnapshot();const entries=Array.from({length:65},(_,i):JournalEntry=>({...base,id:`gallery-${i}`,title:`생각 ${i}`,kind:i%2?'life':'investment',ticker:'US:NVDA',text:`원본 ${i}`,body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:`원본 ${i}`}]}]},createdAt:`${i<60?'2026-10':'2025-02'}-${String(i%28+1).padStart(2,'0')}T09:00:00Z`,updatedAt:'2026-10-12T09:00:00Z',revisions:[]}));await seed(page,entries)
 await openPage(page,'저널');await expect(page.locator('.journal-albums .journal-story')).toHaveCount(40);await page.getByRole('button',{name:/^기록 더 보기/}).click();await expect(page.locator('.journal-albums .journal-story')).toHaveCount(65)
 await page.getByLabel('기록 연도',{exact:true}).selectOption('2025');await page.getByLabel('기록 월',{exact:true}).selectOption('02');await expect(page.locator('.journal-albums .journal-story')).toHaveCount(5);await page.getByLabel('기록 일',{exact:true}).selectOption('05');await expect(page.locator('.journal-albums .journal-story')).toHaveCount(1)
 await page.getByRole('button',{name:'생각 60 기록 열기'}).click();await expect(page.getByLabel('기록 본문')).toContainText('원본 60');await page.getByRole('button',{name:'기록 닫기'}).click();await expect(page.getByRole('button',{name:'생각 60 기록 열기'})).toBeFocused()
 await openPage(page,'여정');await expect(page.locator('.review-gallery-item')).toHaveCount(33);await page.getByLabel('내 기록 검색').fill('생각 60');await expect(page.locator('.review-gallery-item')).toHaveCount(1);await page.getByRole('button',{name:'생각 60 기록 열기'}).click();await expect(page.getByLabel('기록 제목')).toHaveValue('생각 60')
})
test('linked trade beyond summary limit opens and edits only its exact original',async({page})=>{
 const records=Array.from({length:25},(_,i)=>({id:`trade-${i}`,ticker:'NVDA',market:'US',date:`2025-01-${String(i+1).padStart(2,'0')}`,thesis:`가설 ${i}`}))
 await page.addInitScript(records=>localStorage.setItem('peppercorn-journal',JSON.stringify(records)),records);await boot(page);await openPage(page,'여정');await page.getByLabel('기록 일',{exact:true}).selectOption('25');await page.locator('.linked-record-card').click();await expect(page.locator('.linked-trade-original')).toHaveAttribute('data-record-id','trade-24');await expect(page.getByLabel('thesis 원본')).toHaveValue('가설 24');await page.getByLabel('thesis 원본').fill('다시 점검한 가설');await expect(page.getByRole('button',{name:'원본 변경 저장'})).toBeEnabled();await openPage(page,'오늘');await openPage(page,'매매 기록');await expect(page.getByLabel('thesis 원본')).toHaveValue('다시 점검한 가설');await page.getByRole('button',{name:'원본 변경 저장'}).click();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-journal')||'[]'));expect(saved.find((r:any)=>r.id==='trade-24').thesis).toBe('다시 점검한 가설');expect(saved.find((r:any)=>r.id==='trade-0').thesis).toBe('가설 0')
})
for(const [width,height] of [[844,390],[1194,834]])for(const theme of ['light','dark'])test(`landscape ${width} ${theme}: ETF detail inherits the selected palette`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage();await boot(page,theme)
 await openPage(page,'발견');await page.getByRole('group',{name:'분류'}).getByRole('button',{name:'ETF',exact:true}).click();await page.locator('.analysis-idea-list>button').first().click();await expect(page.locator('.analysis-body')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 const colours=await page.locator('.analysis-price-momentum').evaluate(el=>({paper:getComputedStyle(el).getPropertyValue('--folio-paper'),root:getComputedStyle(document.documentElement).getPropertyValue('--folio-paper'),hero:getComputedStyle(el.querySelector('.hero-name')!).color,ink:getComputedStyle(document.body).color}))
 expect(colours.paper).toBe(colours.root);expect(colours.hero).toBe(colours.ink)
 await context.close()
})
