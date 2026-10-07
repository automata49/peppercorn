import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'
import { DEFAULT_DISCOVERY, parseDiscovery } from '../src/lib/discoveryLayout'

const rows=demoRows.map((r,i)=>({...r,leadership_class:'핵심 주도',rs_rank:99-i}))
test('presentation payload rejects unsupported versions and invalid bounds without changing screening',()=>{
  expect(parseDiscovery(DEFAULT_DISCOVERY)).toEqual(DEFAULT_DISCOVERY)
  for(const bad of [{...DEFAULT_DISCOVERY,version:2},{...DEFAULT_DISCOVERY,component:'trade-order'},{...DEFAULT_DISCOVERY,previewCount:0},{...DEFAULT_DISCOVERY,previewCount:1.5},{...DEFAULT_DISCOVERY,title:'x'.repeat(41)},null])expect(parseDiscovery(bad)).toBeNull()
})

test('home preview does not depend on chart history or obsolete hero payload',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
  await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows}}))
  await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/price-history?*',r=>r.fulfill({status:503,body:'unavailable'}))
  await page.route('**/discovery-layout.json',r=>r.fulfill({json:{...DEFAULT_DISCOVERY,title:'retired hero',previewCount:12}}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('/peppercorn/')
  await expect(page.getByRole('heading',{name:'오늘의 주도주'})).toBeVisible()
  expect(await page.locator('.journey-today .decision-row').count()).toBeLessThanOrEqual(5)
  await expect(page.locator('.leader-spotlight')).toHaveCount(0)
  await page.locator('.journey-today .decision-row').first().click()
  await expect(page.locator('.analysis-price-momentum')).toBeVisible()
  await expect(page.locator('.analysis-finder')).toHaveCount(0)
})
