import {test,expect} from '@playwright/test'
import {blankSnapshot,type JournalEntry} from '../src/lib/lifetimeJournal'
import {demoRows} from '../src/data/mock'
import {openPage} from './journey-helpers'

for(const [width,height] of [[390,844],[844,390],[834,1194],[1194,834],[1366,1024],[1440,900]])for(const theme of ['light','dark'])test(`editorial archive ${width}x${height} ${theme}: layout, glass and retained filters`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage()
 await page.addInitScript(theme=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-theme',theme)},theme)
 for(const path of ['leaderboard','stock-flags','leader-insights'])await page.route(`**/data/${path}.json*`,r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.goto('/peppercorn/');await openPage(page,'저널')
 await expect(page.getByRole('button',{name:'새 페이지',exact:true})).toBeEnabled()
 const entries:JournalEntry[]=Array.from({length:3},(_,i)=>({...blankSnapshot(),id:`editorial-${i}`,title:`기록 ${i+1}`,kind:i===2?'life':'investment',text:'그때의 생각과 새로 확인한 증거',photos:['/peppercorn/folio-retro-journal.webp'],createdAt:`2026-10-0${i+1}T09:00:00Z`,updatedAt:`2026-10-0${i+1}T09:00:00Z`,revisions:[]}))
 await page.evaluate(entries=>new Promise<void>((resolve,reject)=>{const r=indexedDB.open('folio-lifetime-journal',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('notebooks','readwrite');t.objectStore('notebooks').put(entries,'guest');t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>reject(t.error)};r.onerror=()=>reject(r.error)}),entries)
 await page.reload()
 for(const label of ['저널','여정']){
  await openPage(page,label)
  const filters=page.getByRole('complementary',{name:'기록 검색 및 날짜 필터'}),content=page.locator('.journal-collection-content')
  const f=(await filters.boundingBox())!,c=(await content.boundingBox())!
  if(width>=1024||(width>=700&&width>height)){expect(f.x+f.width).toBeLessThanOrEqual(c.x);expect(c.width).toBeGreaterThan(f.width)}else{expect(f.y+f.height).toBeLessThanOrEqual(c.y);expect(await page.locator('.journal-gallery').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2)}
  const card=page.getByRole('button',{name:'기록 1 기록 열기'})
  await expect(card).toBeVisible()
  const glass=await card.evaluate(el=>({fill:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter,shadow:getComputedStyle(el).boxShadow}))
  expect(glass.blur).toContain('blur(20px)');expect(glass.shadow).toContain('inset')
  const alpha=Number(glass.fill.match(/\/\s*([\d.]+)/)?.[1]??glass.fill.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/)?.[1]??1)
  expect(alpha).toBeGreaterThan(.3);expect(alpha).toBeLessThan(1)
  await page.getByLabel('내 기록 검색').fill('기록 1');const dates=page.locator('.journal-date-toggle');if(await dates.isVisible())await dates.click();await page.getByLabel('기록 연도',{exact:true}).selectOption('2026')
  await expect(page.locator('.journal-gallery .journal-story')).toHaveCount(1)
  await page.setViewportSize({width:height,height:width})
  await expect(page.getByLabel('내 기록 검색')).toHaveValue('기록 1');await expect(page.getByLabel('기록 연도',{exact:true})).toHaveValue('2026')
  await card.click();await expect(page.getByLabel('기록 제목')).toHaveValue('기록 1');await page.keyboard.press('Escape');await expect(card).toBeFocused()
  await page.getByRole('button',{name:'검색·날짜 초기화'}).click();await page.setViewportSize({width,height})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }
 await context.close()
})
