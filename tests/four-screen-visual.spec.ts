import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { test, expect, type Page } from '@playwright/test'
import { demoRows } from '../src/data/mock'
import { blankSnapshot, questions, type JournalEntry } from '../src/lib/lifetimeJournal'

// Regression renders of the documented page structure. Open data/device IDs remain in FOLIO_SCREEN_ACCEPTANCE.md.
// Use the same pinned Linux Chromium/Noto CJK environment to review baseline candidates.
const views = [
  { name: 'phone-390', width: 390, height: 844, touch: true },
  { name: 'ipad-834', width: 834, height: 1194, touch: true },
  { name: 'ipad-pro-1366', width: 1366, height: 1024, touch: true },
  { name: 'desktop-1440', width: 1440, height: 900, touch: false },
] as const
const screens = [
  { name: 'today', label: '오늘', selector: '.lifetime-today' },
  { name: 'discover', label: '발견', selector: '.analysis-finder' },
  { name: 'journal', label: '저널', selector: '.lifetime-journal' },
  { name: 'journey', label: '여정', selector: '.decision-queue' },
] as const
const photo = 'data:image/webp;base64,' + readFileSync('public/folio-brand-photography.webp').toString('base64')
const secondPhoto = 'data:image/webp;base64,' + readFileSync('public/folio-brand-typography.webp').toString('base64')
const base = blankSnapshot()
const entries: JournalEntry[] = [
  { ...base, id: 'visual-life', ticker: 'US:AAPL', title: '바다 앞에서 생각한 긴 시간', kind: 'life', text: '관찰과 해석을 나누자. 오늘의 작은 발견을 남긴다.', photo, photos: [photo, secondPhoto], createdAt: '2026-10-09T10:42:00Z', updatedAt: '2026-10-09T10:42:00Z', revisions: [] },
  { ...base, id: 'visual-investment', title: 'AI 인프라 · 투자 근거', kind: 'investment', ticker: 'US:NVDA', question: questions[2], answer: '좋은 기업도 가격과 반대 증거를 함께 확인한다.', hypothesis: '수요와 현금 흐름을 함께 확인한다.', counterEvidence: '관찰한 수요가 실제 실적과 다를 수 있다.', text: '수요 증가와 실제 현금 흐름을 비교한다.', ink: [[{x: 50,y: 80},{x: 210,y: 150},{x: 450,y: 90}]], createdAt: '2026-07-01T09:00:00Z', updatedAt: '2026-10-08T09:00:00Z', revisions: [{ at: '2026-07-01T09:00:00Z', snapshot: { ...base, title: 'AI 인프라 · 투자 근거', kind: 'investment', answer: '처음에는 수요 증가만 관찰했다.', hypothesis: '처음 남긴 가설을 다시 확인한다.', counterEvidence: '반대 증거는 아직 기록하지 않았다.' } }] },
  { ...base, id: 'visual-patience', title: '기다림도 하나의 결정이었다', text: '당장의 움직임보다 처음 남긴 판단을 다시 읽는다.', createdAt: '2025-10-01T09:00:00Z', updatedAt: '2025-10-01T09:00:00Z', revisions: [] },
]

test.beforeAll(() => {
  // Fail rather than produce tofu/fallback-font snapshots on an unprepared host.
  expect(execFileSync('fc-match', ['-f', '%{family}', 'Noto Sans CJK KR'], {encoding: 'utf8'})).toContain('Noto Sans CJK KR')
  expect(execFileSync('fc-match', ['-f', '%{family}', 'Arial'], {encoding: 'utf8'})).toContain('Liberation Sans')
  // Chromium's Linux CJK fallback comes from this browser dependency even with Noto installed.
  expect(execFileSync('fc-match', ['-f', '%{family}', 'WenQuanYi Zen Hei'], {encoding: 'utf8'})).toContain('WenQuanYi Zen Hei')
  if (process.env.CI) expect(test.info().config.updateSnapshots).not.toMatch(/all|changed/)
})

async function boot(page: Page, theme: 'light' | 'dark') {
  await page.clock.setFixedTime(new Date('2026-10-10T03:00:00Z'))
  await page.addInitScript(theme => {
    sessionStorage.setItem('peppercorn-intro-seen', '1')
    localStorage.setItem('folio-theme', theme)
    localStorage.setItem('folio-stock-size', 'all')
    localStorage.setItem('peppercorn-research', JSON.stringify([{id:'visual-source', date:'2026-10-01', title:'공시를 읽으며 남긴 질문', fact:'테스트 기록 · 원문에서 확인할 항목을 메모했다.', interpretation:'테스트 기록 · 실제 실적과 비교해 볼 생각이다.', source:'https://www.apple.com/newsroom/', verification:'미검증', market:'US', ticker:'AAPL'}]))
    localStorage.setItem('peppercorn-portfolio', JSON.stringify([{id:'visual-holding',market:'US',ticker:'AAPL',name:'Apple',shares:2,avg_price:100,currency:'USD'}]))
  }, theme)
  // Ignore published static snapshots/flags as well as external live responses.
  await page.route('**/data/leaderboard.json*', r => r.fulfill({status: 404, body: ''}))
  await page.route('**/data/stock-flags.json*', r => r.fulfill({status: 404, body: ''}))
  await page.route('**/functions/v1/leaderboard?*', r => r.fulfill({json: {rows: demoRows}}))
  await page.route('**/functions/v1/position-public?*', r => r.fulfill({json: {rows: []}}))
  await page.route('**/functions/v1/quotes?*', r => r.fulfill({json: {quotes: {}}}))
  await page.route('**/functions/v1/price-history?*', r => {
    const ids = new URL(r.request().url()).searchParams.get('ids')?.split(',') || []
    const series = Array.from({length: 21}, (_, i) => [new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), 100 + i + (i % 3)])
    return r.fulfill({json: {series: Object.fromEntries(ids.map(id => [id, series]))}})
  })
  await page.goto('/peppercorn/')
  await expect(page.locator('.home-heading h2')).toBeVisible()
  await page.evaluate(async records => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('folio-lifetime-journal', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('notebooks', 'readwrite')
        transaction.objectStore('notebooks').put(records, 'guest')
        transaction.oncomplete = () => { database.close(); resolve() }
        transaction.onerror = () => { database.close(); reject(transaction.error) }
      }
    })
  }, entries)
  await page.reload()
  await expect(page.locator('.home-motion-card').first()).toBeVisible()
  await expect(page.locator('.source.supabase')).toHaveCount(1)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
}

async function openScreen(page: Page, label: string, touch: boolean) {
  // Mouse clicks switch Chromium's primary pointer/hover media on a touch context.
  // Keep device CSS stable by using touch input throughout touch runs.
  const side = page.locator('.sidebar nav').getByRole('button', {name: label, exact: true})
  const quick = page.locator('.mobile-bottom-nav').getByRole('button', {name: label, exact: true})
  const target = await side.isVisible() ? side : quick
  if (touch) await target.tap()
  else await target.click()
}

async function rendered(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map(img => img.decode()))
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.demo-banner')).toHaveCount(0)
  const brandbar = page.locator('.mobile-brandbar')
  if (await brandbar.isVisible()) {
    const bar = (await brandbar.boundingBox())!
    for (const button of await brandbar.locator('.mobile-brand-actions button').all()) {
      const box = (await button.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.y).toBeGreaterThanOrEqual(bar.y)
      expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height + 1)
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

for (const view of views) for (const theme of ['light', 'dark'] as const) {
  test(`four screens ${view.name} ${theme}`, async ({browser}) => {
    // Compare the actual fixed viewport. Full-page capture reapplies Chromium's
    // device metrics and can change primary pointer/hover media mid-capture.
    // Touch runs use mobile emulation and taps; deeper flows have behavioral tests.
    const context = await browser.newContext({viewport: {width: view.width, height: view.height}, hasTouch: view.touch, isMobile: view.touch, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: theme, reducedMotion: 'reduce'})
    const page = await context.newPage()
    await boot(page, theme)
    for (const screen of screens) {
      await openScreen(page, screen.label, view.touch)
      await expect(page.locator(screen.selector)).toBeVisible()
      if (screen.name === 'today') await expect(page.locator('.home-motion-card')).toHaveCount(4)
      if (screen.name === 'discover') {
        const pinned=await page.locator('.catalog-filter-sidebar').count();const toggle=page.getByRole('button', {name:'Filter & Sort'});if(!pinned){if(view.touch)await toggle.tap();else await toggle.click()}
        const active = page.locator('.analysis-scope button[aria-pressed=true]')
        if (await active.count()) { if (view.touch) await active.tap(); else await active.click() }
        const close=page.getByRole('button', {name:'필터 닫기'});if(!pinned){if(view.touch)await close.tap();else await close.click()}
        await expect(page.locator('.analysis-idea-list .stock-trend-row').first()).toBeVisible()
        await expect(page.locator('.catalog-filter-drawer.ui-dialog-content')).toHaveCount(0)
      }
      if (screen.name === 'journal') {
        await expect(page.getByRole('tablist', {name: '저널 분류'}).getByRole('tab')).toHaveText(['전체', '일상', '투자'])
        await expect(page.locator('.journal-albums .journal-gallery > button')).toHaveCount(3)
      }
      if (screen.name === 'journey') {
        await expect(page.locator('.review-gallery-item')).toHaveCount(1)
        await expect(page.locator('.decision-queue')).not.toContainText('바다 앞에서 생각한 긴 시간')
        await expect(page.locator('.decision-queue-item')).toHaveCount(1);await expect(page.locator('.review-gallery-item .journal-story')).toHaveCount(0)
        await expect(page.locator('.decision-queue')).toContainText('원본 판단 비교')
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await rendered(page)
      if(theme==='light'){await expect(page.locator('.app-main')).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(page.locator('.content')).toHaveCSS('background-color','rgb(255, 255, 255)')}
      expect(await page.evaluate(() => matchMedia('(hover:none)').matches)).toBe(view.touch)
      expect(await page.evaluate(() => matchMedia('(pointer:coarse)').matches)).toBe(view.touch)
      // The view selector is covered by the dedicated responsive interaction test.
      // Keep the approved snapshots focused on the otherwise unchanged reading surfaces.
      // A style tag inserted on Journal persists through the following Journey screenshot.
      if (screen.name === 'journal') await page.addStyleTag({content:'.journal-heading-actions{display:contents!important}.journal-view-toggle{display:none!important}'})
      if (screen.name === 'today') {
        // TODAY-DAILY-THOUGHT-1 deliberately changes the masthead across each day.
        // Do not overwrite the user-approved original four-screen baseline automatically.
        // Capture the new composition for human sign-off; gate the layout semantically.
        await expect(page.locator('.home-heading h2')).toHaveText('오늘')
        await expect(page.locator('.home-manifesto')).toHaveText('세상을 발견하고, 나의 시간을 기록하다.')
        await expect(page.locator('.home-daily-quote')).toContainText('한국어 번역·의역')
        await expect(page.locator('.home-portrait img')).toHaveCSS('filter','none')
        await expect(page.locator('.home-portrait svg')).toHaveCount(0)
        const overlap = await page.evaluate(() => {
          const text = document.querySelector('.home-daily-quote')!.getBoundingClientRect()
          const photo = document.querySelector('.home-portrait')!.getBoundingClientRect()
          return photo.left + 1 < text.right && photo.right > text.left + 1 && photo.top + 1 < text.bottom && photo.bottom > text.top + 1
        })
        expect(overlap).toBe(false)
        await page.screenshot({path:`test-results/new-today-${theme}-${view.name}.png`,animations:'disabled',caret:'hide'})
      } else {
        await expect.soft(page).toHaveScreenshot(`${screen.name}-${theme}-${view.name}.png`, {fullPage: false, animations: 'disabled', caret: 'hide', maxDiffPixels: screen.name === 'journal' && view.name === 'phone-390' ? 300 : 150, threshold: 0.15})
      }
    }
    await context.close()
  })
}
