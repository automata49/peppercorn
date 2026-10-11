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
 await page.goto('/peppercorn/');await expect(page.getByRole('heading',{name:'오늘의 주도주',exact:true})).toBeVisible()
}
for(const width of [390,834,1366,1440])for(const theme of ['light','dark'] as const)test(`leader cards ${width} ${theme}: source, focus, scroll, detail and parity`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<1440,reducedMotion:'reduce'});const page=await context.newPage()
 await page.addInitScript(theme=>localStorage.setItem('folio-theme',theme),theme);await boot(page)
 const cards=page.locator('.leader-cover');await expect(cards).toHaveCount(4)
 const tickers=await cards.evaluateAll(elements=>elements.map(e=>e.getAttribute('data-ticker')))
 const card=page.getByRole('button',{name:'SK하이닉스 관련 변화 열기'});await card.scrollIntoViewIfNeeded();await card.focus();const scroll=await page.evaluate(()=>scrollY)
 await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('button',{name:'카드 닫기'})).toBeFocused()
 await expect(page.getByRole('link',{name:/내 리서치 원문/})).toHaveAttribute('href','https://www.skhynix.com/')
 await expect(page.getByRole('dialog')).toContainText('오래된 자료');await expect(page.getByRole('dialog')).toContainText('미검증');await expect(page.getByRole('dialog')).toContainText('나의 해석')
 await expect(page.getByRole('dialog')).not.toContainText('연결되면 안 되는 관찰');await expect(page.getByRole('dialog')).toContainText('자동 수집 자료 없음')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.screenshot({path:`test-results/leader-expanded-${width}-${theme}.png`})
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(card).toBeFocused();expect(Math.abs(await page.evaluate(()=>scrollY)-scroll)).toBeLessThan(3)
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/leader-home-${width}-${theme}.png`})
 await card.click();await page.getByRole('button',{name:'종목 자세히 보기 →'}).click();await expect(page.locator('.analysis-body')).toBeVisible();await expect(page.locator('.analysis-body')).toContainText('SK하이닉스')
 await openPage(page,'시장 요약');const summary=page.locator('.journey-today .stock-trend-row');await expect(summary).toHaveCount(4)
 expect(await summary.evaluateAll(elements=>elements.map(e=>e.querySelector('.stock-trend-ticker')?.textContent))).toEqual(tickers)
 await openPage(page,'오늘');await page.getByRole('group',{name:'오늘의 주도주 시장'}).getByRole('button',{name:'KR',exact:true}).click();await expect(cards).toHaveCount(2);expect(await cards.evaluateAll(elements=>elements.every(e=>e.getAttribute('data-market')==='KR'))).toBe(true)
 await context.close()
})
test('missing source and journal navigation remain honest',async({page})=>{
 await boot(page,rows,[]);await page.getByRole('button',{name:'SK하이닉스 관련 변화 열기'}).click();await expect(page.getByRole('dialog')).toContainText('연결된 출처 자료가 없습니다.');await expect(page.getByRole('link',{name:/내 리서치 원문/})).toHaveCount(0)
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'저널에 기록',exact:true}).click();await expect(page.locator('.lifetime-journal')).toBeVisible()
})
test('no leadership candidates has an empty state rather than invented cards',async({page})=>{
 await boot(page,rows.map(row=>({...row,leadership_class:'중립',stage:'○ 관찰'})),[]);await expect(page.getByText('선별된 주도주가 없습니다.',{exact:true})).toBeVisible();await expect(page.locator('.leader-cover')).toHaveCount(0)
})

test('normal motion expands and reverses with keyboard focus restored',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});const page=await context.newPage();await boot(page);const card=page.getByRole('button',{name:'SK하이닉스 관련 변화 열기'});await card.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(card).toBeFocused();await context.close()
})
