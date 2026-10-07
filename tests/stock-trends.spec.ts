import {test,expect,type Page} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {stockSizes,filterStockSize,CAP_COVERAGE_MIN} from '../src/lib/stockSize'
import {miniTrend} from '../src/lib/miniTrend'
import type {LeaderRow} from '../src/types'
const classes=['핵심 주도','주도 후보','강세 전환','중립']
const rows=(['US','KR'] as const).flatMap(m=>Array.from({length:10},(_,i)=>({...demoRows[0],id:m+'-'+i,market:m,ticker:m==='US'?'TEST'+i:String(i).padStart(6,'0'),name:m+' 종목 '+i,market_cap:(10-i)*1e9,traded_value_20d:(i+1)*1e7,leadership_class:classes[i%4],stage:i%4===3?'조정 중':'돌파 매수권',rs_rank:99-i,return_20d:i%2?-.10:.20}))) as LeaderRow[]
const dates=Array.from({length:30},(_,i)=>new Date(Date.UTC(2026,8,1+i))).filter(d=>d.getUTCDay()!==0&&d.getUTCDay()!==6).slice(0,21).map(d=>d.toISOString().slice(0,10))
async function boot(page:Page,data:LeaderRow[]=rows,{missing=false,beforeHistory=async(_n:number)=>{},historyValue=(_n:number,i:number)=>100+i}={}){
 const batches:string[][]=[]
 await page.addInitScript(()=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-theme','light')})
 await page.route('**/data/leaderboard.json',r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:data}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/quotes?*',r=>r.fulfill({json:{quotes:{}}}))
 await page.route('**/functions/v1/price-history?*',async r=>{const ids=new URL(r.request().url()).searchParams.get('ids')!.split(',');batches.push(ids);const n=batches.length;await beforeHistory(n);return r.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,missing?[]:dates.map((d,i)=>[d,historyValue(n,i)])]))}})})
 await page.goto('/peppercorn/');await expect(page.locator('.journey-home')).toBeVisible()
 return batches
}
test('size uses full per-market Equity universe, prefers comprehensive cap and includes cutoff ties',()=>{
 const sizes=stockSizes(rows)
 expect(sizes.US.basis).toBe('market_cap');expect(sizes.US.large.size).toBe(1)
 expect(filterStockSize(rows,'large',sizes).map(r=>r.id)).toEqual(['US-0','KR-0'])
 expect(filterStockSize(rows,'small',sizes)).toHaveLength(18)
 const tied=rows.map(r=>r.id==='US-1'?{...r,market_cap:rows[0].market_cap}:r)
 expect(stockSizes(tied).US.large.size).toBe(2)
 const withEtf=[...rows,{...rows[0],id:'ETF',ticker:'ETF1',asset_class:'ETF',market_cap:1e20}]
 expect(stockSizes(withEtf).US.large.has('ETF')).toBe(false)
 expect(filterStockSize(withEtf,'etf',stockSizes(withEtf)).map(r=>r.id)).toEqual(['ETF'])
 expect(filterStockSize(withEtf,'all',stockSizes(withEtf))).toHaveLength(21)
})
test('turnover fallback never mixes currency markets or missing/zero/nonfinite values into small',()=>{
 const data=rows.map(r=>({...r,market_cap:null}))
 data[0]={...data[0],traded_value_20d:NaN};data[1]={...data[1],traded_value_20d:0};data[2]={...data[2],traded_value_20d:null}
 const sizes=stockSizes(data);expect(sizes.US.basis).toBe('traded_value_20d');expect(sizes.US.unknown).toBe(3)
 expect(filterStockSize(data,'small',sizes).map(r=>r.id)).not.toContain('US-0')
 expect(filterStockSize(data,'large',sizes).map(r=>r.id)).toEqual(['US-9','KR-9'])
 expect(filterStockSize(data,'all',sizes)).toHaveLength(20)
 expect(CAP_COVERAGE_MIN).toBe(.9)
 const partial=rows.map((r,i)=>i<2?{...r,market_cap:null}:r)
 expect(stockSizes(partial).US.basis).toBe('traded_value_20d')
})
test('mini trend uses actual closes, labels incomplete periods and preserves gaps',()=>{
 const full=miniTrend({dates,closes:dates.map((_,i)=>100+i)})!
 expect(full.complete).toBe(true);expect(full.path).toContain('M3.00,41.00');expect(full.path).toContain('L97.00,7.00')
 expect(miniTrend({dates:dates.slice(0,3),closes:[1,2,3]})!.complete).toBe(false)
 expect(miniTrend({dates:dates.slice(0,5),closes:[1,2,NaN,3,4]})!.path.match(/M/g)).toHaveLength(2)
 expect(miniTrend({dates:dates.slice(0,3),closes:[1,NaN,2]})).toBeNull()
 expect(miniTrend({dates:[],closes:[]})).toBeNull()
})
for(const width of [390,834,1366,1440])test(`stock rows ${width}: default large → whole list → categories → size persistence`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<1440});const page=await context.newPage();const batches=await boot(page)
 const category=page.getByRole('group',{name:'분류'})
 await expect(category.getByRole('button')).toHaveText(['대형주','중소형주','ETF','전체'])
 await expect(category.getByRole('button',{name:'대형주',exact:true})).toHaveAttribute('aria-pressed','true')
 await expect(page.locator('.journey-today .stock-trend-row')).toHaveCount(2)
 await expect(page.locator('.journey-today svg[role=img]').first()).toBeVisible()
 await page.locator('.journey-market').getByRole('button',{name:'전체 보기 →'}).click()
 await expect(page.getByRole('heading',{name:'주도 종목',exact:true})).toBeVisible()
 await expect(page.locator('.analysis-idea-list > button')).toHaveCount(2)
 await category.getByRole('button',{name:'전체',exact:true}).click()
 await expect(page.locator('.analysis-idea-list > button')).toHaveCount(20)
 const scope=page.getByRole('group',{name:'주도 분류'})
 await expect(scope.getByRole('button')).toHaveText(['핵심 주도','주도 후보','강세 전환','조정 중'])
 for(const [label,count] of [['핵심 주도',6],['주도 후보',6],['강세 전환',4],['조정 중',4]] as const){const button=scope.getByRole('button',{name:label,exact:true});if(await button.getAttribute('aria-pressed')!=='true')await button.click();await expect(page.locator('.analysis-idea-list > button')).toHaveCount(count)}
 await scope.getByRole('button',{name:'조정 중',exact:true}).click();await expect(page.locator('.analysis-idea-list > button')).toHaveCount(20)
 await expect(page.locator('.analysis-idea-list svg[role=img]')).toHaveCount(20)
 await page.getByRole('button',{name:'중소형주',exact:true}).click();await expect(page.locator('.analysis-idea-list > button')).toHaveCount(18)
 await page.locator('.analysis-idea-list > button').first().click();await expect(page.locator('.analysis-price-momentum')).toBeVisible();await page.getByRole('button',{name:'← 탐색 목록'}).click()
 await expect(page.getByRole('button',{name:'중소형주',exact:true})).toHaveAttribute('aria-pressed','true')
 await page.screenshot({path:`test-results/stock-trends-${width}.png`,fullPage:true})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 const target=await page.getByRole('button',{name:'대형주',exact:true}).boundingBox();expect(target!.height).toBeGreaterThanOrEqual(44)
 expect(batches.every(ids=>ids.length<=10)).toBe(true)
 await page.reload();await expect(page.getByRole('button',{name:'중소형주',exact:true})).toHaveAttribute('aria-pressed','true');await context.close()
})
test('fallback basis and empty history are explicit, unknown size only appears in all',async({page})=>{
 const data=rows.map(r=>({...r,market_cap:null,traded_value_20d:r.id.endsWith('-0')?null:r.traded_value_20d}))
 await boot(page,data,{missing:true});await page.locator('.journey-market').getByRole('button',{name:'전체 보기 →'}).click()
 await expect(page.locator('.stock-size-basis summary')).toContainText('시가총액 대체')
 const scope=page.getByRole('group',{name:'주도 분류'});const active=scope.locator('button[aria-pressed="true"]');if(await active.count())await active.first().click();await expect(page.locator('.analysis-idea-list > button')).toHaveCount(2)
 await expect(page.locator('.analysis-idea-list .stock-trend-missing').first()).toHaveText('이력 없음')
 await page.getByRole('button',{name:'중소형주',exact:true}).click();await expect(page.locator('.analysis-idea-list > button')).toHaveCount(16)
 await page.getByRole('group',{name:'분류'}).getByRole('button',{name:'전체',exact:true}).click();await expect(page.locator('.analysis-idea-list > button')).toHaveCount(20)
 await expect(page.locator('.analysis-idea-list svg[role=img]')).toHaveCount(0)
})
test('progressive listing loads bounded history and retains all filtered rows',async({page})=>{
 const data=Array.from({length:45},(_,i)=>({...rows[0],id:'extra-'+i,ticker:'T'+i,market_cap:i+1,leadership_class:'핵심 주도'}))
 const batches=await boot(page,data);await page.locator('.journey-market').getByRole('button',{name:'전체 보기 →'}).click();await page.getByRole('group',{name:'분류'}).getByRole('button',{name:'전체',exact:true}).click()
 await expect(page.locator('.analysis-idea-list > button')).toHaveCount(20);await page.getByRole('button',{name:'더 보기 · 20종목'}).click()
 await expect(page.locator('.analysis-idea-list > button')).toHaveCount(40);await page.getByRole('button',{name:'더 보기 · 5종목'}).click();await expect(page.locator('.analysis-idea-list > button')).toHaveCount(45)
 expect(batches.every(ids=>ids.length<=10)).toBe(true)
})

test('ETF is a first-class classification and does not use equity leadership classes',async({page})=>{
 const etfs=[
  {...rows[0],id:'ETF-US',ticker:'SPY',name:'US ETF',asset_class:'ETF',leadership_class:null},
  {...rows[10],id:'ETF-KR',ticker:'069500',name:'KR ETF',asset_class:'ETF',leadership_class:null},
 ] as LeaderRow[]
 await boot(page,[...rows,...etfs]);await page.locator('.journey-market').getByRole('button',{name:'전체 보기 →'}).click()
 await page.getByRole('group',{name:'분류'}).getByRole('button',{name:'ETF',exact:true}).click()
 await expect(page.locator('.analysis-idea-list > button')).toHaveCount(2)
 await expect(page.getByRole('group',{name:'주도 분류'}).getByRole('button')).toBeDisabled()
 await expect(page.locator('.analysis-idea-list .stock-trend-tags i')).toHaveText(['ETF','ETF'])
})

test('pending list history is shared with detail and invalidated refresh rejects the older cache generation',async({page})=>{
 await page.setViewportSize({width:1440,height:1000})
 let release!:()=>void
 const gate=new Promise<void>(r=>{release=r})
 const batches=await boot(page,rows,{beforeHistory:async n=>{if(n===1)await gate},historyValue:(n,i)=>n===1?(i%2?1000:10):100+i})
 await expect.poll(()=>batches.length).toBe(1)
 await page.locator('.journey-today .stock-trend-row').first().click()
 await expect(page.locator('.analysis-price-momentum')).toBeVisible()
 // Both mounted readers wait for the shared first batch.
 await expect(page.locator('.analysis-price-momentum svg')).toHaveCount(0)
 expect(batches).toHaveLength(1)
 await page.locator('.topbar-refresh').click()
 await expect.poll(()=>batches.length).toBeGreaterThan(1)
 await expect(page.locator('.analysis-price-momentum svg').first()).toBeVisible()
 const firstResponse=page.waitForResponse(r=>r.url().includes('price-history')&&(new URL(r.url()).searchParams.get('ids')||'').includes(','))
 release();await (await firstResponse).finished()
 await expect(page.locator('.analysis-price-momentum svg').first()).toBeVisible()
 const refreshCount=batches.length
 await page.getByRole('button',{name:'← 탐색 목록'}).click()
 await expect(page.locator('.analysis-idea-list svg[role=img]').first()).toBeVisible()
 await expect(page.locator('.analysis-idea-list svg[role=img] path').first()).toHaveAttribute('d',miniTrend({dates,closes:dates.map((_,i)=>100+i)})!.path)
 // A new reader uses refreshed cache, rather than replaying the old pending request.
 expect(batches.slice(refreshCount).flat()).not.toContain('KR-0')
})
