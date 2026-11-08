import {test,expect,type Page} from '@playwright/test'
import {openLeaderTools} from './journey-helpers'

const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002']
const rows=ids.map((id,i)=>({id,market:'US',ticker:i?'SPY':'TEST',name:i?'S&P 500':'정적 차트 검증',asset_class:i?'ETF':'Equity',exchange:'NASDAQ',sector:'Information Technology',industry:'Semiconductors',index_memberships:[],price:180,rs_rank:99,ibd_rs_estimate:95,ibd_rs_as_of:'2026-11-06',high_52w_distance:-.05,leader_tt:true,leadership_class:'핵심 주도',stage:'▲ 돌파 매수권',ma50:150,ma200:130,rs_3m:.1,rs_6m:.1,return_20d:.1}))
const closes=(id:string)=>Array.from({length:80},(_,i)=>[new Date(Date.UTC(2026,10,6)-(79-i)*86400000).toISOString().slice(0,10),id===ids[0]?100+i:100])

async function setup(page:Page,missing:string[]=[],restricted=false,primaryMissing=false){
  const calls={static:[] as string[],live:[] as string[][]}
  await page.addInitScript(()=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-stock-size','all')})
  await page.route('**/data/leaderboard.json',r=>r.fulfill({json:{published_at:new Date(Date.now()-60_000).toISOString(),rows}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.route('**/data/price-history/*.json',r=>{
    const id=new URL(r.request().url()).pathname.split('/').at(-1)!.replace('.json','');calls.static.push(id)
    return missing.includes(id)?r.fulfill({status:404,body:''}):r.fulfill({json:{version:1,published_at:new Date(Date.now()-60_000).toISOString(),as_of:'2026-11-06',series:{[id]:closes(id)}}})
  })
  await page.route('**/functions/v1/price-history?*',r=>{
    const requested=new URL(r.request().url()).searchParams.get('ids')!.split(',');calls.live.push(requested)
    return missing.length&&!restricted?r.fulfill({json:{series:Object.fromEntries(requested.map(id=>[id,closes(id)]))}}):r.fulfill({status:402,json:{message:'quota restricted'}})
  })
  await page.goto('/peppercorn/')
  await openLeaderTools(page)
  await page.locator('.analysis-idea-list .stock-trend-row').first().click()
  await page.getByRole('tab',{name:'Analysis',exact:true}).click()
  if(!primaryMissing)await expect(page.locator('.analysis-price-momentum .price-rs [data-key="price"]')).toHaveCount(1)
  if(!restricted)await expect(page.locator('.analysis-price-momentum .price-rs [data-key="bench"]')).toHaveCount(1)
  return calls
}
for(const width of [390,834,1440])test(`fresh public files render price/RS charts despite live 402 at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000})
  const calls=await setup(page)
  expect(calls.static).toEqual(expect.arrayContaining(ids))
  expect(calls.live).toHaveLength(0)
  await expect(page.locator('.analysis-price-momentum .price-rs')).not.toContainText('HTTP 402')
  await expect(page.locator('.analysis-price-momentum .chart-scrubber')).toHaveAttribute('aria-valuetext',/2026-11-06/)
})
test('only the missing instrument falls back to the bounded live endpoint',async({page})=>{
  const calls=await setup(page,[ids[1]])
  expect(calls.live.flat()).toContain(ids[1])
  expect(calls.live.flat()).not.toContain(ids[0])
})

test('a missing benchmark with live 402 keeps confirmed stock history visible',async({page})=>{
  const calls=await setup(page,[ids[1]],true)
  expect(calls.live.flat()).toContain(ids[1])
  const chart=page.locator('.analysis-price-momentum .price-rs')
  await expect(chart.locator('[data-key="price"]')).toHaveCount(1)
  await expect(chart.locator('[data-key="bench"]')).toHaveCount(0)
  await expect(chart).toContainText('벤치마크 가격을 불러오지 못해')
  await expect(chart).not.toContainText('HTTP 402')
})

test('automatic market revalidation reloads a mounted chart without manual refresh',async({page})=>{
  await page.clock.install({time:new Date()})
  const calls=await setup(page)
  const first=calls.static.length
  await page.clock.fastForward(16*60_000)
  await expect.poll(()=>calls.static.length).toBeGreaterThan(first)
  await expect(page.locator('.analysis-price-momentum .price-rs [data-key="bench"]')).toHaveCount(1)
  expect(calls.live).toHaveLength(0)
})

test('a failed primary history is not misreported as empty when the benchmark loads',async({page})=>{
  await setup(page,[ids[0]],true,true)
  const chart=page.locator('.analysis-price-momentum .price-rs')
  await expect(chart).toContainText('일별 가격을 불러오지 못했습니다 (HTTP 402)')
  await expect(chart).not.toContainText('일별 가격 이력이 없습니다')
  await expect(chart.locator('[data-key="price"]')).toHaveCount(0)
})
