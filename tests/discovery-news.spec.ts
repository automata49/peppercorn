import {test,expect,type Page} from '@playwright/test'
import {demoRows} from '../src/data/mock'
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
 await page.route('**/data/leader-insights.json*',r=>r.fulfill({json:{version:1,published_at:stamp(),ai_status:'disabled',items:[]}}))
 await page.route('**/data/instinct-leader-news.json*',r=>r.fulfill({json:{...feed,items}}))
 await page.goto('/peppercorn/');await openNewsPage(page)
}

test('publisher diversity preserves summaries, deduplicates articles and excludes stale/unsafe input',()=>{
 const duplicate={...news[0],source_url:news[0].source_url+'#top'}
 const stale={...news[2],published_at:stamp(-200)}
 const unsafe={...news[3],source_url:'https://drive.google.com/private'}
 const parsed=parseInstinctNews({...feed,items:[...news,duplicate,stale,unsafe]},now)!
 const ordered=diverseInstinctNews(parsed.items,now)
 expect(ordered.map(i=>i.source_name)).toEqual(['Reuters','AP','Bloomberg','연합뉴스','Reuters'])
 expect(ordered.find(i=>i.headline===news[3].headline)?.summary).toBe(news[3].summary)
 expect(news[1].source_name).toBe('Reuters')
 expect(diverseInstinctNews(parsed.items,now+8*86400_000)).toEqual([])
})
for(const theme of ['light','dark'])for(const [width,height] of [[390,844],[834,1194],[1194,834],[1440,900]])test(`Instinct multi-source news without wheels ${theme} ${width}px`,async({page})=>{
 await page.setViewportSize({width,height})
 await page.addInitScript(t=>localStorage.setItem('folio-theme',t),theme)
 await boot(page)
 const section=page.getByRole('region',{name:'시장과 종목의 최신 뉴스'})
 await expect(section.locator('[data-wheel]')).toHaveCount(0)
 await expect(section.locator('.discovery-news-story')).toHaveCount(4)
 await expect(section).toContainText(news[3].headline)
 await expect(section).toContainText(news[4].headline)
 await expect(section).not.toContainText(news[1].headline)
 await expect(section.locator('.discovery-news-source').first()).toContainText('Reuters')
 await expect(section.getByRole('link',{name:'원문 읽기 ↗'}).first()).toHaveAttribute('href',news[0].source_url)
 await expect(section.locator('time').first()).toHaveAttribute('datetime',news[0].published_at)
 await expect(section).toContainText('Instinct AI 요약 · 원문 확인')
 await expect(section).toContainText('Folio 이미지 · 원문 사진 아님')
 await expect(section.locator('article').filter({hasText:news[3].headline}).getByRole('button',{name:'종목 보기 →'})).toHaveCount(0)
 await section.getByRole('button',{name:'뉴스 더 보기'}).click()
 await expect(section.locator('.discovery-news-story')).toHaveCount(5)
 await expect(section).toContainText(news[1].headline)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
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
 await page.route('**/data/leader-insights.json*',r=>r.fulfill({json:{version:1,published_at:stamp(),ai_status:'disabled',items:[issuer]}}))
 await page.reload();await openNewsPage(page)
 await expect(section.locator('article')).toHaveCount(0)
 await expect(section).toContainText('최근 7일의 Instinct 뉴스가 없습니다.')
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
