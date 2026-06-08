import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('liveviewer_onboarded', '1')
    })
  })

  async function runAxe(page) {
    return await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()
  }

  function logViolations(violations) {
    if (violations.length === 0) return
    for (const v of violations) {
      console.log(`\n[${v.impact}] ${v.id}: ${v.description}`)
      console.log(`  Help: ${v.helpUrl}`)
      for (const node of v.nodes) {
        console.log(`  → ${node.target?.join(' ') || node.html}`)
        console.log(`    ${node.failureSummary?.replace(/\n/g, '\n    ') || ''}`)
      }
    }
  }

  test('home page has no critical or serious violations', async ({ page }) => {
    await page.goto('/')

    const results = await runAxe(page)
    expect(results.passes.length).toBeGreaterThan(0)

    const seriousCrit = results.violations.filter(v =>
      v.impact === 'critical' || v.impact === 'serious'
    )

    logViolations(seriousCrit)
    expect(seriousCrit.length).toBe(0)
  })

  test('home page has no violations of any impact level', async ({ page }) => {
    await page.goto('/')

    const results = await runAxe(page)
    logViolations(results.violations)
    expect(results.violations.length).toBe(0)
  })

  test('home page is accessible in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    const results = await runAxe(page)
    logViolations(results.violations)
    expect(results.violations.length).toBe(0)
  })

  test('results page is accessible after audit', async ({ page }) => {
    await page.goto('/')

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
                {
                  selector: 'body > h1',
                  text: 'Welcome',
                  foreground: '#737373',
                  background: '#ffffff',
                  contrastRatio: 4.0,
                  required: 4.5,
                  fontSize: 32,
                  isLarge: true
                },
                {
                  selector: 'body > p',
                  text: 'Some body text here that is harder to read',
                  foreground: '#a3a3a3',
                  background: '#ffffff',
                  contrastRatio: 2.5,
                  required: 4.5,
                  fontSize: 16,
                  isLarge: false
                }
              ],
              passCount: 98,
              failCount: 2,
              score: 85.0
            }
          }
        })
      })
    })

    await page.locator('input[type="url"]').fill('https://example.com')
    await page.locator('button[type="submit"]').click()
    await page.waitForSelector('section[aria-label="Audit results"]')

    const results = await runAxe(page)
    logViolations(results.violations)
    expect(results.violations.length).toBe(0)
  })
})
