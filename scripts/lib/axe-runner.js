import { chromium } from 'playwright';

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js';

/**
 * Run axe-core on a given URL and return structured violations.
 * @param {string} url - URL to audit
 * @returns {Promise<Array<{ruleId:string, selector:string, description:string}>>}
 */
export async function runAxe(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    await browser.close();
    return [{ ruleId: 'error', selector: 'page', description: `Failed to load: ${e.message}` }];
  }

  // Inject axe-core from CDN
  try {
    await page.addScriptTag({ url: AXE_CDN });
  } catch (e) {
    await browser.close();
    return [{ ruleId: 'error', selector: 'page', description: `Failed to load axe-core: ${e.message}` }];
  }

  // Give axe a moment to initialize
  await page.waitForFunction(() => typeof window.axe !== 'undefined', null, { timeout: 5000 }).catch(() => {});

  const results = await page.evaluate(() => {
    return new Promise((resolve) => {
      if (typeof window.axe === 'undefined') {
        resolve({ error: 'axe-core not loaded' });
        return;
      }
      window.axe.run((err, res) => {
        if (err) resolve({ error: err.message });
        else resolve(res);
      });
    });
  });

  await browser.close();

  if (results.error) {
    return [{ ruleId: 'error', selector: 'page', description: results.error }];
  }

  const violations = [];
  for (const v of results.violations || []) {
    for (const node of v.nodes || []) {
      const selector = node.target.join(' ');
      violations.push({
        ruleId: v.id,
        selector,
        impact: v.impact || 'minor',
        description: v.help,
        helpUrl: v.helpUrl
      });
    }
  }

  return violations;
}
