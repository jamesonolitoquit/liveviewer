const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { audit, getChromium } = require('./auditor');

const DEFAULT_OPTIONS = {
  maxPages: 50,
  depth: 3,
  concurrency: 3,
  delay: 200,
  noCache: false,
  cacheTtl: 24,
  cacheDir: '.liveviewer-cache',
  wcag: false,
  design: false,
  seo: false,
  security: false,
  legal: false,
  performance: false,
  detectai: false,
  viewport: { width: 1280, height: 800 },
  viewports: null,
  label: 'crawl',
  timeout: 30000,
  waitUntil: 'domcontentloaded',
};

function hashKey(url, opts) {
  const raw = `${url}|${opts.wcag}|${opts.design}|${opts.seo}|${opts.security}|${opts.legal}|${opts.performance}|${opts.detectai}|${opts.viewport.width}|${opts.viewport.height}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

function loadCache(cacheDir, key, ttlMs) {
  try {
    const fp = path.join(cacheDir, `${key}.json`);
    if (!fs.existsSync(fp)) return null;
    const stat = fs.statSync(fp);
    if (Date.now() - stat.mtimeMs > ttlMs) return null;
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch {
    return null;
  }
}

function writeCache(cacheDir, key, data) {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, `${key}.json`), JSON.stringify(data, null, 2));
  } catch {
    // best-effort
  }
}

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function isSameOrigin(base, target) {
  try {
    const b = new URL(base);
    const t = new URL(target);
    return b.hostname === t.hostname && b.protocol === t.protocol;
  } catch {
    return false;
  }
}

async function fetchLinks(url, timeout) {
  const { launcher, getArgs, executablePath } = await getChromium();
  let browser;
  try {
    browser = await launcher.launch({
      args: getArgs(),
      executablePath,
      headless: true,
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    const links = await page.evaluate(() => {
      const anchors = document.querySelectorAll('a[href]');
      return Array.from(anchors).map(a => a.href).filter(Boolean);
    });
    await browser.close();
    return [...new Set(links)];
  } catch {
    if (browser) await browser.close().catch(() => {});
    return [];
  }
}

async function crawl(startUrl, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cacheDir = path.resolve(opts.cacheDir);
  const ttlMs = opts.cacheTtl * 60 * 60 * 1000;

  const seed = normalizeUrl(startUrl);
  if (!seed) throw new Error(`Invalid URL: ${startUrl}`);

  const visited = new Set();
  const queue = [{ url: seed, depth: 0 }];
  const results = [];
  const startTime = Date.now();

  while (queue.length > 0 && results.length < opts.maxPages) {
    const batch = queue.splice(0, opts.concurrency);
    const tasks = batch.map(async (item) => {
      if (visited.has(item.url)) return null;
      visited.add(item.url);

      if (item.depth > opts.depth) return null;

      const key = hashKey(item.url, opts);

      if (!opts.noCache) {
        const cached = loadCache(cacheDir, key, ttlMs);
        if (cached) {
          results.push(cached);
          return cached;
        }
      }

      const auditOptions = {
        viewport: opts.viewport,
        viewports: opts.viewports,
        label: opts.label,
        wcag: opts.wcag,
        design: opts.design,
        seo: opts.seo,
        security: opts.security,
        legal: opts.legal,
        performance: opts.performance,
        detectAi: opts.detectai,
        timeout: opts.timeout,
        waitUntil: opts.waitUntil,
      };

      try {
        const auditResult = await audit(item.url, auditOptions);
        const pageResult = {
          url: item.url,
          wcagScore: auditResult.wcag?.score ?? null,
          designScore: auditResult.design?.score ?? null,
          seoScore: auditResult.seo?.score ?? null,
          securityScore: auditResult.security?.score ?? null,
          legalScore: auditResult.legal?.score ?? null,
          performanceScore: auditResult.performance?.score ?? null,
          aiScore: auditResult.ai?.score ?? null,
          wcagFailures: auditResult.wcag?.failures?.length ?? 0,
          designFailures: auditResult.design?.failures?.length ?? 0,
          seoFailures: auditResult.seo?.failures?.length ?? 0,
          securityFailures: auditResult.security?.failures?.length ?? 0,
          timestamp: auditResult.timestamp,
          timedOut: auditResult.timedOut ?? false,
        };
        results.push(pageResult);

        if (!opts.noCache) {
          writeCache(cacheDir, key, pageResult);
        }

        // Fetch links for further crawling
        if (item.depth < opts.depth) {
          const links = await fetchLinks(item.url, opts.timeout);
          const sameOrigin = links
            .map(l => normalizeUrl(l))
            .filter(l => l && !visited.has(l) && isSameOrigin(seed, l))
            .map(l => ({ url: l, depth: item.depth + 1 }));
          queue.push(...sameOrigin);
        }

        return pageResult;
      } catch {
        return null;
      }
    });

    await Promise.allSettled(tasks);

    if (queue.length > 0 && results.length < opts.maxPages) {
      await new Promise(r => setTimeout(r, opts.delay));
    }
  }

  const duration = Date.now() - startTime;
  const scored = results.filter(r => r.wcagScore !== null || r.designScore !== null || r.seoScore !== null || r.securityScore !== null || r.legalScore !== null || r.performanceScore !== null || r.aiScore !== null);
  const avgWcag = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + (r.wcagScore ?? 0), 0) / scored.length)
    : null;
  const avgDesign = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + (r.designScore ?? 0), 0) / scored.length)
    : null;
  const avgSeo = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + (r.seoScore ?? 0), 0) / scored.length)
    : null;
  const avgSecurity = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + (r.securityScore ?? 0), 0) / scored.length)
    : null;
  const avgPerformance = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + (r.performanceScore ?? 0), 0) / scored.length)
    : null;
  const avgLegal = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + (r.legalScore ?? 0), 0) / scored.length)
    : null;
  const avgAi = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + (r.aiScore ?? 0), 0) / scored.length)
    : null;
  const worstWcag = results.filter(r => r.wcagScore !== null)
    .sort((a, b) => (a.wcagScore ?? 100) - (b.wcagScore ?? 100))[0] ?? null;
  const worstDesign = results.filter(r => r.designScore !== null)
    .sort((a, b) => (a.designScore ?? 100) - (b.designScore ?? 100))[0] ?? null;
  const worstSeo = results.filter(r => r.seoScore !== null)
    .sort((a, b) => (a.seoScore ?? 100) - (b.seoScore ?? 100))[0] ?? null;
  const worstSecurity = results.filter(r => r.securityScore !== null)
    .sort((a, b) => (a.securityScore ?? 100) - (b.securityScore ?? 100))[0] ?? null;
  const worstPerformance = results.filter(r => r.performanceScore !== null)
    .sort((a, b) => (a.performanceScore ?? 100) - (b.performanceScore ?? 100))[0] ?? null;
  const worstLegal = results.filter(r => r.legalScore !== null)
    .sort((a, b) => (a.legalScore ?? 100) - (b.legalScore ?? 100))[0] ?? null;
  const worstAi = results.filter(r => r.aiScore !== null)
    .sort((a, b) => (a.aiScore ?? 100) - (b.aiScore ?? 100))[0] ?? null;
  const totalFailures = results.reduce((s, r) => s + (r.wcagFailures ?? 0) + (r.designFailures ?? 0) + (r.seoFailures ?? 0) + (r.securityFailures ?? 0), 0);

  return {
    pages: results,
    summary: {
      totalPages: results.length,
      totalDuration: duration,
      averageWcagScore: avgWcag,
      averageDesignScore: avgDesign,
      averageSeoScore: avgSeo,
      averageSecurityScore: avgSecurity,
      averagePerformanceScore: avgPerformance,
      averageLegalScore: avgLegal,
      worstWcagPage: worstWcag ? { url: worstWcag.url, score: worstWcag.wcagScore } : null,
      worstDesignPage: worstDesign ? { url: worstDesign.url, score: worstDesign.designScore } : null,
      worstSeoPage: worstSeo ? { url: worstSeo.url, score: worstSeo.seoScore } : null,
      worstSecurityPage: worstSecurity ? { url: worstSecurity.url, score: worstSecurity.securityScore } : null,
      worstPerformancePage: worstPerformance ? { url: worstPerformance.url, score: worstPerformance.performanceScore } : null,
      worstLegalPage: worstLegal ? { url: worstLegal.url, score: worstLegal.legalScore } : null,
      worstAiPage: worstAi ? { url: worstAi.url, score: worstAi.aiScore } : null,
      averageAiScore: avgAi,
      totalFailures,
    },
  };
}

module.exports = { crawl };
