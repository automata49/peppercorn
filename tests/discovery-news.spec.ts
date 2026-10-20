import {test,expect,type Page} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {openFilters,closeFilters} from './journey-helpers'
const now=new Date('2026-10-15T08:00:00Z').getTime(),stamp=(hours=0)=>new Date(now+hours*3600_000).toISOString()
const issuer=[['US','AAPL','Apple Newsroom','www.apple.com','Apple Park'],['US','NVDA','NVIDIA Newsroom','nvidianews.nvidia.com','Nvidia headquarters'],['KR','000660','SK hynix Newsroom','news.skhynix.com','SK Hynix'],['US','AMD','AMD Investor Relations','ir.amd.com','AMD headquarters']]
const stories=issuer.map(([market,ticker,publisher,host,alt],i)=>({id:`${market}:${ticker}:test`,market,ticker,headline:`테스트 ${ticker} · 공식 발표의 변화`,summary:'테스트 요약 · 공개 자료에서 확인한 변화와 기업의 발표를 전달합니다.',summary_kind:'ai_draft',collected_at:stamp(),expires_at:stamp(24),generated_at:stamp(),model:'gemini-3.5-flash-lite',prompt_version:'folio-news-1',evidence:'An exact public source fragment',source:{id:`source-${i}`,title:`Public source ${ticker}`,publisher,url:`https://${host}/test-news`,published_at:stamp(-i*12-1)},image:{url:`https://upload.wikimedia.org/test-${ticker}.jpg`,page_url:`https://commons.wikimedia.org/wiki/File:Test_${ticker}.jpg`,license:'CC BY-SA 4.0',license_url:'https://creativecommons.org/licenses/by-sa/4.0/',creator:'Test photographer',kind:'related',alt}}))
const feed={version:1,published_at:stamp(),ai_status:'enabled',items:stories}
const rows=[...demoRows,...['NVDA','AMD'].map(ticker=>({...demoRows[0],id:ticker,ticker,name:ticker,market:'US'}))]
test.beforeEach(async({page})=>{
 await page.route('**/data/instinct-leader-news.json*',r=>r.fulfill({json:{version:1,updated_at:stamp(),items:[]}}))
})
async function openNewsPage(page:Page){
 // Reload rehydrates the local app shell before binding nav actions.
 await expect(page.locator('.shell:not([inert])')).toBeVisible()
 for(let attempt=0;attempt<3;attempt++){
  if(await page.locator('.discovery-workspace').isVisible())return
  const mobile=page.locator('.mobile-bottom-nav').getByRole('button',{name:'발견',exact:true})
  if(await mobile.isVisible())await mobile.click()
  else await page.locator('.sidebar nav').getByRole('button',{name:'발견',exact:true}).click()
  try{await expect(page.locator('.discovery-workspace')).toBeVisible({timeout:2200});return}catch{}
 }
 await expect(page.locator('.discovery-workspace')).toBeVisible({timeout:10000})
}
async function boot(page:Page,value:unknown=feed,reportedRows=rows){
 await page.clock.setFixedTime(new Date(now))
 await page.addInitScript(()=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-stock-size','all')})
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}));await page.route('**/data/stock-flags.json*',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:reportedRows}}));await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}));await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}));await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.route('**/data/leader-insights.json*',r=>r.fulfill({json:value}))
 await page.route('https://upload.wikimedia.org/**',r=>r.fulfill({path:'public/folio-brand-photography.webp'}))
 await page.goto('/peppercorn/');await openNewsPage(page)
}
for(const [width,height] of [[390,844],[844,390],[834,1194],[1194,834],[1440,900]])test(`news ${width}x${height}: responsive editorial, grounded sources, market filter and detail link`,async({page})=>{
 await page.setViewportSize({width,height});await boot(page)
 const section=page.getByRole('region',{name:'시장과 종목의 최신 뉴스'}),list=section.locator('.discovery-news-stories')
 await expect(section).toBeVisible();await expect(section.getByRole('group',{name:'MARKET & COMPANIES 종목 규모'}).getByRole('button',{name:'리포트'})).toHaveAttribute('aria-pressed','true')
 await section.getByRole('group',{name:'MARKET & COMPANIES 종목 규모'}).getByRole('button',{name:'전체'}).click()
 await expect(section.locator('article')).toHaveCount(4)
 await expect(section.locator('h4').first()).toHaveText(stories[0].headline);await expect(section).toContainText(stories[0].summary);await expect(section).toContainText('AI 요약 초안');await expect(section).toContainText('원문 사진 아님')
 await expect(section.getByRole('link',{name:'원문 읽기 ↗'}).first()).toHaveAttribute('href',stories[0].source.url);await expect(section.locator('time').first()).toHaveAttribute('datetime',stories[0].source.published_at)
 const geometry=await list.evaluate(el=>({scroll:el.scrollWidth>el.clientWidth,columns:getComputedStyle(el).gridTemplateColumns.split(' ').length}))
 if(width<height)expect(geometry.scroll).toBe(true);else{expect(geometry.scroll).toBe(false);expect(geometry.columns).toBe(width>=1101?4:3)}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:`test-results/discovery-news-${width}-${height}.png`})
 await section.getByRole('button',{name:'종목 보기 →'}).first().click();await expect(page.locator('.hero-name')).toHaveText('Apple')
 await openNewsPage(page);await openFilters(page);await page.locator('[data-wheel="시장"]').getByRole('button',{name:'KR',exact:true}).click();await closeFilters(page)
 await section.getByRole('group',{name:'MARKET & COMPANIES 종목 규모'}).getByRole('button',{name:'전체'}).click()
 await expect(section.locator('article')).toHaveCount(1);await expect(section).toContainText('SK하이닉스')
})
test('expired news disappears and failed photos use labelled decorative art',async({page})=>{
 await boot(page);await page.route('https://upload.wikimedia.org/**',r=>r.fulfill({status:404,body:''}));await page.reload();await openNewsPage(page);await page.getByRole('group',{name:'MARKET & COMPANIES 종목 규모'}).getByRole('button',{name:'전체'}).click();await expect(page.locator('.discovery-news-story img').first()).toHaveAttribute('src',/folio-retro-discover/);await expect(page.locator('.discovery-news-story').first()).toContainText('Folio 이미지 · 원문 사진 아님')
 await page.route('**/data/leader-insights.json*',r=>r.fulfill({json:{...feed,items:stories.map(i=>({...i,expires_at:stamp(-1)}))}}));await page.reload();await openNewsPage(page);await expect(page.locator('.discovery-news')).toBeVisible();await expect(page.locator('.discovery-news-story')).toHaveCount(0);await expect(page.getByRole('region',{name:'시장과 종목의 최신 뉴스'}).getByRole('button',{name:'리포트'})).toHaveAttribute('aria-pressed','true')
})

test('Instinct Drive news matches Folio leader classification and leaves research separate',async({page})=>{
 const current=stamp(-2)
 await page.route('**/data/instinct-leader-news.json*',r=>r.fulfill({json:{version:1,updated_at:stamp(),items:[
  {market:'US',ticker:'AAPL',headline:'Instinct provided leadership stock news',summary:'The company announced an update that can be checked from the original source.',source_name:'Apple Newsroom',source_url:'https://www.apple.com/newsroom/2026/10/test',published_at:current},
  {market:'US',ticker:'AEM',headline:'Not a leading stock story',summary:'Should not display as it is not in the Folio leader categories.',source_name:'Source',source_url:'https://example.com/story',published_at:current},
  {market:'US',ticker:'AAPL',headline:'Invalid story URL',summary:'Google Drive links must not be published as news sources.',source_name:'Source',source_url:'https://drive.google.com/file/d/secret/view',published_at:current}
 ]}}))
 const classified=rows.map(r=>r.ticker==='AAPL'?{...r,leadership_class:'핵심 주도'}:r)
 await boot(page,feed,classified)
 const section=page.getByRole('region',{name:'시장과 종목의 최신 뉴스'})
 await section.getByRole('group',{name:'MARKET & COMPANIES 종목 규모'}).getByRole('button',{name:'전체'}).click()
 await expect(section).toContainText('Instinct provided leadership stock news')
 await expect(section).toContainText('핵심 주도')
 await expect(section).toContainText('Instinct AI 요약')
 await expect(section).not.toContainText('Not a leading stock story')
 await expect(section).not.toContainText('Invalid story URL')
 await expect(section.getByRole('link',{name:'Instinct provided leadership stock news 원문 열기'})).toHaveAttribute('href','https://www.apple.com/newsroom/2026/10/test')
})

test('generated editorial image uses source-grounded labeling and falls back when unavailable',async({page})=>{
 const visualPath='data/news-assets/'+'a'.repeat(20)+'.svg'
 await page.route('**/data/instinct-leader-news.json*',r=>r.fulfill({json:{
  version:1,updated_at:stamp(),items:[{
   market:'US',ticker:'AAPL',headline:'A factual product platform announcement',
   summary:'The company announced a new platform for enterprises.',
   source_name:'Example Newsroom',source_url:'https://example.com/press/aapl',
   published_at:stamp(-1),
   visual:{kind:'illustration',url:visualPath,alt:'Folio ai 관련 개념 일러스트 · 실제 기사 사진 아님',credit:'Folio 편집 일러스트',topic:'ai'}
  }]
 }}))
 await page.route('**/data/news-assets/**',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#eee"/></svg>'}))
 const selected=rows.map(r=>r.ticker==='AAPL'?{...r,leadership_class:'핵심 주도'}:r)
 await boot(page,feed,selected)
 const section=page.getByRole('region',{name:'시장과 종목의 최신 뉴스'})
 await section.getByRole('group',{name:'MARKET & COMPANIES 종목 규모'}).getByRole('button',{name:'전체'}).click()
 const first=section.locator('.discovery-news-story').first()
 await expect(first).toContainText('Folio 편집 일러스트 · 실제 기사 사진 아님')
 await expect(first.locator('img')).toHaveAttribute('src',new RegExp('news-assets/'+ 'a'.repeat(20)+'.svg'))
 await page.route('**/data/news-assets/**',r=>r.fulfill({status:404}))
 await page.reload();await openNewsPage(page)
 await page.getByRole('group',{name:'MARKET & COMPANIES 종목 규모'}).getByRole('button',{name:'전체'}).click()
 const again=page.getByRole('region',{name:'시장과 종목의 최신 뉴스'}).locator('.discovery-news-story').first()
 await expect(again.locator('img')).toHaveAttribute('src',/folio-(?:brand|retro|vivid)/)
 await expect(again).toContainText('Folio 이미지 · 원문 사진 아님')
})

test('GLOBAL TREND news is featured without ticker even outside leaderboard and works with KR filter',async({page})=>{
 await page.route('**/data/instinct-leader-news.json*',r=>r.fulfill({json:{
  version:1,updated_at:stamp(),items:[
   {type:'trend',market:'GLOBAL',trend_topic:'AI Infrastructure',
    headline:'Major AI infrastructure adoption expands',
    summary:'Confirmed project deployment and equipment delivery across several regions.',
    source_name:'Original Newsroom',source_url:'https://example.com/research/ai-infrastructure',
    published_at:stamp(-1)},
   {market:'US',ticker:'AEM',headline:'A non-leading company announcement',
    summary:'This separate company announcement must not be elevated to a Folio leader story.',
    source_name:'Example',source_url:'https://example.com/company/aem',published_at:stamp(-2)}
  ]
 }}))
 await boot(page)
 const section=page.getByRole('region',{name:'시장과 종목의 최신 뉴스'})
 await section.getByRole('button',{name:'전체',exact:true}).click()
 const card=section.locator('article[data-kind="trend"]')
 await expect(card).toHaveCount(1)
 await expect(card).toContainText('TREND')
 await expect(card).toContainText('AI Infrastructure')
 await expect(card).toContainText('Major AI infrastructure adoption expands')
 await expect(card.getByRole('button',{name:'종목 보기 →'})).toHaveCount(0)
 await expect(card.getByRole('link',{name:'원문 읽기 ↗'})).toHaveAttribute('href','https://example.com/research/ai-infrastructure')
 await expect(section).not.toContainText('A non-leading company announcement')
 await openFilters(page)
 await page.locator('[data-wheel="시장"]').getByRole('button',{name:'KR',exact:true}).click()
 await closeFilters(page)
 await expect(card).toBeVisible()
})

test('report-first stays visible for guests when both news feeds are empty',async({page})=>{
 await boot(page,{...feed,items:[]})
 const section=page.getByRole('region',{name:'시장과 종목의 최신 뉴스'})
 await expect(section).toBeVisible()
 await expect(section.getByRole('button',{name:'리포트',exact:true})).toHaveAttribute('aria-pressed','true')
 await expect(section).toContainText('로그인 후 Folio 리서치 리포트를 볼 수 있습니다.')
 await section.getByRole('button',{name:'전체',exact:true}).click()
 await expect(section).toContainText('최근 7일에 해당하는 전체 종목 뉴스가 없습니다.')
})
