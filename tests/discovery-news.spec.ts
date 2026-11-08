import {test,expect,type Page} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {parseInsights} from '../src/lib/leaderInsights'
import {diverseInstinctNews,parseInstinctNews,type InstinctArticle} from '../src/lib/instinctLeaderNews'
const now=Date.parse('2026-10-26T08:00:00Z'),stamp=(hours=0)=>new Date(now+hours*3600_000).toISOString()
const news:InstinctArticle[]=[
 {market:'US',ticker:'AAPL',headline:'기업 실적이 공개 자료에서 확인됐다',summary:'매출과 설비 투자 변화가 원문 발표에서 확인됐습니다.',source_name:'Reuters',source_url:'https://www.reuters.com/article/one',published_at:stamp(-1)},
 {market:'KR',ticker:'000660',headline:'같은 출처의 후속 산업 뉴스',summary:'생산과 출하 관련 사실을 원문에서 확인할 수 있습니다.',source_name:'Reuters',source_url:'https://reuters.com/article/two',published_at:stamp(-2)},
 {type:'trend',market:'GLOBAL',trend_topic:'에너지·공급망',headline:'에너지 공급망 관련 산업 변화',summary:'여러 지역의 공급과 수요 변화를 공개 자료로 요약했습니다.',source_name:'AP',source_url:'https://apnews.com/article/energy',published_at:stamp(-3)},
 {market:'US',ticker:'UNKNOWN',headline:'종목 목록 밖 기업의 투자 발표',summary:'신규 투자 발표와 공급망 변화가 확인됐습니다.',source_name:'Bloomberg',source_url:'https://www.bloomberg.com/news/company',published_at:stamp(-4)},
 {type:'trend',market:'KR',trend_topic:'시장·정책',headline:'국내 시장과 정책의 새 소식',summary:'정책 변화와 시장 현황을 원문 사실로 전달합니다.',source_name:'연합뉴스',source_url:'https://www.yna.co.kr/view/policy',published_at:stamp(-5)},
]
const feed={version:1,updated_at:stamp(),items:news}
async function openNewsPage(page:Page){
 await expect(page.locator('.shell:not([inert])')).toBeVisible()
 if(!await page.locator('.discovery-workspace').isVisible()){
  const mobile=page.locator('.mobile-bottom-nav').getByRole('button',{name:'발견',exact:true})
  if(await mobile.isVisible())await mobile.click()
  else await page.locator('.sidebar nav').getByRole('button',{name:'발견',exact:true}).click()
 }
 await expect(page.locator('.discovery-workspace')).toBeVisible()
 await page.getByRole('tab',{name:'시장 신호'}).click()
}
async function boot(page:Page,items:unknown=news){
 await page.clock.setFixedTime(new Date(now))
 await page.addInitScript(()=>{
  sessionStorage.setItem('peppercorn-intro-seen','1')
  localStorage.setItem('folio-news-market','KR');localStorage.setItem('folio-news-size','etf')
 })
 await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404}))
 await page.route('**/data/stock-flags.json*',r=>r.fulfill({status:404}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.route('**/data/leader-insights.json*',r=>r.fulfill({json:{version:1,published_at:stamp(),ai_status:'not_configured',items:[]}}))
 await page.route('**/data/instinct-leader-news.json*',r=>r.fulfill({json:{...feed,items}}))
 await page.goto('/peppercorn/');await openNewsPage(page)
}

test('publisher diversity preserves summaries and older articles while deduplicating safe sources',()=>{
 const duplicate={...news[0],source_url:news[0].source_url+'#top'}
 const stale={...news[2],published_at:stamp(-200)}
 const unsafe={...news[3],source_url:'https://drive.google.com/private'}
 const parsed=parseInstinctNews({...feed,items:[...news,duplicate,stale,unsafe]},now)!
 const ordered=diverseInstinctNews(parsed.items,now)
 expect(ordered.map(i=>i.source_name)).toEqual(['Reuters','AP','Bloomberg','연합뉴스','Reuters'])
 expect(ordered.find(i=>i.headline===news[3].headline)?.summary).toBe(news[3].summary)
 expect(news[1].source_name).toBe('Reuters')
 expect(diverseInstinctNews(parsed.items,now+8*86400_000)).toHaveLength(5)
 expect(parseInstinctNews({...feed,items:[stale]},now)?.items).toHaveLength(1)
})
for(const theme of ['light','dark'])for(const [width,height] of [[390,844],[834,1194],[1194,834],[1440,900]])test(`Instinct multi-source news without wheels ${theme} ${width}px`,async({page})=>{
 await page.setViewportSize({width,height})
 await page.addInitScript(t=>localStorage.setItem('folio-theme',t),theme)
 await boot(page)
 const section=page.getByRole('region',{name:'시장과 종목의 최신 뉴스'})
 await expect(section.locator('[data-wheel]')).toHaveCount(0)
 await expect(section.locator('.discovery-news-story')).toHaveCount(5)
 await expect(section).toContainText(news[3].headline)
 await expect(section).toContainText(news[4].headline)
 await expect(section).toContainText(news[1].headline)
 await expect(section.locator('.discovery-news-source').first()).toContainText('Reuters')
 await expect(section.getByRole('link',{name:'원문 읽기 ↗'}).first()).toHaveAttribute('href',news[0].source_url)
 await expect(section.locator('time').first()).toHaveAttribute('datetime',news[0].published_at)
 await expect(section).toContainText('Instinct AI 요약 · 원문 확인')
 await expect(section).toContainText('Folio 이미지 · 원문 사진 아님')
 await expect(section.locator('article').filter({hasText:news[3].headline}).getByRole('button',{name:'종목 보기 →'})).toHaveCount(0)
 await expect(section.getByRole('button',{name:'뉴스 더 보기'})).toHaveCount(0)
 await expect(section.locator('.discovery-news-story')).toHaveCount(5)
 await expect(section).toContainText(news[1].headline)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await section.locator('.discovery-news-heading').scrollIntoViewIfNeeded()
 await page.screenshot({path:`test-results/instinct-news-${theme}-${width}.png`})
 await page.reload();await openNewsPage(page)
 await expect(section.locator('[data-wheel]')).toHaveCount(0)
 await expect(section).toContainText(news[3].headline)
 // The independent stock catalogue still owns its original wheels.
 await page.getByRole('tab',{name:'종목 검토'}).click()
 await expect(page.locator('.analysis-finder [data-wheel="시장"]')).toBeVisible()
})
test('missing Instinct feed stays empty without company RSS fallback',async({page})=>{
 await boot(page,[])
 const section=page.getByRole('region',{name:'시장과 종목의 최신 뉴스'})
 const issuer={id:'US:NVDA:test',market:'US',ticker:'NVDA',headline:'NVIDIA issuer channel must stay absent',summary:'This is the old fixed company feed.',summary_kind:'source_excerpt',collected_at:stamp(),expires_at:stamp(24),generated_at:null,model:null,prompt_version:null,evidence:null,source:{id:'nvda',title:'Company channel',publisher:'NVIDIA Newsroom',url:'https://nvidianews.nvidia.com/news/test',published_at:stamp(-1)},image:null}
 const issuerFeed={version:1,published_at:stamp(),ai_status:'not_configured',items:[issuer]}
 expect(parseInsights(issuerFeed,now)?.items).toHaveLength(1)
 await page.route('**/data/leader-insights.json*',r=>r.fulfill({json:issuerFeed}))
 await page.reload();await openNewsPage(page)
 await expect(section.locator('article')).toHaveCount(0)
 await expect(section).toContainText('Instinct 뉴스가 없습니다.')
 await expect(section).not.toContainText(issuer.headline)
 await expect(section.locator('[data-wheel]')).toHaveCount(0)
 await expect(section).toContainText('로그인 후 리포트 요약과 전문도 함께 볼 수 있습니다.')
})
test('Instinct visual retains credit and falls back on image failure',async({page})=>{
 const url='data/news-assets/'+'a'.repeat(20)+'.svg'
 await page.route('**/data/news-assets/**',r=>r.fulfill({status:404}))
 await boot(page,[{...news[0],visual:{kind:'illustration',url,alt:'관련 개념 일러스트 · 실제 기사 사진 아님',credit:'Folio 편집 일러스트',topic:'ai'}}])
 const story=page.locator('.discovery-news-story').first()
 await expect(story.locator('img')).toHaveAttribute('src',/folio-(?:retro|vivid|brand)/)
 await expect(story).toContainText('Folio 이미지 · 원문 사진 아님')
 await expect(story.getByRole('button',{name:'종목 보기 →'})).toBeVisible()
 await story.getByRole('button',{name:'종목 보기 →'}).click()
 await expect(page.locator('.hero-name')).toHaveText('Apple')
})

for(const [width,height] of [[390,844],[834,1194],[1194,834],[1440,900]])test(`One horizontal news row at ${width}`,async({page})=>{
 await page.setViewportSize({width,height});await boot(page)
 const rail=page.getByRole('list',{name:'Instinct 뉴스 카드'})
 await expect(rail).toHaveCSS('overflow-x','auto')
 await expect(page.locator('.news-priority-group')).toHaveCount(0)
 const tops=await rail.locator('article').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top))
 expect(Math.max(...tops)-Math.min(...tops)).toBeLessThan(1)
 await rail.evaluate(el=>el.scrollLeft=el.scrollWidth)
 await expect.poll(()=>rail.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})
test('125 supplied articles remain on a single row without lengthening the news section',async({page})=>{
 const items=Array.from({length:125},(_,i)=>({...news[0],headline:`Instinct 전체 뉴스 항목 ${i}`,source_url:`https://www.reuters.com/article/${i}`,published_at:stamp(-24*(i+1))}))
 await boot(page,items)
 const rail=page.getByRole('list',{name:'Instinct 뉴스 카드'})
 await expect(rail.locator('article')).toHaveCount(125)
 expect((await rail.boundingBox())!.height).toBeLessThan(900)
 const tops=await rail.locator('article').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top))
 expect(Math.max(...tops)-Math.min(...tops)).toBeLessThan(1)
})
test('source percentage typography preserves ranges, zero and market colours',async({page})=>{
 await boot(page,[{...news[0],summary:'매출 +5.2%, 이익 -2.1%, 보합 +0%, 전망 10-20% 범위를 원문 그대로 표시합니다.'}])
 const article=page.locator('.discovery-news-story').first()
 await expect(article.locator('.discovery-news-copy>p')).toHaveText('매출 +5.2%, 이익 -2.1%, 보합 +0%, 전망 10-20% 범위를 원문 그대로 표시합니다.')
 await expect(article.locator('.research-percent.positive')).toHaveText('+5.2%')
 await expect(article.locator('.research-percent.negative')).toHaveText('-2.1%')
 await expect(article.locator('.research-percent')).toHaveCount(3)
 await expect(article.locator('.research-percent').last()).not.toHaveClass(/positive|negative/)
 await expect(article.locator('.news-stock-metrics')).toContainText('20D')
})

test('short Korean topics, long headlines and public HTTP original links remain readable',async({page})=>{
 const item={...news[2],trend_topic:'로봇',headline:'공개 원문에서 확인된 산업 변화에 관한 긴 제목 '.repeat(6),source_url:'http://www.hansbiz.co.kr/news/articleView.html?idxno=876567'}
 expect(parseInstinctNews({...feed,items:[item]},now)?.items).toHaveLength(1)
 expect(parseInstinctNews({...feed,items:[{...item,source_url:'http://localhost/private'}]},now)?.items).toHaveLength(0)
 await boot(page,[item])
 await expect(page.locator('.discovery-news-story')).toContainText('로봇')
 await expect(page.getByRole('link',{name:'원문 읽기 ↗'})).toHaveAttribute('href',item.source_url)
})

test('scraps persist across reload, survive a missing feed and can be removed',async({page})=>{
 await boot(page)
 const button=page.getByRole('button',{name:'스크랩 '+news[0].headline,exact:true})
 await button.click()
 await expect(page.getByRole('button',{name:'스크랩 · 1',exact:true})).toBeVisible()
 await page.reload();await openNewsPage(page)
 await page.route('**/data/instinct-leader-news.json*',r=>r.fulfill({json:{...feed,items:[]}}))
 await page.reload();await openNewsPage(page)
 await page.getByRole('button',{name:'스크랩 · 1',exact:true}).click()
 await expect(page.locator('.discovery-news-story')).toHaveCount(1)
 await expect(page.locator('.discovery-news-story')).toContainText(news[0].summary)
 await page.getByRole('button',{name:'스크랩 해제 '+news[0].headline,exact:true}).click()
 await expect(page.getByText('스크랩한 뉴스가 없습니다.',{exact:true})).toBeVisible()
})
test('failed storage never reports a successful scrap',async({page})=>{
 await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('folio-news-scraps:'))throw new DOMException('full','QuotaExceededError');return original.call(this,k,v)}})
 await boot(page)
 const button=page.getByRole('button',{name:'스크랩 '+news[0].headline,exact:true})
 await button.click()
 await expect(button).toHaveAttribute('aria-pressed','false')
 await expect(page.getByText('스크랩을 저장하지 못했습니다.',{exact:false})).toBeVisible()
 await expect(page.getByRole('button',{name:'스크랩 · 0',exact:true})).toBeVisible()
})
test('scraps are isolated between guest and signed-in accounts on this device',async({page})=>{
 await boot(page)
 await page.getByRole('button',{name:'스크랩 '+news[0].headline,exact:true}).click()
 await expect(page.getByRole('button',{name:'스크랩 · 1',exact:true})).toBeVisible()
 await page.route('**/functions/v1/source-reports*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/notebook*',r=>r.fulfill({json:{entries:[],items:[]}}))
 await page.evaluate(()=>localStorage.setItem('peppercorn-session',JSON.stringify({access_token:'test',refresh_token:'test',expires_at:9999999999,user:{id:'10000000-0000-0000-0000-000000000001'}})))
 await page.reload();await openNewsPage(page)
 await expect(page.getByRole('button',{name:'스크랩 · 0',exact:true})).toBeVisible()
})
