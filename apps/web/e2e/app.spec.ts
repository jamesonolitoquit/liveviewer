import { test, expect } from '@playwright/test'

test.describe('Liveviewer web app', () => {
  test('loads the home page with title and form', async ({ page }) => {
    await page.goto('/')

    const heading = page.locator('h1')
    await expect(heading).toHaveText('Design QA Robot')

    const input = page.locator('input[type="url"]')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('placeholder', 'https://example.com')

    const button = page.locator('button[type="submit"]')
    await expect(button).toHaveText('Run Audit')
  })

  test('shows error for empty URL submission', async ({ page }) => {
    await page.goto('/')

    const button = page.locator('button[type="submit"]')
    await expect(button).toBeDisabled()

    const input = page.locator('input[type="url"]')
    await input.fill('')
    await expect(button).toBeDisabled()
  })

  test('disables form while audit is running', async ({ page }) => {
    await page.route('**/api/audit', async (route) => {
      await new Promise(r => setTimeout(r, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { url: 'https://example.com', timestamp: Date.now(), viewport: { width: 1280, height: 800 }, wcag: null } })
      })
    })

    await page.goto('/')
    const input = page.locator('input[type="url"]')
    const button = page.locator('button[type="submit"]')

    await input.fill('https://example.com')
    await button.click()

    await expect(input).toBeDisabled()
    await expect(button).toHaveText('Auditing…')
  })

  test('displays audit results on success', async ({ page }) => {
    await page.route('**/api/audit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            url: 'https://example.com',
            timestamp: Date.now(),
            viewport: { width: 1280, height: 800 },
            wcag: {
              totalElements: 100,
              failures: [
                { selector: 'h1', text: 'Welcome', foreground: '#ffffff', background: '#eeeeee', contrastRatio: 2.1, required: 4.5, fontSize: 24, isLarge: true },
                { selector: 'p', text: 'Body text', foreground: '#999999', background: '#ffffff', contrastRatio: 3.5, required: 4.5, fontSize: 16, isLarge: false }
              ],
              passCount: 98,
              failCount: 2,
              score: 98
            }
          }
        })
      })
    })

    await page.goto('/')
    await page.fill('input[type="url"]', 'https://example.com')
    await page.click('button[type="submit"]')

    await expect(page.locator('span.font-bold')).toHaveText('98')
    await expect(page.locator('h3:has-text("failures")')).toBeVisible()
    await expect(page.locator('text=/Welcome/')).toBeVisible()
  })

  test('shows error state on audit failure', async ({ page }) => {
    await page.route('**/api/audit', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load page' })
      })
    })

    await page.goto('/')
    await page.fill('input[type="url"]', 'https://example.com')
    await page.click('button[type="submit"]')

    await expect(page.locator('#audit-error')).toContainText('Failed to load page')
  })

  test('supports keyboard navigation through form', async ({ page }) => {
    await page.goto('/')

    // Clear any URL history from prior tests that could show autocomplete dropdown
    await page.evaluate(() => localStorage.removeItem('liveviewer_recent_urls'))

    // Tab 1: skip-to-content link (hidden, only visible on focus)
    await page.keyboard.press('Tab')

    // Tab 2: History link in header
    await page.keyboard.press('Tab')

    // Tab 3: Extension link in header
    await page.keyboard.press('Tab')

    // Tab 4: Theme toggle in header
    await page.keyboard.press('Tab')

    // Tab 5: URL input
    await page.keyboard.press('Tab')
    await expect(page.locator('input[type="url"]')).toBeFocused()

    // Type URL and tab to submit button
    await page.keyboard.type('https://example.com')
    await page.keyboard.press('Tab')
    await expect(page.locator('button[type="submit"]')).toBeFocused()

    // Enter should submit
    await page.route('**/api/audit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { url: 'https://example.com', timestamp: Date.now(), viewport: { width: 1280, height: 800 }, wcag: null } })
      })
    })
    await page.keyboard.press('Space')
    await expect(page.locator('button[type="submit"]')).toBeDisabled()
  })

  test('toggles AI enrichment panel', async ({ page }) => {
    // First run an audit to show the results section (which contains LlmPanel)
    await page.route('**/api/audit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            url: 'https://example.com',
            timestamp: Date.now(),
            viewport: { width: 1280, height: 800 },
            wcag: {
              totalElements: 100,
              failures: [{ selector: 'h1', text: 'Test', foreground: '#fff', background: '#000', contrastRatio: 2.1, required: 4.5, fontSize: 24, isLarge: true }],
              passCount: 99,
              failCount: 1,
              score: 99
            }
          }
        })
      })
    })

    await page.goto('/')
    await page.fill('input[type="url"]', 'https://example.com')
    await page.click('button[type="submit"]')
    await expect(page.locator('span.font-bold')).toHaveText('99')

    await expect(page.locator('h3', { hasText: 'AI Enrichment' })).toBeVisible()

    // Check the checkbox state before toggle
    const checkbox = page.locator('input.peer[type="checkbox"]')
    await expect(checkbox).not.toBeChecked()

    // Click the toggle via evaluate (the custom CSS div intercepts pointer events)
    await checkbox.evaluate(el => (el as HTMLInputElement).click())
    await expect(checkbox).toBeChecked()

    await expect(page.locator('label').filter({ hasText: 'Provider' })).toBeVisible()
    await expect(page.locator('label').filter({ hasText: 'API Key' })).toBeVisible()
  })

  test('shows cancel button during audit', async ({ page }) => {
    await page.route('**/api/audit', async (route) => {
      await new Promise(r => setTimeout(r, 3000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { url: 'https://example.com', timestamp: Date.now(), viewport: { width: 1280, height: 800 }, wcag: null } })
      })
    })

    await page.goto('/')
    await page.fill('input[type="url"]', 'https://example.com')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=Cancel')).toBeVisible()
    await expect(page.getByRole('status', { name: 'Loading audit results' })).toBeVisible()
  })

  test('shows fix suggestions for audit with wcag and design failures', async ({ page }) => {
    await page.route('**/api/audit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            url: 'https://example.com',
            timestamp: Date.now(),
            viewport: { width: 1280, height: 800 },
            wcag: {
              totalElements: 100,
              failures: [
                { selector: 'h1', text: 'Welcome', foreground: '#ffffff', background: '#eeeeee', contrastRatio: 2.1, required: 4.5, fontSize: 24, isLarge: true }
              ],
              passCount: 99,
              failCount: 1,
              score: 99
            },
            design: {
              failures: [
                { ruleId: 'font-size-legible', ruleName: 'Font Size Legibility', category: 'typography', selector: '.body-text', description: 'Text too small', severity: 'medium', value: '12px', expected: '\u2265 16px' }
              ],
              totalChecks: 10,
              passCount: 9,
              failCount: 1,
              score: 90
            },
            recommendations: [
              { type: 'contrast', severity: 'high', selector: 'h1', text: 'Welcome', currentValue: 'fg #ffffff / bg #eeeeee (ratio 2.1:1)', suggestedValue: 'needs \u2265 4.5:1', recommendation: 'Increase contrast on "h1": change #ffffff or #eeeeee to achieve ratio \u2265 4.5:1 (current 2.1:1).' },
              { type: 'font-size-legible', severity: 'medium', selector: '.body-text', text: 'Text too small', currentValue: '12px', suggestedValue: '\u2265 16px', recommendation: 'Increase font-size on ".body-text" from 12px to at least \u2265 16px for legibility.' }
            ]
          }
        })
      })
    })

    await page.goto('/')
    await page.fill('input[type="url"]', 'https://example.com')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=Fix Suggestions')).toBeVisible()
    await expect(page.locator('text=Increase contrast on "h1"')).toBeVisible()
    await expect(page.locator('text=Increase font-size on ".body-text"')).toBeVisible()
  })

  test('cancel button resets form to idle', async ({ page }) => {
    await page.route('**/api/audit', async (route) => {
      await new Promise(r => setTimeout(r, 5000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { url: 'https://example.com', timestamp: Date.now(), viewport: { width: 1280, height: 800 }, wcag: null } })
      })
    })

    await page.goto('/')
    await page.fill('input[type="url"]', 'https://example.com')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=Cancel')).toBeVisible()

    await page.click('text=Cancel')

    await expect(page.locator('button[type="submit"]')).toBeEnabled()
    await expect(page.locator('input[type="url"]')).toBeEnabled()
    await expect(page.locator('text=Cancel')).not.toBeVisible()
  })

})
