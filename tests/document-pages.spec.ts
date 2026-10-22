import { test, expect, type Page } from '@playwright/test'
import { demoRows } from '../src/data/mock'
import { blankSnapshot, parseNotebook } from '../src/lib/lifetimeJournal'
import { openPage } from './journey-helpers'

const holding={id:'holding',market:'US',ticker:'AAPL',name:'Apple',shares:2,avg_price:100,currency:'KRW'}
async function setup(page:Page,holdings:unknown[]=[holding],missingPrices=false){
 await page.addInitScript(holdings=>{
  sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-stock-size','all')
  localStorage.setItem('peppercorn-research',JSON.stringify([{id:'sourced',date:'2026-01-01',title:'공시에서 발견한 수요',fact:'이것은 저장한 관찰 사실입니다.',interpretation:'이것은 나의 해석입니다.',source:'https://www.apple.com/newsroom/',verification:'미검증',market:'US',ticker:'AAPL'}]))
  localStorage.setItem('peppercorn-portfolio',JSON.stringify(holdings))
 },holdings)
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:missingPrices?demoRows.map(row=>({...row,price:null})):demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.goto('/peppercorn/')
 await expect(page.locator('.home-heading h2')).toBeVisible()
}

for(const width of [390,834,1366,1440])test(`document pages ${width}: source tabs, structured revision, collage and journey`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<1440})
 test.setTimeout(60000)
 const page=await context.newPage();await setup(page)
 await expect(page.locator('.home-heading')).toContainText('오늘')
 await openPage(page,'발견')
 await expect(page.getByRole('heading',{name:'변화하는 세상을 읽다',exact:true})).toBeVisible()
 await expect(page.getByRole('tablist',{name:'발견 영역'}).getByRole('tab')).toHaveText(['시장 신호','종목 검토','리서치 기록'])
 await page.getByRole('tab',{name:'종목 검토',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'리서치 기록',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('.analysis-finder')).toHaveCount(0)
 await expect(page.locator('.discovery-topic')).toContainText('이것은 저장한 관찰 사실입니다.')
 await expect(page.locator('.discovery-provenance')).toContainText('오래된 관찰')
 await expect(page.getByRole('link',{name:/출처 확인/})).toHaveAttribute('href','https://www.apple.com/newsroom/')
 await page.getByRole('button',{name:'AAPL · 기업 살펴보기 →'}).click()
 await expect(page.locator('.analysis-body')).toBeVisible()
 await page.getByRole('button',{name:'뒤로 가기'}).click()
 await expect(page.getByRole('tab',{name:'리서치 기록',exact:true})).toHaveAttribute('aria-selected','true')
 await page.getByRole('tab',{name:'시장 신호',exact:true}).click()
 await expect(page.locator('.dashboard-sector-panel')).toBeVisible()
 await expect(page.locator('.dashboard-etf-panel')).toBeVisible()
 await page.getByRole('tab',{name:'종목 검토',exact:true}).click()
 await expect(page.locator('.analysis-finder')).toBeVisible()
 await openPage(page,'저널');await page.getByRole('button',{name:'새 페이지',exact:true}).click()
 await page.getByLabel('기록 제목', {exact:true}).fill('나의 투자 가설')
 await page.getByLabel('기록 분류',{exact:true}).selectOption('investment')
 await page.getByLabel('내 가설',{exact:true}).fill('가격보다 현금 흐름을 확인한다.')
 await page.getByLabel('반대 증거',{exact:true}).fill('수요가 실적과 다를 수 있다.')
 await page.getByLabel('기록 사진',{exact:true}).setInputFiles(['public/folio-brand-photography.webp','public/folio-brand-typography.webp'])
 await expect(page.locator('.journal-photo-collage img')).toHaveCount(2)
 await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.getByRole('button',{name:'나의 투자 가설 기록 열기',exact:true}).click();await page.locator('.journal-read-actions').getByRole('button',{name:'수정'}).click();
 await expect(page.getByLabel('내 가설',{exact:true})).toHaveValue('가격보다 현금 흐름을 확인한다.')
 await expect(page.locator('.journal-photo-collage img')).toHaveCount(2)
 await page.getByLabel('내 가설',{exact:true}).fill('새 공시로 판단을 바꿨다.')
 await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.getByLabel('내 기록 검색',{exact:true}).fill('새 공시')
 await expect(page.locator('.journal-albums .journal-gallery>button')).toHaveCount(1)
 await page.getByText('저장 및 백업',{exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'백업 내보내기'}).click();const file=await download;expect(await file.path()).toBeTruthy()
 await openPage(page,'여정');await expect(page.getByRole('tablist',{name:'여정 영역'}).getByRole('tab')).toHaveText(['재검토','관심종목','보유종목'])
 await page.getByText('원본 판단 비교',{exact:true}).click();await expect(page.locator('.journey-judgement')).toContainText('가격보다 현금 흐름을 확인한다.')
 await expect(page.locator('.journey-judgement')).toContainText('새 공시로 판단을 바꿨다.')
 await expect(page.locator('.journey-judgement time')).toHaveCount(2)
 await page.getByText('자산 흐름 펼치기',{exact:true}).click()
 await expect(page.locator('.journey-assets')).toContainText('682.14 USD')
 await expect(page.locator('.journey-assets')).toContainText('200 KRW')
 await expect(page.locator('.journey-assets')).toContainText('통화가 달라')
 await page.getByRole('tab',{name:'재검토',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'관심종목',exact:true})).toHaveAttribute('aria-selected','true');await page.getByRole('tab',{name:'보유종목',exact:true}).click()
 await page.getByRole('tab',{name:'재검토',exact:true}).click();await page.getByRole('tab',{name:'보유종목',exact:true}).click()
 await expect(page.getByRole('tab',{name:'보유종목',exact:true})).toHaveAttribute('aria-selected','true')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await context.close()
})

test('legacy backups retain writing while new fields and photos survive all revisions',()=>{
 const legacy={...blankSnapshot(),title:'old',id:'old',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-02T00:00:00Z',revisions:[]}
 delete legacy.hypothesis;delete legacy.counterEvidence;delete legacy.photos
 legacy.photo='data:image/png;base64,aGVsbG8='
 const old=parseNotebook(JSON.stringify({format:'folio-journal',version:1,entries:[legacy]}))[0]
 expect(old).toMatchObject({title:'old',photo:legacy.photo,hypothesis:'',counterEvidence:'',photos:[]})
 const photo='data:image/png;base64,aGVsbG8='
 const current={...old,hypothesis:'my thesis',counterEvidence:'my evidence',photos:[photo],photo,revisions:[{at:old.updatedAt,snapshot:{...blankSnapshot(),hypothesis:'earlier thesis',counterEvidence:'earlier evidence',photos:[photo],photo}}]}
 const parsed=parseNotebook(JSON.stringify({format:'folio-journal',version:1,entries:[current]}))[0]
 expect(parsed).toEqual(current)
 expect(()=>parseNotebook(JSON.stringify({format:'folio-journal',version:1,entries:[{...current,photos:['javascript:alert(1)']}]}))).toThrow()
 expect(()=>parseNotebook(JSON.stringify({format:'folio-journal',version:1,entries:[{...current,photos:Array(5).fill(photo)}]}))).toThrow()
})

test('journey assets disclose empty holdings and missing market prices',async({browser})=>{
 const context=await browser.newContext();const empty=await context.newPage();await setup(empty,[]);await openPage(empty,'여정');await empty.getByText('자산 흐름 펼치기',{exact:true}).click();await expect(empty.locator('.journey-assets')).toContainText('보유 수량이 기록된 종목이 없습니다.')
 const unknown=await context.newPage();await setup(unknown,[holding],true);await openPage(unknown,'여정');await unknown.getByText('자산 흐름 펼치기',{exact:true}).click();await expect(unknown.locator('.journey-assets')).toContainText('시장 가격 확인 필요');await expect(unknown.locator('.journey-assets')).toContainText('200 KRW');await context.close()
})

test('journal owns life records while journey reviews investment with long text safely',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page)
 const base=blankSnapshot(),at='2026-10-01T09:00:00Z'
 const records=[{...base,id:'linked-life',kind:'life',ticker:'US:AAPL',title:'종목이 연결된 일상 기록',createdAt:at,updatedAt:at,revisions:[]},{...base,id:'long-investment',kind:'investment',ticker:'US:'+ 'A'.repeat(120),title:'투자판단'.repeat(80),hypothesis:'https://example.com/'+ 'evidence'.repeat(80),createdAt:at,updatedAt:at,revisions:[]}]
 await page.evaluate(async records=>{await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('folio-lifetime-journal',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('notebooks','readwrite');tx.objectStore('notebooks').put(records,'guest');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}})},records)
 await page.reload();await openPage(page,'저널');await expect(page.locator('.journal-albums .journal-gallery>button')).toHaveCount(2)
 await openPage(page,'여정');await expect(page.locator('.review-gallery-item')).toHaveCount(1);await expect(page.locator('.journey-review')).not.toContainText(records[0].title)
 await expect(page.locator('.review-gallery-item .journal-story')).toHaveCount(0)
 expect(await page.locator('.decision-queue-judgement').first().textContent()).toHaveLength(180)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.getByRole('button',{name:records[1].title+' 기록 열기',exact:true}).click();await page.locator('.journal-read-actions').getByRole('button',{name:'수정'}).click();await expect(page.getByRole('textbox',{name:'기록 제목'})).toHaveValue(records[1].title)
})
