import {test,expect,type Page} from '@playwright/test'
import {TEMP_ITEMS,changes,previousOf,tempPosture,tempWord,temperature,upsertEntry} from '../src/lib/temperature'

// TEMP-1 시장 온도계: the user's own Howard Marks checklist marks, a plain average temperature, history and dashboard card.
test('temperature is the average of marked items only',()=>{
  expect(TEMP_ITEMS).toHaveLength(19)
  expect(new Set(TEMP_ITEMS.map(i=>i.key)).size).toBe(19)
  expect(temperature({})).toBeNull()
  expect(temperature({economy:0})).toBe(100)
  expect(temperature({economy:4})).toBe(0)
  expect(temperature({economy:0,rates:4})).toBe(50)
  expect(temperature({economy:1,rates:2,spreads:1})).toBe(67)
  // Out-of-range, fractional and unknown keys never count as a mark.
  expect(temperature({economy:5,rates:1.5,unknown:0} as Record<string,number>)).toBeNull()
  expect([80,79,60,59,40,39,20,19].map(tempWord)).toEqual(['과열','다소 뜨거움','다소 뜨거움','중립','중립','다소 차가움','다소 차가움','냉각'])
  expect(tempPosture(71)).toBe('조금 방어적으로')
  const a={date:'2026-09-19',marks:{economy:1,rates:3,spreads:1},evidence:{}}
  const b={date:'2026-10-03',marks:{economy:1,rates:4,spreads:0,risk:1},evidence:{spreads:'HY 2.7%p'}}
  expect(changes(b,a).map(c=>[c.item.key,c.dir,c.evidence])).toEqual([['rates','colder',''],['spreads','hotter','HY 2.7%p']])
  expect(changes(b,null)).toEqual([])
  const list=upsertEntry(upsertEntry([],a),b)
  expect(list.map(e=>e.date)).toEqual(['2026-10-03','2026-09-19'])
  expect(upsertEntry(list,{...b,marks:{economy:0}})).toHaveLength(2)
  expect(previousOf(list,'2026-10-03')?.date).toBe('2026-09-19')
  expect(previousOf(list,'2026-09-19')).toBeNull()
})

const views=[{name:'phone',width:390,height:844,touch:true},{name:'ipad-portrait',width:834,height:1194,touch:true},{name:'ipad-landscape',width:1194,height:834,touch:true},{name:'ipad-pro',width:1366,height:1024,touch:true},{name:'desktop',width:1440,height:900,touch:false}]
const row={id:'a',ticker:'TEST',market:'US',name:'테스트',asset_class:'Equity',sector:'Technology',industry:'Semiconductors',exchange:'NASDAQ',index_memberships:[],price:110,ma50:100,ma200:90,high_52w_distance:-.05,return_1w:.01,rs_rank:90,leadership_class:'중립',stage:'▲ 돌파 매수권'}
async function goTemperature(page:Page){
  const side=page.locator('.sidebar nav')
  if(await side.isVisible())await side.getByRole('button',{name:'시장 온도계'}).click()
  else{await page.getByRole('button',{name:'전체 메뉴 열기'}).first().click();await page.locator('.menu-drawer').getByRole('button',{name:'시장 온도계'}).click()}
  await expect(page.locator('.temp-page')).toBeVisible()
}
const mark=(page:Page,key:string,n:number)=>page.locator(`.temp-row[data-item="${key}"] .temp-dot`).nth(n).click()

for(const view of views){
 test(view.name+' market temperature records, compares and feeds the dashboard card',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch})
  const page=await context.newPage()
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[row,{...row,id:'b',ticker:'TEST2',price:80,return_1w:-.02,high_52w_distance:-.3}]}}))
  await page.route('**/functions/v1/price-history?*',route=>route.fulfill({json:{series:{}}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  // A prior entry on an earlier date: the new entry starts from its marks and shows what moved.
  await page.addInitScript(()=>{if(!localStorage.getItem('peppercorn-temperature'))localStorage.setItem('peppercorn-temperature',JSON.stringify([{date:'2026-09-19',marks:{economy:1,rates:3,spreads:1},evidence:{},version:'marks-temperature-1'}]))})
  await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})

  const card=page.locator('.temp-card')
  await expect(card.locator('.temp-value')).toHaveText('58°')
  await expect(card.locator('.temp-moved')).toHaveText('첫 기록입니다.')

  await goTemperature(page)
  const p=page.locator('.temp-page')
  await expect(p.locator('.temp-category h3')).toHaveText(['경기·전망','신용·자금','투자자 심리','가격·수익률'])
  await expect(p.locator('.temp-row')).toHaveCount(19)
  await expect(p.locator('.temp-row[data-item="rates"] .temp-poles .hot')).toHaveText('낮음')
  await expect(p.locator('.temp-row[data-item="rates"] .temp-poles .cold')).toHaveText('높음')
  // Reference facts are shown but never set a mark.
  await expect(p.locator('.temp-facts > div')).toHaveCount(3)
  await expect(p.locator('.temp-facts > div').first().locator('b')).toHaveText('50%')
  // Today's draft starts from the previous marks; the previous mark carries the grey ring once moved.
  await expect(p.locator('.temp-row[data-item="spreads"] .temp-dot').nth(1)).toHaveAttribute('aria-checked','true')
  await mark(page,'spreads',0)
  await expect(p.locator('.temp-row[data-item="spreads"] .temp-dot').nth(1)).toHaveClass(/was/)
  await expect(p.locator('.temp-row[data-item="spreads"] .temp-badge')).toHaveText('▲ 뜨거워짐')
  await p.getByRole('textbox',{name:'신용 스프레드 근거'}).fill('HY 스프레드 2.7%p')
  await mark(page,'rates',4)
  await expect(p.locator('.temp-row[data-item="rates"] .temp-badge')).toHaveText('▼ 식음')
  await mark(page,'risk',1)
  await expect(p.locator('.temp-status')).toContainText('바뀐 항목 2')
  await expect(p.locator('.temp-summary .temp-value')).toHaveText('63°')
  await p.getByRole('button',{name:'오늘 온도 기록하기'}).click()
  await expect(p.locator('.temp-history tbody tr')).toHaveCount(2)
  await expect(p.locator('.temp-history tbody tr').first().locator('td').nth(1)).toHaveText('63°')
  await expect(p.locator('.temp-history tbody tr').first().locator('td').nth(3)).toHaveText('2')
  await expect(p.locator('.temp-status')).toContainText('저장된 기록 수정')
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('peppercorn-temperature')||'[]'))
  expect(stored).toHaveLength(2)
  expect(stored[0].marks).toEqual({economy:1,rates:4,spreads:0,risk:1})
  expect(stored[0].evidence).toEqual({spreads:'HY 스프레드 2.7%p'})

  // Clearing a mark removes it (unmarked is absent, never a zero).
  await p.locator('.temp-row[data-item="risk"]').getByRole('button',{name:'위험 표시 지우기'}).click()
  await expect(p.locator('.temp-row[data-item="risk"] .temp-dot[aria-checked="true"]')).toHaveCount(0)

  // History row opens that entry; the older record keeps its own marks.
  await p.locator('.temp-history tbody tr').nth(1).click()
  await expect(p.locator('.temp-row[data-item="spreads"] .temp-dot').nth(1)).toHaveAttribute('aria-checked','true')

  // Former Research records are kept, folded.
  await expect(page.locator('.legacy-research > summary')).toContainText('이전 Research 기록')

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  // Dashboard card follows the latest entry.
  const side=page.locator('.sidebar nav')
  if(await side.isVisible())await side.getByRole('button',{name:'Dashboard'}).click()
  else await page.locator('.mobile-bottom-nav').getByRole('button',{name:'홈'}).click()
  await expect(card.locator('.temp-value')).toHaveText('63°')
  await expect(card.locator('.temp-moved')).toHaveText('바뀐 항목: 금리 ▼ · 신용 스프레드 ▲')
  await card.getByRole('button',{name:'온도계 열기 →'}).click()
  await expect(page.locator('.temp-page')).toBeVisible()
  await context.close()
 })
}
