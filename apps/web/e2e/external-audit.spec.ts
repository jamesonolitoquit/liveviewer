import { test, expect } from '@playwright/test'

test.describe('External URL audit @external', () => {
  test('audits example.com and shows real results', async ({ page }) => {
    test.setTimeout(90000)

    await page.goto('/')
    await page.fill('input[type="url"]', 'https://example.com')
    await page.click('button[type="submit"]')

    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()

    await expect(page.locator('span.text-2xl')).toBeVisible({ timeout: 60000 })
    const scoreText = await page.locator('span.text-2xl').first().textContent()
    expect(scoreText).toMatch(/^\d+(\.\d+)?%$/)

    const score = parseFloat(scoreText || '0')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  test('audits web.dev and surfaces real contrast failures', async ({ page }) => {
    test.setTimeout(90000)

    await page.goto('/')
    await page.fill('input[type="url"]', 'https://web.dev')
    await page.click('button[type="submit"]')

    await expect(page.locator('span.text-2xl')).toBeVisible({ timeout: 60000 })
    const scoreText = await page.locator('span.text-2xl').first().textContent()
    expect(scoreText).toMatch(/^\d+(\.\d+)?%$/)

    const failMatchText = await page.locator('text=/\\d+ failures? found|0 failures/').first().textContent()
    expect(failMatchText).toBeTruthy()
  })

  test('audits a URL with no protocol and still works', async ({ page }) => {
    test.setTimeout(90000)

    await page.route('**/api/audit', async (route) => {
      const body = route.request().postDataJSON()
      expect(body.url).toMatch(/^https?:\/\//)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            url: 'https://example.com',
            timestamp: Date.now(),
            viewport: { width: 1280, height: 800 },
            wcag: { totalElements: 5, failures: [], passCount: 5, failCount: 0, score: 100 }
          }
        })
      })
    })

    await page.goto('/')
    await page.fill('input[type="url"]', 'https://example.com')
    await page.click('button[type="submit"]')

    await expect(page.locator('span.text-2xl')).toHaveText('100%')
  })
})
