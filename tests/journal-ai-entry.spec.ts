import { test, expect } from '@playwright/test'
import { openPage } from './journey-helpers'

test('the deployed journal editor exposes its AI conversation entry', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('peppercorn-intro-seen', '1')
  })
  await page.goto('/peppercorn/')
  await openPage(page, '저널')
  await page.getByRole('button', { name: '새 페이지', exact: true }).click()
  const disclosure = page.locator('details.journal-ai-disclosure')
  await expect(disclosure.locator('summary')).toHaveText('AI와 대화하기')
  await disclosure.locator('summary').click()
  await expect(page.getByRole('region', { name: '저널 AI 대화' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'AI와 생각 정리' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'AI에게 질문' })).toBeVisible()
})
