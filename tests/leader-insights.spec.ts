import {test,expect} from '@playwright/test'
import {parseInsights,type LeaderInsight} from '../src/lib/leaderInsights'
import {demoRows} from '../src/data/mock'
const now=Date.now(),stamp=(offset=0)=>new Date(now+offset).toISOString()
const item:LeaderInsight={id:'KR:000660:news',market:'KR',ticker:'000660',headline:'테스트 요약 · 공개 자료에서 수요 변화를 확인',summary:'테스트 요약 · 원문을 바탕으로 정리한 초안입니다.',summary_kind:'ai_draft',evidence:'An exact public source fragment',model:'gemini-2.5-flash-lite',prompt_version:'folio-news-1',generated_at:stamp(),collected_at:stamp(),expires_at:stamp(3600_000),source:{id:'source-1',url:'https://news.skhynix.com/en/test-source/',title:'A public issuer source',publisher:'SK hynix Newsroom',published_at:stamp(-86400_000)},image:{url:'https://upload.wikimedia.org/test-fixture.jpg',page_url:'https://commons.wikimedia.org/wiki/File:Test.jpg',license:'CC BY-SA 4.0',license_url:'https://creativecommons.org/licenses/by-sa/4.0/',creator:'Test photographer',kind:'related',alt:'SK Hynix headquarters test photograph'}}
const feed=(items:unknown[]=[item])=>({version:1,published_at:stamp(),ai_status:'enabled',items})
test('public snapshot fails closed for stale/oversized/version/expiry/source/model identities',()=>{
 expect(parseInsights(feed(),now)?.items).toHaveLength(1)
 for(const value of [{...feed(),version:2},{...feed(),published_at:stamp(-49*3600_000)},{...feed(),published_at:stamp(2*3600_000)},{...feed(),items:Array(21).fill(item)}])expect(parseInsights(value,now)).toBeNull()
 for(const changes of [{ticker:'AAPL'},{market:'US'},{expires_at:stamp(-1)},{headline:'x'.repeat(71)},{model:'invented-model'},{evidence:''},{source:{...item.source,url:'https://evil.example/test'}},{source:{...item.source,published_at:stamp(-15*86400_000)}},{source:{...item.source,published_at:stamp(2*3600_000)}},{source:{...item.source,published_at:'2026-10-11T09:00:00'}}])expect(parseInsights(feed([{...item,...changes}]),now)?.items).toHaveLength(0)
 expect(parseInsights(feed([item,item]),now)?.items).toHaveLength(1)
})
test('unlicensed, private or falsely original images cannot replace decorative art',()=>{
 for(const changes of [{license:'All rights reserved'},{url:'http://upload.wikimedia.org/a.jpg'},{url:'https://127.0.0.1/a.jpg'},{page_url:'https://evil.example/a'},{creator:''},{kind:'original'},{license_url:'javascript:alert(1)'}])expect(parseInsights(feed([{...item,image:{...item.image,...changes}}]),now)?.items[0].image).toBeNull()
})
for(const width of [390,834,1366,1440])for(const theme of ['light','dark'])test(`source-backed cover ${width} ${theme}: draft, attribution, original and fallback`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage()
 await page.addInitScript(theme=>{localStorage.setItem('folio-theme',theme);localStorage.setItem('folio-stock-size','all');sessionStorage.setItem('peppercorn-intro-seen','1')},theme)
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}));await page.route('**/data/stock-flags.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows.map((row,i)=>({...row,leadership_class:i===2?'중립':'핵심 주도'}))}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}));await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}));await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.route('**/data/leader-insights.json*',r=>r.fulfill({json:feed()}))
 await page.route('https://upload.wikimedia.org/**',r=>r.fulfill({path:'public/folio-brand-photography.webp'}))
 await page.goto('/peppercorn/');const card=page.getByRole('button',{name:'SK하이닉스 관련 변화 열기'})
 await expect(card).toContainText(item.headline);await expect(card).toContainText('AI 요약 초안');await expect(card).toContainText('관련 사진 · CC BY-SA 4.0');await expect(card.locator('img')).toHaveAttribute('src',item.image!.url)
 const tickers=await page.locator('.leader-cover').evaluateAll(es=>es.map(e=>e.getAttribute('data-ticker')))
 await card.click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText(item.summary);await expect(dialog).toContainText(item.evidence!);await expect(dialog).toContainText('사실 확인 필요');await expect(dialog).toContainText('기사 원문 사진 아님');await expect(dialog).toContainText('Test photographer');await expect(dialog.getByRole('link',{name:/원문 보기/})).toHaveAttribute('href',item.source.url);await expect(dialog.getByRole('link',{name:'사진 원본 ↗'})).toHaveAttribute('href',item.image!.page_url)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.waitForTimeout(500);await page.screenshot({path:`test-results/sourced-card-${width}-${theme}.png`})
 await page.keyboard.press('Escape');await expect(card).toBeFocused();expect(await page.locator('.leader-cover').evaluateAll(es=>es.map(e=>e.getAttribute('data-ticker')))).toEqual(tickers)
 // An image network failure removes the attribution claim and restores the approved decorative fallback.
 await page.route('https://upload.wikimedia.org/**',r=>r.fulfill({status:404,body:''}));await page.reload();await expect(card).toContainText('Folio 이미지 · 원문 사진 아님');await expect(card.locator('img')).toHaveAttribute('src',/folio-brand-photography.webp/)
 await page.route('**/data/leader-insights.json*',r=>r.fulfill({json:{...feed([{...item,summary_kind:'source_excerpt',summary:'',headline:'테스트 원문 제목 · 공개 자료의 변화',model:undefined,prompt_version:undefined,evidence:undefined,generated_at:undefined}]),ai_status:'not_configured'}}))
 await page.reload();await expect(card).toContainText('테스트 원문 제목');await expect(card).toContainText('원문 제목');await expect(card).not.toContainText('AI 요약 초안');await card.click();await expect(page.getByRole('dialog')).toContainText('AI 요약 미활성')
 await context.close()
})
