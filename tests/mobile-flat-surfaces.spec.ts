import {openSignal,pickFirstStock} from './journey-helpers'
import { test, expect } from '@playwright/test'
import { demoRows } from '../src/data/mock'

async function boot(page:any){
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:demoRows}}))
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/')
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
}

test('phone primary sections use flat surfaces instead of nested cards',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  await boot(page)

  const focus=page.locator('.journey-market').first()
  await expect(focus).toBeVisible()
  expect(parseFloat(await focus.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)
  await openSignal(page)
  for(const selector of ['.dashboard-sector-panel','.temp-card']){
    const node=page.locator(selector).first()
    await expect(node).toBeVisible()
    expect(parseFloat(await node.evaluate(e=>getComputedStyle(e).borderLeftWidth))).toBe(0)
    expect(parseFloat(await node.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)
    expect(await node.evaluate(e=>getComputedStyle(e).boxShadow)).toBe('none')
  }

  const explore=page.locator('.dashboard-explore')
  expect(parseFloat(await explore.evaluate(e=>getComputedStyle(e).borderLeftWidth))).toBe(0)
  expect(parseFloat(await explore.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)

  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'탐색',exact:true}).click()
  await pickFirstStock(page)
  const primary=page.locator('.analysis-main > .analysis-price-momentum')
  await expect(primary).toHaveCount(1)
  expect(parseFloat(await primary.evaluate(e=>getComputedStyle(e).borderLeftWidth))).toBe(0)
  expect(parseFloat(await primary.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)
  await page.locator('.analysis-card').getByRole('tab',{name:'Overview'}).click()
  const detailBlocks=page.locator('.analysis-secondary-body > .analysis-block')
  await expect(detailBlocks).toHaveCount(3)
  for(let i=0;i<3;i++){
    const block=detailBlocks.nth(i)
    expect(parseFloat(await block.evaluate(e=>getComputedStyle(e).borderLeftWidth))).toBeGreaterThan(0)
    expect(parseFloat(await block.evaluate(e=>getComputedStyle(e).borderRadius))).toBeGreaterThanOrEqual(14)
  }
  await context.close()
})

test('desktop focal leader and analysis keep the same flat editorial hierarchy',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  await boot(page)
  const focus=page.locator('.journey-market')
  expect(parseFloat(await focus.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)

  await page.locator('.sidebar nav').getByRole('button',{name:'탐색',exact:true}).click()
  await pickFirstStock(page)
  const block=page.locator('.analysis-main > .analysis-price-momentum').first()
  expect(parseFloat(await block.evaluate(e=>getComputedStyle(e).borderLeftWidth))).toBe(0)
  expect(parseFloat(await block.evaluate(e=>getComputedStyle(e).borderRadius))).toBe(0)
})
