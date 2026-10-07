import {test,expect,type Page} from '@playwright/test'
import {openPage} from './journey-helpers'
import {demoRows} from '../src/data/mock'
const rows=demoRows.map((r,i)=>({...r,leadership_class:'핵심 주도',rs_rank:99-i}))
async function boot(page:Page){
 await page.addInitScript(()=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-theme','light')})
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>{const ids=new URL(r.request().url()).searchParams.get('ids')?.split(',')||[];return r.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,[['2026-09-28',100],['2026-09-29',104],['2026-09-30',102],['2026-10-01',108]]]))}})})
 await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('/peppercorn/')
 await expect(page.locator('.journey-today .decision-row').first()).toBeVisible()
}
async function nav(page:Page,label:string){const side=page.locator('.sidebar nav').getByRole('button',{name:label,exact:true});if(await side.isVisible())await side.click();else await page.locator('.mobile-bottom-nav').getByRole('button',{name:label,exact:true}).click()}
for(const width of [390,834,1366,1440])test(`journey ${width}: home → detail → thesis → tracking, identity and overflow`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<1440})
 const page=await context.newPage();await boot(page)
 await expect(page.locator('.journey-classes button')).toHaveCount(4)
 await expect(page.getByRole('heading',{name:'오늘의 주도주',exact:true})).toBeVisible()
 expect(await page.locator('.journey-today .decision-row').count()).toBeLessThanOrEqual(5)
 const todayBox=(await page.locator('.journey-today').boundingBox())!
 const classesBox=(await page.locator('.journey-classes').boundingBox())!
 expect(todayBox.y).toBeLessThan(classesBox.y)
 await expect(page.locator('.leader-spotlight,.dashboard-sector-panel')).toHaveCount(0)
 const brand=width===1440?page.locator('.sidebar .folio-wordmark-system'):page.locator('.mobile-brandbar .folio-wordmark-system')
 await expect(brand.locator('.folio-wordmark-image:visible')).toHaveCount(1)
 await page.screenshot({path:`test-results/journey-home-${width}.png`,fullPage:true})
 await page.locator('.journey-today .decision-row').first().click()
 await expect(page.locator('.analysis-price-momentum')).toBeVisible()
 await expect(page.locator('.analysis-finder')).toHaveCount(0)
 await expect(page.locator('.analysis-detail-tabs [role=tab]')).toHaveText(['Overview','Analysis','Financials','Thesis'])
 await page.screenshot({path:`test-results/journey-detail-${width}.png`,fullPage:true})
 await page.locator('.analysis-actionbar').getByRole('button',{name:/Thesis/}).click()
 await expect(page.locator('.page-thesis')).toBeVisible()
 await expect(page.locator('.analysis-price-momentum')).toHaveCount(0)
 const conclusion=page.getByRole('textbox',{name:'내 결론',exact:true})
 await conclusion.fill('성장 동력 확인 후 추적');await conclusion.blur()
 await nav(page,'추적')
 await expect(page.getByRole('tablist',{name:'추적 영역'}).getByRole('tab')).toHaveText(['관심종목','보유종목','투자일지'])
 await page.getByRole('tab',{name:'보유종목',exact:true}).click();await expect(page.locator('.workspace-mobile-summary:visible,.workspace-grid-panel:visible').first()).toBeVisible()
 await nav(page,'Thesis');await expect(conclusion).toHaveValue('성장 동력 확인 후 추적')
 await nav(page,'탐색');await expect(page.locator('.analysis-finder')).toBeVisible();await expect(page.locator('.analysis-price-momentum')).toHaveCount(0)
 const leadershipScope=page.locator('.analysis-scope')
 const activeScope=leadershipScope.locator('button[aria-pressed="true"]')
 if(await activeScope.count())await activeScope.first().click()
 await expect(page.locator('.analysis-idea-list > button')).toHaveCount(rows.length)
 await expect(leadershipScope.getByRole('button')).toHaveText(['핵심 주도','주도 후보','강세 전환','조정 중'])
 for(const control of await leadershipScope.locator('button').all()){expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.screenshot({path:`test-results/journey-explore-${width}.png`,fullPage:true})
 await page.locator('.analysis-idea-list > button').first().click();await page.getByRole('button',{name:'← 탐색 목록'}).click()
 await expect(page.locator('.analysis-scope button[aria-pressed="true"]')).toHaveCount(0)
 await context.close()
})
test('Home Today market summarizes the Sector ETF signal and opens the full signal page',async({page})=>{
 await boot(page)
 const market=page.locator('.journey-market')
 await expect(market.getByRole('heading',{name:'오늘의 시장'})).toBeVisible()
 await expect(market).toContainText('시장 폭 · MA50 위')
 await expect(market).toContainText('주도 섹터')
 await expect(market).toContainText('ETF RS 1위')
 await market.getByRole('button',{name:'전체 보기 →',exact:true}).click()
 await expect(page.locator('.page-signal')).toBeVisible()
 await expect(page.locator('.signal-journey-heading').getByRole('heading',{name:'시장 신호',exact:true})).toBeVisible()
 await expect(page.locator('.sector-heat-disclosure')).toBeVisible()
 await expect(page.locator('.dashboard-explore-expanded')).toBeVisible()
})

test('Thesis opens and edits the selected dated record, retaining both versions after reload',async({page})=>{
 const stock=rows[0]
 await page.addInitScript((r)=>{if(!localStorage.getItem('peppercorn-analysis'))localStorage.setItem('peppercorn-analysis',JSON.stringify([{id:100,date:'2026-09-01',market:r.market,ticker:r.ticker,name:r.name,conclusion:'older thesis'},{id:'new',date:'2026-10-01',market:r.market,ticker:r.ticker,name:r.name,conclusion:'newer thesis'}]))},stock)
 await boot(page);await nav(page,'Thesis')
 await page.locator('.journey-theses .decision-row').filter({hasText:'2026-09-01'}).click()
 const input=page.getByRole('textbox',{name:'내 결론',exact:true});await expect(input).toHaveValue('older thesis')
 await input.fill('edited older thesis');await input.blur()
 await page.locator('.journey-theses .decision-row').filter({hasText:'2026-10-01'}).click();await expect(input).toHaveValue('newer thesis')
 await page.reload();await nav(page,'Thesis');await page.locator('.journey-theses .decision-row').filter({hasText:'2026-09-01'}).click();await expect(input).toHaveValue('edited older thesis')
})

test('archived Thesis remains editable without fabricating market data',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('peppercorn-analysis',JSON.stringify([{id:42,market:'US',ticker:'ARCHIVED',name:'보관 종목',date:'2026-09-01',conclusion:'보관 근거'}])))
 await boot(page);await nav(page,'Thesis');await page.locator('.journey-theses .decision-row').filter({hasText:'ARCHIVED'}).click()
 await expect(page.getByText('현재 유니버스에 없는 보관 기록입니다.',{exact:false})).toBeVisible()
 const input=page.getByRole('textbox',{name:'내 결론',exact:true});await expect(input).toHaveValue('보관 근거')
 await input.fill('보관 기록 수정');await input.blur()
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-analysis')||'[]')[0].conclusion)).toBe('보관 기록 수정')
 await expect(page.locator('.analysis-price-momentum')).toHaveCount(0)
})
test('Explore market change clears the prior market sector',async({page})=>{
 await boot(page);await nav(page,'탐색');{const active=page.locator('.analysis-scope button[aria-pressed="true"]');if(await active.count())await active.first().click()}
 await page.getByRole('group',{name:'탐색 시장'}).getByRole('button',{name:'US',exact:true}).click()
 const sector=page.getByRole('combobox',{name:'탐색 섹터'});await sector.selectOption({index:1})
 await page.getByRole('group',{name:'탐색 시장'}).getByRole('button',{name:'KR',exact:true}).click();await expect(sector).toHaveValue('')
 expect(await page.locator('.analysis-idea-list > button').count()).toBeGreaterThan(0)
})

test('Explore ignores hidden catalog search after external stock detail',async({page})=>{
 await page.setViewportSize({width:390,height:1000});await boot(page)
 await openPage(page,'Universe')
 await page.getByPlaceholder('Ticker · 종목 · 산업 · 섹터 검색').fill(rows[0].ticker)
 await page.locator('.catalog-mobile-summary .decision-row').first().click()
 await page.getByRole('button',{name:'← 탐색 목록'}).click()
 {const active=page.locator('.analysis-scope button[aria-pressed="true"]');if(await active.count())await active.first().click()}
 await expect(page.locator('.analysis-idea-list > button')).toHaveCount(rows.length)
})
