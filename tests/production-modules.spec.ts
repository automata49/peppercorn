import {openFilters,closeFilters} from './journey-helpers'
import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {demoRows} from '../src/data/mock'
import {openPage} from './journey-helpers'

for(const entryMode of ['canonical','cached-app-url','historical-alias'])test(`production modules: ${entryMode} boots once across lazy editor and chart`,async({page})=>{
 test.setTimeout(60000)
 const html=readFileSync('dist/index.html','utf8')
 const canonical=html.match(/src="(\/peppercorn\/assets\/app-[\w-]+\.js)"/)?.[1]
 expect(canonical,'Build must use a canonical hashed entry without a query').toBeTruthy()
 const mainUrls=new Set<string>(),errors:string[]=[]
 page.on('request',request=>{const url=new URL(request.url());if(/\/assets\/app-[\w-]+\.js$/.test(url.pathname))mainUrls.add(url.href)})
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(/createRoot|Invalid hook|Minified React|removeChild/.test(message.text()))errors.push(message.text())})
 if(entryMode!=='canonical'){
  const alias=entryMode==='cached-app-url'?'/peppercorn/assets/app.js?v=previous-shell':'/peppercorn/assets/index-previous.js'
  await page.route(/\/peppercorn\/$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(canonical!,alias)})})
  if(entryMode==='historical-alias')await page.route('**/assets/index-previous.js',route=>route.fulfill({contentType:'application/javascript',body:readFileSync('dist/assets/app.js','utf8')}))
 }
 await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
 await page.route('**/data/leaderboard.json*',route=>route.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',route=>{const ids=new URL(route.request().url()).searchParams.get('ids')!.split(',');return route.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,[['2026-10-01',100],['2026-10-02',105],['2026-10-05',102]]]))}})})
 await page.goto('/peppercorn/')
 await openPage(page,'저널');await page.getByRole('button',{name:'새 페이지',exact:true}).click()
 await expect(page.getByRole('textbox',{name:'기록 제목'})).toBeVisible()
 await page.getByRole('button',{name:'기록 닫기',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await openPage(page,'발견')
 await openFilters(page)
 await page.locator('.analysis-scope').getByRole('button',{name:'전체',exact:true}).click()
 await page.getByRole('group',{name:'종목 분류',exact:true}).getByRole('button',{name:'전체',exact:true}).click()
 await closeFilters(page)
 await page.locator('.analysis-idea-list .stock-trend-row').first().click()
 await page.getByRole('tab',{name:'Analysis',exact:true}).click()
 await page.getByRole('button',{name:'종가 확대',exact:true}).click()
 await expect(page.locator('.close-price-chart canvas').first()).toBeVisible()
 await expect(page.getByRole('slider',{name:'종가 날짜 탐색'})).toHaveAttribute('aria-valuetext',/102/)
 expect([...mainUrls]).toEqual([new URL(canonical!,page.url()).href])
 expect(errors).toEqual([])
 await expect(page.locator('.shell')).toHaveCount(1)
 await expect(page.getByText('앱을 표시하지 못했습니다.',{exact:true})).toHaveCount(0)
})
