import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'
import {normalizeUsSectors} from '../src/lib/groupRank'
import {sectorStanding,compareSectorStanding,SECTOR_MIN_MEMBERS} from '../src/lib/sectorStanding'
import type {LeaderRow} from '../src/types'

test('US source labels map to GICS-like sector groups without changing provenance',()=>{
 const names=['Process Industries','Non-Energy Minerals','Energy Minerals','Electronic Technology']
 const rows=names.map((sector,i)=>({...demoRows[0],ticker:'MAP'+i,sector,classification_source:'TradingView source'}))
 const result=normalizeUsSectors(rows)
 expect(result.map(r=>r.sector)).toEqual(['Materials','Materials','Energy','Information Technology'])
 expect(result.every(r=>r.classification_source==='TradingView source')).toBe(true)
 expect(normalizeUsSectors(result)).toEqual(result)
 expect(SECTOR_MIN_MEMBERS).toBe(5)
})
test('a one-stock RS outlier and a leaderless sector cannot outrank a real sector',()=>{
 const singleton=sectorStanding({sector:'Materials',n:1,rankedCount:1,ma50Count:1,medRank:99,core:0,candidate:0,breadth:0})
 const leaderless=sectorStanding({sector:'Technology',n:80,rankedCount:80,ma50Count:80,medRank:90,core:0,candidate:0,breadth:.8})
 const broad=sectorStanding({sector:'Energy',n:100,rankedCount:99,ma50Count:99,medRank:68,core:8,candidate:30,breadth:.55})
 expect(singleton).toMatchObject({rankEligible:false,rankScore:null,rankReason:'표본 부족'})
 expect(leaderless).toMatchObject({rankEligible:false,rankScore:null,rankReason:'주도 없음'})
 expect(broad.rankEligible).toBe(true)
 expect(broad.rankScore).toBeGreaterThan(0)
 const sorted=[{...singleton,medRank:99,n:1,core:0,candidate:0,key:'US|Materials'},
 {...leaderless,medRank:90,n:80,core:0,candidate:0,key:'US|Technology'},
 {...broad,medRank:68,n:100,core:8,candidate:30,key:'US|Energy'}].sort(compareSectorStanding)
 expect(sorted[0].key).toBe('US|Energy')
})
const base=demoRows[0]
function row(ticker:string,sector:string,rs:number,cls:string,above:boolean):LeaderRow{
 return {...base,id:'test-'+ticker,ticker,name:ticker,market:'US',asset_class:'Equity',sector,industry:'Test sample',
 leadership_class:cls,leader_tt:false,rs_rank:rs,price:above?110:90,ma50:100,ma200:95,
 rs_3m:.12,rs_6m:.17}
}
const apiRows=[
 row('GEF','Process Industries',99,'중립',false),
 row('MATS','Non-Energy Minerals',90,'중립',false),
 ...Array.from({length:7},(_,i)=>row('EN'+i,'Energy',70+i,i===0?'중립':'주도 후보',i>0)),
 ...Array.from({length:7},(_,i)=>row('TC'+i,'Information Technology',88+i,i===0?'주도 후보':'중립',i===0)),
]
for(const [width,height] of [[390,844],[834,1194],[1440,900]]){
 test(`US sector leader table excludes outliers and keeps drillable references at ${width}`,async({page})=>{
  await page.setViewportSize({width,height})
  await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
  await page.route('**/data/leaderboard.json*',r=>r.fulfill({status:404,body:''}))
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:apiRows}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.goto('/peppercorn/')
  const mobile=page.locator('.mobile-bottom-nav').getByRole('button',{name:'발견',exact:true})
  if(await mobile.isVisible())await mobile.click()
  else await page.locator('.sidebar nav').getByRole('button',{name:'발견',exact:true}).click()
  await expect(page.getByRole('tab',{name:'시장 신호'})).toHaveAttribute('aria-selected','true')
  await expect(page.locator('.dashboard-sector-table tbody tr')).toHaveCount(2)
  await expect(page.locator('.dashboard-sector-table tbody tr').first()).toContainText('Energy')
  await expect(page.locator('.dashboard-sector-table tbody')).not.toContainText('Process Industries')
  await page.locator('.dashboard-sector-panel').getByRole('button',{name:/전체 보기/}).click()
  const dialog=page.locator('.sector-summary-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('tr[data-sector-rank=ranked]')).toHaveCount(2)
  await expect(dialog.locator('tr[data-sector-rank=reference]')).toHaveCount(1)
  await expect(dialog.locator('tr[data-sector-rank=reference]')).toContainText('Materials')
  await expect(dialog.locator('.sector-reference-divider')).toContainText('순위 제외')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 })
}
