import { test, expect, type Page } from '@playwright/test'
import { demoRows } from '../src/data/mock'
import { openPage } from './journey-helpers'
const rows=demoRows.map((row,i)=>({...row,leadership_class:i===2?'중립':'핵심 주도'}))
const research=[{id:'evidence',market:'KR',ticker:'000660',date:'2026-01-01',title:'테스트 기록 · 수요와 실적을 함께 확인',fact:'테스트 기록 · 원문에서 확인한 관찰입니다.',interpretation:'테스트 기록 · 나의 해석입니다.',source:'https://www.skhynix.com/',verification:'미검증'},
 {id:'legacy-rejected',market:'KR',ticker:'000660',date:'2026-10-12',title:'과거 반박 자료',fact:'연결되면 안 되는 관찰',source:'https://example.com/',verified:false},
 {id:'wrong',market:'US',ticker:'000660',date:'2026-10-11',title:'다른 시장 자료',fact:'연결되면 안 되는 관찰',source:'https://example.com/',verification:'확인됨'},
 {id:'rejected',market:'KR',ticker:'000660',date:'2026-10-11',title:'반박된 자료',fact:'연결되면 안 되는 관찰',source:'https://example.com/',verification:'반박됨'}]
async function boot(page:Page,data=rows,notes=research){
 await page.addInitScript(notes=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-stock-size','all');localStorage.setItem('peppercorn-research',JSON.stringify(notes))},notes)
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/data/stock-flags.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:data}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.goto('/peppercorn/');await expect(page.locator('.home-heading h2')).toHaveText('오늘')
}
test('public research isolation keeps explicit issuer, date and rejected-state gates',async()=>{
 const {leaderObservation}=await import('../src/lib/leaderObservation')
 const row=rows.find(r=>r.market==='KR'&&r.ticker==='000660')!
 expect(leaderObservation(row,research)?.id).toBe('evidence')
 expect(leaderObservation(row,[])).toBeUndefined()
})
test('fixed home shows no invented leader preview when screening is empty',async({page})=>{
 await boot(page,rows.map(row=>({...row,leadership_class:'중립',stage:'○ 관찰'})),[])
 await expect(page.locator('.home-motion-card')).toHaveCount(4)
 await page.getByRole('button',{name:'발견 카드 열기'}).click();await expect(page.getByRole('dialog')).toContainText('선별된 종목이 없습니다.')
})
test('ordinary spring transition returns to the same fixed cover',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'}),page=await context.newPage();await boot(page)
 const card=page.getByRole('button',{name:'오늘 카드 열기'});await card.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(card).toBeFocused();await context.close()
})
