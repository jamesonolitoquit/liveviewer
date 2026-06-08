# Liveviewer

Design QA robot for live websites. Audits WCAG contrast, extracts design tokens, detects jank, and generates client-ready reports.

**Web app:** [liveviewer.vercel.app](https://liveviewer.vercel.app) — run audits in your browser, no install needed.  
**CLI:** `npm install -g liveviewer` — for CI pipelines and local development.

```bash
npm install -g liveviewer
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

### `audit` — WCAG accessibility + Design QA analysis

```bash
# WCAG contrast audit (single desktop viewport)
liveviewer audit https://example.com --wcag --label audit1

# WCAG + Design QA at both Desktop & Mobile viewports (merged results)
liveviewer audit https://web.dev --wcag --design --mobile

# Explicit viewport list (overrides --width/--height)
liveviewer audit https://example.com --wcag --viewports 1280x800,375x812

# Exit non-zero if WCAG failures exceed threshold (for CI)
liveviewer audit https://example.com --wcag --fail-on 0
```

The `--mobile` flag runs both `1280x800` and `375x812` viewports and merges failures (deduplicated by selector+colors, tagged by viewport origin). `--viewports` accepts a comma-separated list for custom combinations.

**CLI and web app produce identical deterministic results** (WCAG failures, Design QA scores) when using the same URL and viewport configuration. The only difference is optional AI enrichment.

Reports: `<url>-<timestamp>.png` (screenshot) + `.json` with per-element contrast ratios and Design QA issues.

Includes:
- **WCAG contrast** – per-element contrast ratios with background ancestor walk (correct alpha blending for `rgba`)
- **Design QA** – typography (font-size ≥16px, line-height 1.4–1.6), horizontal scroll detection
- **AI enrichment** (optional) – `--llm-enrich` sends failures to an LLM for fix suggestions, returning `perFailure` (WCAG) and `designFixes` (Design QA) sections

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
liveviewer audit https://mysite.com --wcag --fail-on 0
```

Exits with code 1 if WCAG failures exceed the threshold. Plug into GitHub Actions, GitLab CI, etc.

## Known Limitations

| Gap | Impact | Status |
|-----|--------|--------|
| CSS variable opacity (`color-mix()`) | `getComputedStyle` resolves to fully opaque — causes 1:1 false positives on badge elements | Low priority (v1.1) |
| SVG `<text>` elements | Not traversed by TreeWalker | Low priority |
| Shadow DOM | Not traversed by TreeWalker | Low priority |

### CSS Variable Opacity False Positives

When a site uses `color-mix()` or CSS variables to create semi-transparent backgrounds (common for badges and tags), `getComputedStyle()` returns the fully resolved opaque color. If the foreground uses the same variable, both compute to the same hex value → reported as 1:1 ratio.

This affects **decorative elements only** (badges, tags, carousel arrows). Content text contrast is always accurate thanks to the alpha channel blending fix. Sites using traditional hex/rgb colors report accurate scores.

## AI-Enriched Audits (Optional)

Liveviewer can enrich WCAG audits with natural-language explanations and fix suggestions using LLMs.

### Quick Start (OpenAI)
```bash
export OPENAI_API_KEY=sk-...
liveviewer audit https://example.com --wcag --llm-enrich
```

### Quick Start (Ollama — local, free)
```bash
ollama pull llama3
liveviewer audit https://example.com --wcag --llm-enrich --llm-provider ollama
```

### LLM Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--llm-enrich` | off | Enable AI enrichment |
| `--no-llm` | — | Force deterministic only |
| `--llm-provider` | `openai` | `openai` or `ollama` |
| `--llm-model` | `gpt-3.5-turbo` | Model name |
| `--llm-api-key` | `OPENAI_API_KEY` env | API key |
| `--llm-cache-ttl` | `7` | Cache duration in days |
| `--llm-clear-cache` | off | Clear cache before run |

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

If the LLM call fails (e.g., missing key or network error), the audit still succeeds and returns `llm.error`.

### Privacy

- API keys are sent directly to the provider from your machine — never to a Liveviewer backend.
- Only failure summaries (selectors, colors, ratios) are sent, never full page DOM.
- For complete privacy, use `--llm-provider ollama` for fully local processing.

### Caching

LLM responses are cached in `./llm-cache/` to avoid repeated API calls. TTL defaults to 7 days. Use `--llm-clear-cache` to force fresh analysis.

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
const { audit, extract, recommend, renderHtml } = require('@liveviewer/core');
const { enrichWithLLM } = require('@liveviewer/llm');

const result = await audit(url, { wcag: true, viewport: { width: 1280, height: 800 } });

const llmResult = await enrichWithLLM(result, {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  llmEnrich: true,
  apiKey: process.env.OPENAI_API_KEY
});
```

## Install

```bash
# Via npm global
npm install -g liveviewer

# Or from monorepo
git clone https://github.com/jamesonolitoquit/liveviewer.git
cd liveviewer
npm install
npx playwright install chromium
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
| **Fallback** | 503 with extension link if cold start > 10s or OOM |

### Environment Variables

| Var | Required | Purpose |
|-----|----------|---------|
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

- **Heavy pages time out** (e.g. `nytimes.com`, `amazon.com`). Use the [browser extension](#browser-extension) for those.
- **Cold start** can be 5–10s on the first request after a long idle period while the chromium pack is downloaded.
- **Function size** is at the Hobby 50MB limit. Don't add large image-processing libraries to the web workspace.

### If Vercel Hobby Becomes Insufficient

Move the `/api/audit` route to a dedicated service (Fly.io, Render, Railway) that allows 30s+ timeouts and 1GB+ memory. The core audit code in `packages/core` is platform-agnostic — only `auditor.js`'s `getChromium()` function needs to swap implementations.

## Browser Extension

The Liveviewer browser extension performs audits locally in the user's browser, bypassing serverless constraints entirely. Use it for:
- Local/staging sites (no cross-origin issues)
- Very large pages (no timeout limits)
- Behind-firewall intranet apps

See `packages/extension/` for build instructions.
