import {test,expect,type Page} from '@playwright/test'
import {blankSnapshot,type JournalEntry} from '../src/lib/lifetimeJournal'
import {demoRows} from '../src/data/mock'
import {openPage} from './journey-helpers'

async function setup(page:Page) {
 await page.addInitScript(()=>{
  sessionStorage.setItem('peppercorn-intro-seen','1')
  localStorage.setItem('folio-theme','light')
 })
 for(const feed of ['leaderboard','stock-flags','leader-insights'])await page.route(`**/data/${feed}.json*`,r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.goto('/peppercorn/')
 const entries:JournalEntry[]=Array.from({length:3},(_,i)=>({
  ...blankSnapshot(),id:`layout-${i}`,title:`기록 ${i+1}`,kind:i===0?'life':'investment',
  text:'기록 본문과 판단',hypothesis:i?'변화를 검증한다.':'',ticker:i?'US:AAPL':'',
  photos:i===0?['/peppercorn/folio-retro-journal.webp']:[],
  createdAt:`2026-10-0${i+1}T09:00:00Z`,updatedAt:`2026-10-0${i+1}T09:00:00Z`,
  reviewDate:i?'2099-11-01':'',revisions:[]
 }))
 await page.evaluate(entries=>new Promise<void>((resolve,reject)=>{
  const r=indexedDB.open('folio-lifetime-journal',1)
  r.onsuccess=()=>{
   const db=r.result,t=db.transaction('notebooks','readwrite')
   t.objectStore('notebooks').put(entries,'guest')
   t.oncomplete=()=>{db.close();resolve()}
   t.onerror=()=>reject(t.error)
  }
  r.onerror=()=>reject(r.error)
 }),entries)
 await page.reload()
}

for(const [width,height] of [[390,844],[834,1194],[1366,1024]]){
 test(`independent journal/reassessment list-card layouts persist at ${width}px`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'})
  const page=await context.newPage()
  await setup(page)
  await openPage(page,'저널')
  const journalGroup=page.getByRole('group',{name:'저널 보기 방식'})
  await expect(journalGroup.getByRole('button',{name:'카드형 보기'})).toHaveAttribute('aria-pressed','true')
  await expect(page.locator('.journal-albums .journal-gallery--card .journal-story')).toHaveCount(3)
  await expect(page.locator('.journal-albums .journal-gallery--card img')).toHaveCount(1)
  await journalGroup.getByRole('button',{name:'목록형 보기'}).click()
  await expect(journalGroup.getByRole('button',{name:'목록형 보기'})).toHaveAttribute('aria-pressed','true')
  await expect(page.locator('.journal-albums .journal-gallery--list .journal-story')).toHaveCount(3)
  await expect(page.locator('.journal-albums .journal-gallery--list img, .journal-albums .journal-gallery--list .journal-thumbnail-paper')).toHaveCount(0)
  await expect(page.locator('.journal-albums .journal-gallery--list .journal-list-instrument')).toHaveCount(2)
  const grid=page.locator('.journal-albums .journal-gallery').first()
  expect(await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1)
  const first=page.getByRole('button',{name:'기록 1 기록 열기'})
  await first.click()
  await expect(page.getByLabel('기록 제목')).toHaveValue('기록 1')
  await page.keyboard.press('Escape')
  await page.getByLabel('내 기록 검색').fill('기록 2')
  await expect(page.locator('.journal-albums .journal-story')).toHaveCount(1)
  await openPage(page,'여정')
  const reviewGroup=page.getByRole('group',{name:'재검토 보기 방식'})
  await expect(reviewGroup.getByRole('button',{name:'목록형 보기'})).toHaveAttribute('aria-pressed','true')
  await expect(page.locator('.decision-queue--list .decision-queue-item')).toHaveCount(2)
  await expect(page.locator('.decision-queue--list img')).toHaveCount(0)
  await reviewGroup.getByRole('button',{name:'카드형 보기'}).click()
  await expect(page.locator('.decision-queue--card .decision-queue-item')).toHaveCount(2)
  const cols=await page.locator('.decision-queue').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(cols).toBe(width<700?1:2)
  await page.getByRole('button',{name:'재검토하기'}).first().click()
  await expect(page.getByLabel('이번 점검의 기준')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await page.reload()
  await openPage(page,'여정')
  await expect(page.getByRole('group',{name:'재검토 보기 방식'}).getByRole('button',{name:'카드형 보기'})).toHaveAttribute('aria-pressed','true')
  await openPage(page,'저널')
  await expect(page.getByRole('group',{name:'저널 보기 방식'}).getByRole('button',{name:'목록형 보기'})).toHaveAttribute('aria-pressed','true')
  await expect(page.locator('.journal-albums .journal-story')).toHaveCount(3)
  await expect(page.locator('.journal-albums .journal-gallery--list img')).toHaveCount(0)
  await page.getByRole('group',{name:'저널 보기 방식'}).getByRole('button',{name:'카드형 보기'}).click()
  await expect(page.locator('.journal-albums .journal-gallery--card img')).toHaveCount(1)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await context.close()
 })
}
