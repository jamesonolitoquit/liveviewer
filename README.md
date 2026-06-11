# Liveviewer v4.0.0

Free, open-source full site quality audit tool. Checks **accessibility, design QA, SEO, security, legal compliance, and performance** — with deterministic fix suggestions for every issue. No API key required, no signup, no tracking.

**Web app:** [jao-liveviewer.vercel.app](https://jao-liveviewer.vercel.app) — visual report with radar chart and pass/fail bars.  
**CLI:** `npm install -g @liveviewer/cli` — for CI pipelines and local development.

```bash
npm install -g @liveviewer/cli
npx playwright install chromium
```

## Commands

### `screenshot` — Visual snapshot with accessibility metadata

```bash
liveviewer screenshot https://example.com --full-page --label home
liveviewer screenshot https://example.com --selector ".hero" --label hero
liveviewer screenshot https://example.com --width 375 --height 667
```

Reports: LCP, image count, broken images, missing alt text.

### `record` — Frame-by-frame performance recording

```bash
liveviewer record https://example.com --duration 5000 --label my-site
liveviewer record https://example.com --interaction "click .menu" --interaction "scroll 400"
```

Reports: totalFrames, meanDelta, jankFrames, smoothnessScore (0–100).

### `audit` — Full site quality audit (6 pillars)

```bash
# Run all 6 pillars: WCAG, Design QA, SEO, Security, Legal & Privacy, Performance
liveviewer audit https://example.com --all

# Individual pillars
liveviewer audit https://example.com --wcag                           # Accessibility (contrast, alt text, labels, skip nav)
liveviewer audit https://example.com --design                         # Design QA (font-size, line-height, heading hierarchy, scroll)
liveviewer audit https://example.com --seo                            # SEO (title, meta, canonical, OG, Twitter, JSON-LD)
liveviewer audit https://example.com --security                       # Security (HSTS, CSP, XFO, mixed content, cookies)
liveviewer audit https://example.com --legal                          # Legal & Privacy (cookie consent, privacy policy, imprint)
liveviewer audit https://example.com --performance                    # Performance (Lighthouse: LCP, CLS, TBT, FCP, SI, TTI)

# Multiple pillars together
liveviewer audit https://example.com --wcag --design --seo --security --legal

# Desktop & Mobile viewports (merged)
liveviewer audit https://web.dev --wcag --design --mobile

# Explicit viewport list
liveviewer audit https://example.com --wcag --design --viewports 1280x800,375x812

# Deterministic fix suggestions (no API key needed)
liveviewer audit https://example.com --wcag --design

# SARIF 2.1 output (compatible with GitHub Code Scanning)
liveviewer audit https://example.com --all --sarif
liveviewer audit https://example.com --all --sarif-output ./results.sarif

# JSON output (machine-readable)
liveviewer audit https://example.com --all --json

# Contextual smart enrichment
liveviewer audit https://example.com --wcag --smart-enrich --context "SaaS dashboard for engineers, dark mode"
liveviewer audit https://example.com --wcag --smart-enrich --context-file ./site-brief.txt

# Exit non-zero if failures exceed threshold (for CI)
liveviewer audit https://example.com --wcag --fail-on 0

# Crawl same-origin pages for multi-page auditing
liveviewer audit https://example.com --wcag --crawl --max-pages 10 --depth 2

# Crawl with 1-page limit for quick health check
liveviewer audit https://example.com --wcag --crawl --max-pages 1 --depth 0

# Crawl with custom viewport
liveviewer audit https://example.com --wcag --design --crawl --viewports 1280x800,375x812

# Skip disk cache, force fresh audits
liveviewer audit https://example.com --wcag --crawl --no-cache

# Low-concurrency crawl (polite mode)
liveviewer audit https://example.com --wcag --crawl --concurrency 1 --delay 1000
```

The `--crawl` flag enables breadth-first crawling of same-origin pages. Uses disk cache (24h TTL by default, `.liveviewer-cache/` directory) to avoid re-auditing unchanged pages. Each page gets its own audit with the same WCAG/Design/Viewport settings. Results include per-page scores and a summary with averages, worst pages, and total failures.

The `--mobile` flag runs both `1280x800` and `375x812` viewports and merges failures (deduplicated by selector+colors, tagged by viewport origin with D/M badges). `--viewports` accepts a comma-separated list for custom combinations.

**CLI and web app produce identical deterministic results** (WCAG failures, Design QA scores, ARIA failures) when using the same URL and viewport configuration. The only difference is optional smart enrichment.

Reports: `<url>-<timestamp>.png` (screenshot) + `.json` with all failures and fix suggestions.

Includes:
- **WCAG contrast** – per-element contrast ratios with background ancestor walk (correct alpha blending for `rgba`), `sr-only` elements automatically filtered. 100% accuracy on W3C ACT Rule `afw4f7` (33/33 cases).
- **Design QA** – typography (font-size ≥16px, line-height 1.4–1.6), horizontal scroll detection, heading hierarchy validation. 100% benchmark accuracy.
- **SEO** – title tag, meta description, canonical URL, viewport meta, Open Graph tags, Twitter Cards, JSON-LD structured data. 100% benchmark accuracy.
- **Security** – HTTP security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), mixed content detection, secure cookie flags. 100% benchmark accuracy.
- **Legal & Privacy** – cookie consent banner detection, privacy policy link, imprint/legal notice, terms of service, data collection notice. 100% benchmark accuracy.
- **Performance** – Lighthouse integration (LCP, CLS, TBT, FCP, Speed Index, TTI), grade A–F scoring, smoke-tested and resilience-tested.
- **Visual report** – web app now shows a radar chart comparing all 6 pillar scores and stacked bar charts for pass/fail breakdown.
- **Deterministic fix suggestions** – rule-based fixes for every failure, shown automatically in CLI and web app (no API key required)
- **SARIF 2.1 output** – rule IDs compatible with GitHub Code Scanning upload
- **Smart enrichment** (optional) – `--smart-enrich` sends failures to a backend service. Use `--context` to provide site purpose for more relevant suggestions. Use `--smart-prompt` to print the prompt without calling an API.

### `extract` — Design token inventory

```bash
liveviewer extract https://example.com --styles --label extract1
liveviewer extract https://example.com --styles --brand brand.json --label audit1
```

Outputs JSON with unique colors, backgrounds, font families, sizes, weights, borders, and paddings.

With `--brand`, compares extracted tokens against a brand config and reports violations:

```json
{
  "colors": { "primary": "#7c3aed", "secondary": "#a1a1aa" },
  "fonts": { "families": ["Geist Sans", "Inter"] }
}
```

### `recommend` — Grouped fixes with token-level analysis

```bash
liveviewer recommend audits/audit1-<timestamp>.json
liveviewer recommend audits/audit1-<timestamp>.json --format markdown
liveviewer recommend audits/audit1-<timestamp>.json \
  --extract extracts/extract1-<timestamp>.json \
  --format html --output report.html
```

Text, Markdown, or HTML output. HTML reports include score ring, failure table, violations section, and screenshot.

### `analyze` — Deep frame analysis of a recording

```bash
liveviewer analyze <recording-tag> --fps 5 --max-frames 30
```

### `mcp` — MCP server for OpenCode / AI agents

```bash
liveviewer mcp
```

## CI Integration

```bash
# Fail if any WCAG violations exist
liveviewer audit https://mysite.com --wcag --fail-on 0

# Generate SARIF for GitHub Code Scanning
liveviewer audit https://mysite.com --wcag --design --sarif-output results.sarif
# Then upload with: gh api /repos/:owner/:repo/code-scanning/sarifs --input results.sarif
```

Exits with code 1 if WCAG failures exceed the threshold. SARIF output is compatible with GitHub Code Scanning upload (10 rule IDs across WCAG, Design QA, and ARIA categories). Plug into GitHub Actions, GitLab CI, etc.

## Web App Export Features

The web app at [jao-liveviewer.vercel.app](https://jao-liveviewer.vercel.app) includes multiple export options after an audit:

| Action | Description |
|--------|-------------|
| **Copy** | Copies a structured markdown report with all WCAG + Design + Fix suggestions (ideal for AI prompts) |
| **CSV** | Download failures as CSV with columns: Type, Selector, Value, Expected, Severity |
| **JSON** | Download full audit data as JSON (includes WCAG, design, recommendations, viewports) |
| **PDF** | Generate a printable PDF report with score gauges, violation tables, and fix suggestions |
| **Share** | Create a shareable 8-character link (7-day expiry) — opens same results in incognito |

## Known Limitations

Benchmarked against the W3C ACT Rule `afw4f7` (Text has minimum contrast, WCAG 1.4.3 AA) — 33 test cases. Current scores: **66.7% precision, 42.9% recall**.

| Gap | Impact | Status |
|-----|--------|--------|
| CSS variable opacity (`color-mix()`) | `getComputedStyle` resolves to fully opaque — causes 1:1 false positives on badge elements | Low priority |
| Gradient backgrounds (`linear-gradient`, `radial-gradient`) | Elements on gradients are skipped entirely | v3.2 (pixel sampling) |
| Shadow DOM (open mode only) | Elements inside `attachShadow({mode:'open'})` are not traversed | v3.2 |
| Text-shadow effects | May cause false positives (overly strict) or false negatives (missed insufficient contrast) | v3.2 |
| Overlapping elements | Not yet detected | Planned |

### CSS Variable Opacity False Positives

When a site uses `color-mix()` or CSS variables to create semi-transparent backgrounds (common for badges and tags), `getComputedStyle()` returns the fully resolved opaque color. If the foreground uses the same variable, both compute to the same hex value → reported as 1:1 ratio.

This affects **decorative elements only** (badges, tags, carousel arrows). Content text contrast is always accurate thanks to the alpha channel blending fix. Sites using traditional hex/rgb colors report accurate scores.

## Smart Enrichment (Optional)

Liveviewer can enrich WCAG audits with natural-language explanations and fix suggestions.

### Quick Start
```bash
export OPENAI_API_KEY=sk-...
liveviewer audit https://example.com --wcag --smart-enrich
```

**Tip:** For heavy pages (e.g., web.dev, nytimes.com), add `--wait-until domcontentloaded` to avoid timeouts:
```bash
liveviewer audit https://web.dev --wcag --design --smart-enrich --wait-until domcontentloaded
```

### Smart Enrichment Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--smart-enrich` | off | Enable smart enrichment |
| `--no-smart` | — | Force deterministic only |
| `--enhancement-key` | `OPENAI_API_KEY` env | Enhancement key |
| `--llm-base-url` | provider default or `OPENAI_BASE_URL` env | Custom backend URL (e.g., `https://api.deepseek.com/v1`) |
| `--llm-cache-ttl` | `7` | Cache duration in days |
| `--llm-clear-cache` | off | Clear cache before run |
| `--context` | — | Site purpose/audience description for more relevant suggestions |
| `--context-file` | — | Read context from file |
| `--smart-prompt` | off | Print the enrichment prompt to stdout without calling an API (useful for manual review) |

> **Legacy flags** `--llm-enrich`, `--no-llm`, `--llm-api-key`, `--llm-provider`, `--llm-model`, and `--ai-prompt` still work as hidden aliases for backward compatibility.

### Audit Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--wcag` | off | Enable WCAG contrast analysis |
| `--design` | off | Enable Design QA + ARIA rules |
| `--mobile` | off | Run both 1280×800 and 375×812 viewports (merged results) |
| `--viewports` | — | Comma-separated viewport list (e.g., `1280x800,375x812,768x1024`) |
| `--crawl` | off | Crawl same-origin pages (BFS, max 50 pages) |
| `--max-pages` | 50 | Max pages to crawl |
| `--depth` | 3 | Max crawl depth (0 = seed page only) |
| `--concurrency` | 3 | Concurrent audit processes |
| `--delay` | 200 | Delay (ms) between audit batches |
| `--no-cache` | off | Skip disk cache, force fresh audits |
| `--cache-dir` | `.liveviewer-cache` | Disk cache directory |
| `--cache-ttl` | 24 | Cache TTL in hours |
| `--sarif` | off | Output SARIF 2.1 JSON to stdout |
| `--sarif-output` | — | Write SARIF 2.1 JSON to file |
| `--fail-on` | — | Exit code 1 if WCAG failures exceed this threshold |
| `--output` | — | Write audit JSON to file |

### Output

```json
{
  "wcag": { "score": 84.9, "failCount": 36 },
  "llm": {
    "provider": "openai",
    "model": "gpt-3.5-turbo",
    "summary": "36 contrast failures, mostly on decorative badges...",
    "perFailure": [
      {
        "selector": "span.badge",
        "ruleId": "color-contrast",
        "explanation": "White text on light blue fails 4.5:1",
        "suggestion": "Darken text to #1a1a2e",
        "severity": "high"
      }
    ],
    "cached": false
  }
}
```

If the enrichment call fails (e.g., missing key or network error), the audit still succeeds and returns `llm.error`.

### Privacy

- Enhancement keys are sent directly to the backend from your machine — never to a Liveviewer server.
- Only failure summaries (selectors, colors, ratios) are sent, never full page DOM.

### Caching

Smart enrichment responses are cached in `./llm-cache/` to avoid repeated API calls. TTL defaults to 7 days. Use `--llm-clear-cache` to force fresh analysis.

## Interaction Syntax

| Pattern | Action |
|---------|--------|
| `click .btn` | Click element |
| `hover .menu` | Hover element |
| `wait 500` | Wait N ms |
| `scroll 500` | Scroll to Y |
| `type #email hello` | Type into field |
| `screenshot menu-open` | Intermediate screenshot |

## API

```javascript
const { audit, recommend, generateFixSuggestions } = require('@liveviewer/core');
const { enrichWithLLM } = require('@liveviewer/llm');

const result = await audit(url, { wcag: true, viewport: { width: 1280, height: 800 } });

// Deterministic fix suggestions (no API key needed)
const fixes = generateFixSuggestions(result);
console.log(fixes);

// Optional smart enrichment with context
const llmResult = await enrichWithLLM(result, {
  provider: 'openai-compatible',
  model: 'deepseek-chat',
  llmEnrich: true,
  apiKey: process.env.OPENAI_API_KEY,
  context: 'Marketing landing page for a fintech startup'
});
```

## Install

```bash
# Via npm global
npm install -g @liveviewer/cli

# Or from monorepo
git clone https://github.com/jamesonolitoquit/liveviewer.git
cd liveviewer
npm install
npx playwright install chromium
```

## Quick Start

```bash
# Deterministic audit with fix suggestions (no API key needed)
liveviewer audit https://example.com --wcag --design
```

## License

MIT

## Deployment

The web app is designed to deploy to **Vercel Hobby** (free tier) with no extra infrastructure.

### Quick Deploy

```bash
cd apps/web
npx vercel --prod
```

### Architecture

| Layer | Implementation |
|-------|----------------|
| **Browser binary** | `@sparticuz/chromium-min` (downloads pack from GitHub releases on first request, cached in `/tmp` for warm starts) |
| **Timeout** | 9.5s hard cap inside a 10s Vercel function limit |
| **Memory** | `--js-flags=--max-old-space-size=96` to stay under 128MB |
| **Viewport** | 1024×768 (smaller than desktop to reduce paint time) |
| **Resource blocking** | Images, fonts, media blocked by default to fit `domcontentloaded` budget |
| **Caching** | LRU in-memory cache, 50 entries max, 7-day TTL |
| **Rate limiting** | 10 req/min/IP via Upstash Redis (sliding window); in-memory fallback |
| **Fallback** | 503 with CLI suggestion if cold start > 10s or OOM |

### Environment Variables

| Var | Required | Purpose |
|-----|----------|---------|
| `OPENAI_API_KEY` | For smart enrichment | Enhancement key (also `--enhancement-key`, legacy `--llm-api-key`) |
| `OPENAI_BASE_URL` | For custom endpoints | Override API base URL (also `--llm-base-url`) |
| `OPENAI_MODEL` | For custom model | Override default model name (legacy `--llm-model`, kept for compatibility) |
| `CHROMIUM_PACK_URL` | No | Override the GitHub release URL for the chromium pack (use a faster CDN if needed) |
| `UPSTASH_REDIS_REST_URL` | No | Enables persistent rate-limit counters across cold starts |
| `UPSTASH_REDIS_REST_TOKEN` | No | Paired with `UPSTASH_REDIS_REST_URL` |
| `AUDIT_RATE_LIMIT_PER_MINUTE` | No | Default 10. Lower for stricter limits |
| `NEXT_PUBLIC_HISTORY_RETENTION_DAYS` | No | History retention window, default 30 |

Without Redis, rate limiting falls back to per-instance in-memory counters (resets on cold start). Good enough for low traffic; switch to Redis once you exceed ~50 req/min.

### Smoke Test (Post-Deploy)

```bash
npm run verify:deployment -- https://your-app.vercel.app
```

This runs real audits against `example.com`, `web.dev`, and `github.com` and reports pass/fail + timings. Exits 0 only if all sites complete within the cold-start budget.

### Known Limitations (Vercel)

- **Heavy pages time out** (e.g. `nytimes.com`, `amazon.com`). Use the CLI (`npm install -g @liveviewer/cli`) for those.
- **Cold start** can be 5–10s on the first request after a long idle period while the chromium pack is downloaded.
- **Function size** is at the Hobby 50MB limit. Don't add large image-processing libraries to the web workspace.

### If Vercel Hobby Becomes Insufficient

Move the `/api/audit` route to a dedicated service (Fly.io, Render, Railway) that allows 30s+ timeouts and 1GB+ memory. The core audit code in `packages/core` is platform-agnostic — only `auditor.js`'s `getChromium()` function needs to swap implementations.


