import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { test, expect, type Page } from '@playwright/test'
import { demoRows } from '../src/data/mock'
import { blankSnapshot, questions, type JournalEntry } from '../src/lib/lifetimeJournal'

// Regression-only current renders. Open concept IDs remain in FOLIO_SCREEN_ACCEPTANCE.md.
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
  { name: 'journey', label: '여정', selector: '.journal-timeline' },
] as const
const photo = 'data:image/webp;base64,' + readFileSync('public/folio-brand-photography.webp').toString('base64')
const base = blankSnapshot()
const entries: JournalEntry[] = [
  { ...base, id: 'visual-life', title: '바다 앞에서 생각한 긴 시간', kind: 'life', text: '관찰과 해석을 나누자. 오늘의 작은 발견을 남긴다.', photo, createdAt: '2026-10-09T10:42:00Z', updatedAt: '2026-10-09T10:42:00Z', revisions: [] },
  { ...base, id: 'visual-investment', title: 'AI 인프라 · 투자 근거', kind: 'investment', ticker: 'US:NVDA', question: questions[2], answer: '좋은 기업도 가격과 반대 증거를 함께 확인한다.', text: '수요 증가와 실제 현금 흐름을 비교한다.', ink: [[{x: 50,y: 80},{x: 210,y: 150},{x: 450,y: 90}]], createdAt: '2026-07-01T09:00:00Z', updatedAt: '2026-10-08T09:00:00Z', revisions: [{ at: '2026-07-01T09:00:00Z', snapshot: { ...base, title: 'AI 인프라 · 투자 근거', kind: 'investment', answer: '처음에는 수요 증가만 관찰했다.' } }] },
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
  await expect(page.getByRole('button', {name: '첫 페이지 쓰기'})).toBeEnabled()
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
  await expect(page.getByRole('button', {name: '바다 앞에서 생각한 긴 시간 기록 열기'})).toBeVisible()
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
      if (screen.name === 'today') await expect(page.locator('.today-story')).toHaveCount(4)
      if (screen.name === 'discover') {
        const active = page.locator('.analysis-scope button[aria-pressed=true]')
        if (await active.count()) { if (view.touch) await active.tap(); else await active.click() }
        await expect(page.locator('.analysis-idea-list > button').first()).toBeVisible()
        await expect(page.locator('.analysis-scope button')).toHaveText(['핵심 주도', '주도 후보', '강세 전환', '조정 중'])
      }
      if (screen.name === 'journal') {
        await expect(page.getByRole('tablist', {name: '저널 분류'}).getByRole('tab')).toHaveText(['전체', '일상', '투자'])
        await expect(page.locator('.journal-gallery > button')).toHaveCount(3)
      }
      if (screen.name === 'journey') {
        await expect(page.locator('.journal-timeline > article')).toHaveCount(3)
        await expect(page.locator('.journal-timeline')).toContainText('생각의 변화 1회')
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await rendered(page)
      expect(await page.evaluate(() => matchMedia('(hover:none)').matches)).toBe(view.touch)
      expect(await page.evaluate(() => matchMedia('(pointer:coarse)').matches)).toBe(view.touch)
      await expect(page).toHaveScreenshot(`${screen.name}-${theme}-${view.name}.png`, {fullPage: false, animations: 'disabled', caret: 'hide', maxDiffPixels: 150, threshold: 0.15})
    }
    await context.close()
  })
}
