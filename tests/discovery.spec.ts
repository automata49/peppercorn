import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'
import { DEFAULT_DISCOVERY, parseDiscovery } from '../src/lib/discoveryLayout'

const rows=demoRows.map((r,i)=>({...r,leadership_class:'핵심 주도',rs_rank:99-i}))
test('presentation payload rejects unsupported versions and invalid bounds without changing screening',()=>{
  expect(parseDiscovery(DEFAULT_DISCOVERY)).toEqual(DEFAULT_DISCOVERY)
  for(const bad of [{...DEFAULT_DISCOVERY,version:2},{...DEFAULT_DISCOVERY,component:'trade-order'},{...DEFAULT_DISCOVERY,previewCount:0},{...DEFAULT_DISCOVERY,previewCount:1.5},{...DEFAULT_DISCOVERY,title:'x'.repeat(41)},null])expect(parseDiscovery(bad)).toBeNull()
})

for(const width of [390,834,1194,1366,1440])test(`discovery at ${width}: real dates, keyboard exploration and detail handoff`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<1440})
  const page=await context.newPage()
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/price-history?*',r=>{
    const ids=new URL(r.request().url()).searchParams.get('ids')!.split(',')
    return r.fulfill({json:{series:Object.fromEntries(ids.map(id=>[id,[['2026-09-28',100],['2026-09-29',105],['2026-09-30',103],['2026-10-01',110]]]))}})
  })
  await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
  await page.goto('/peppercorn/')
  await expect(page.locator('.spotlight-price')).toContainText('2026-10-01')
  await expect(page.locator('.spotlight-price strong')).toHaveText('110')
  const visual=await page.locator('.spotlight-price strong').evaluate(e=>({size:parseFloat(getComputedStyle(e).fontSize),digit:parseFloat(getComputedStyle(e.querySelector('span span')!).fontSize),weight:getComputedStyle(e).fontWeight,background:getComputedStyle(e.closest('.leader-spotlight')!).backgroundColor}))
  expect(visual.size).toBeGreaterThanOrEqual(38)
  expect(visual.digit).toBe(visual.size)
  expect(Number(visual.weight)).toBeGreaterThanOrEqual(400)
  expect(['rgba(0, 0, 0, 0)','rgb(248, 245, 241)','rgb(255, 255, 255)']).toContain(visual.background)
  await expect(page.locator('.leadership-decision')).toBeVisible()
  await expect(page.locator('.leadership-next')).toContainText('분석 허브')
  const tabs=page.getByRole('tablist',{name:'대표 리더 선택'}).getByRole('tab')
  await tabs.first().focus();await page.keyboard.press('ArrowRight')
  await expect(tabs.nth(1)).toBeFocused();await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true')
  const slider=page.getByRole('slider',{name:'리더 차트 날짜 탐색'})
  await expect(slider).toBeVisible();await slider.focus();await page.keyboard.press('Home')
  await expect(page.locator('.spotlight-price')).toContainText('2026-09-28')
  await expect(page.locator('.spotlight-price strong')).toHaveText('100')
  expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  const overflow=await page.evaluate(()=>{
    const viewport=innerWidth
    return {
      scrollWidth:document.documentElement.scrollWidth,
      viewport,
      offenders:[...document.querySelectorAll<HTMLElement>('body *')]
        .map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,cls:el.className?.toString?.()||'',left:r.left,right:r.right,width:r.width}})
        .filter(x=>x.right>viewport+1||x.left<-1)
        .sort((a,b)=>Math.max(b.right-viewport,-b.left)-Math.max(a.right-viewport,-a.left))
        .slice(0,8)
    }
  })
  expect(overflow.scrollWidth,`overflow diagnostics: ${JSON.stringify(overflow.offenders)}`).toBeLessThanOrEqual(overflow.viewport+1)
  await page.screenshot({path:`test-results/discovery-${width}.png`,fullPage:true})
  await page.getByRole('button',{name:'이 종목 깊이 보기'}).click()
  await expect(page.locator('.drill-sheet')).toBeVisible()
  await context.close()
})

test('hosted presentation changes copy and preview while invalid config and history safely fall back',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/price-history?*',r=>r.fulfill({status:503,body:'unavailable'}))
  let valid=true
  await page.route('**/discovery-layout.json',r=>r.fulfill({json:valid?{...DEFAULT_DISCOVERY,title:'깊이 볼 리더',previewCount:1}:{version:99,component:'unknown'}}))
  await page.goto('/peppercorn/')
  await expect(page.getByRole('heading',{name:'깊이 볼 리더'})).toBeVisible()
  await expect(page.getByRole('tablist',{name:'대표 리더 선택'}).getByRole('tab')).toHaveCount(1)
  await expect(page.locator('.spotlight-chart-empty')).toContainText('가격 이력이 없습니다')
  const count=await page.locator('.focus-leader-row').count()
  valid=false;await page.reload()
  await expect(page.getByRole('heading',{name:'오늘의 리더'})).toBeVisible()
  await expect(page.locator('.focus-leader-row')).toHaveCount(count)
  await expect(page.locator('.spotlight-price')).toContainText('일간 종가')
  await expect(page.locator('.spotlight-chart svg')).toHaveCount(0)
})
