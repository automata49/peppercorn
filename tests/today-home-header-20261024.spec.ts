import { test, expect } from '@playwright/test'

/** TODAY-HERO-ALIGNMENT-20261024: screenshot-reported positioning without changing card behaviour. */
const viewports = [
  { width: 390, height: 844, portrait: true },
  { width: 834, height: 1194, portrait: true },
  { width: 844, height: 390, portrait: false },
  { width: 1194, height: 834, portrait: false },
  { width: 1440, height: 900, portrait: false },
]

for (const viewport of viewports) for (const theme of ['light', 'dark']) {
  test(`Today logo/title/cover at ${viewport.width}x${viewport.height} ${theme}`, async ({browser}) => {
    const context = await browser.newContext({
      viewport: {width: viewport.width, height: viewport.height},
      hasTouch: viewport.width !== 1440,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    await page.addInitScript((currentTheme) => {
      localStorage.setItem('folio-theme', currentTheme)
      sessionStorage.setItem('peppercorn-intro-seen', '1')
    }, theme)
    for (const feed of ['leaderboard', 'leader-insights', 'stock-flags']) {
      await page.route(`**/data/${feed}.json*`, route => route.fulfill({status: 404, body: ''}))
    }
    await page.route('**/functions/v1/leaderboard?*', route => route.fulfill({json: {rows: []}}))
    await page.route('**/functions/v1/position-public?*', route => route.fulfill({json: {rows: []}}))
    await page.goto('/peppercorn/')

    const cards = page.locator('.home-motion-card')
    await expect(cards).toHaveCount(4)
    const todayCard = page.locator('.home-motion-card.home-today')
    const title = page.locator('.home-heading-intro h2')
    await expect(title).toBeVisible()
    await expect(page.locator('.home-daily-quote')).toBeVisible()

    if (viewport.portrait) {
      const wordmark = page.locator('.mobile-brandbar .folio-wordmark-image:visible').first()
      await expect(wordmark).toBeVisible()
      await expect(todayCard.locator('.home-cover-copy h3')).toBeVisible()
      const logo = await wordmark.boundingBox()
      const heading = await title.boundingBox()
      const cover = await todayCard.boundingBox()
      expect(logo && heading && cover).toBeTruthy()
      expect(Math.abs(logo!.x - heading!.x), 'Folio wordmark matches Today title gutter').toBeLessThan(3)
      expect(Math.abs(logo!.x - cover!.x), 'Folio wordmark matches first Motion cover gutter').toBeLessThan(3)
      expect(heading!.y + heading!.height).toBeLessThan(cover!.y)
    } else {
      await expect(todayCard.locator('.home-cover-copy h3')).toBeHidden()
      await expect(todayCard.locator('.home-cover-copy p')).toBeHidden()
      const action = todayCard.locator('.home-story-action')
      await expect(action).toBeVisible()
      await expect(action).toContainText('오늘의 이야기')
      const quoteEnd = await page.locator('.home-daily-quote figcaption').boundingBox()
      const actionBox = await action.boundingBox()
      expect(quoteEnd && actionBox).toBeTruthy()
      expect(quoteEnd!.y + quoteEnd!.height, 'quote must end above the story affordance').toBeLessThanOrEqual(actionBox!.y + 1)
    }
    await expect(page.getByRole('button',{name:'종목 검색'})).toBeVisible()
    await expect(page.getByRole('button',{name:/^장바구니/})).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await todayCard.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await context.close()
  })
}
