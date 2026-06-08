# Liveviewer v2.2.1

Design QA robot for live websites. Audits WCAG contrast, detects design issues, validates ARIA accessibility, and generates deterministic fix suggestions — **no API key required**. Optional AI enrichment with your own key.

**Web app:** [jao-liveviewer.vercel.app](https://jao-liveviewer.vercel.app) — run audits in your browser, no install needed.  
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

### `audit` — WCAG accessibility + Design QA + ARIA analysis

```bash
# WCAG contrast audit (single desktop viewport)
liveviewer audit https://example.com --wcag

# WCAG + Design QA + ARIA rules at both Desktop & Mobile viewports (merged)
liveviewer audit https://web.dev --wcag --design --mobile

# Explicit viewport list (overrides --width/--height)
liveviewer audit https://example.com --wcag --design --viewports 1280x800,375x812

# Deterministic fix suggestions (no API key needed) — shown automatically
liveviewer audit https://example.com --wcag --design

# SARIF 2.1 output (compatible with GitHub Code Scanning)
liveviewer audit https://example.com --wcag --design --sarif
liveviewer audit https://example.com --wcag --design --sarif-output ./results.sarif

# Contextual AI enrichment — tell the AI about your site's purpose
liveviewer audit https://example.com --wcag --llm-enrich --context "SaaS dashboard for engineers, dark mode"

# Read context from file
liveviewer audit https://example.com --wcag --llm-enrich --context-file ./site-brief.txt

# Exit non-zero if WCAG failures exceed threshold (for CI)
liveviewer audit https://example.com --wcag --fail-on 0
```

The `--mobile` flag runs both `1280x800` and `375x812` viewports and merges failures (deduplicated by selector+colors, tagged by viewport origin with D/M badges). `--viewports` accepts a comma-separated list for custom combinations.

**CLI and web app produce identical deterministic results** (WCAG failures, Design QA scores, ARIA failures) when using the same URL and viewport configuration. The only difference is optional AI enrichment.

Reports: `<url>-<timestamp>.png` (screenshot) + `.json` with all failures and fix suggestions.

Includes:
- **WCAG contrast** – per-element contrast ratios with background ancestor walk (correct alpha blending for `rgba`), `sr-only` elements automatically filtered
- **Design QA** – typography (font-size ≥16px, line-height 1.4–1.6), horizontal scroll detection, heading hierarchy validation
- **ARIA rules** – missing alt text, empty interactive elements, missing `lang` attribute, missing form labels, skip navigation / main landmark detection
- **Deterministic fix suggestions** – rule-based fixes for every failure, shown automatically in CLI and web app (no API key required)
- **SARIF 2.1 output** – 10 rule IDs compatible with GitHub Code Scanning upload
- **AI enrichment** (optional) – `--llm-enrich` sends failures to an LLM. Use `--context` to provide site purpose for more relevant suggestions. Use `--ai-prompt` to print the prompt without calling an API.

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

| Gap | Impact | Status |
|-----|--------|--------|
| CSS variable opacity (`color-mix()`) | `getComputedStyle` resolves to fully opaque — causes 1:1 false positives on badge elements | Low priority |
| SVG `<text>` elements | Not traversed by TreeWalker | Low priority |
| Shadow DOM | Not traversed by TreeWalker | Low priority |
| Overlapping elements | Not yet detected (experimental, planned for v2.3) | Planned |

### CSS Variable Opacity False Positives

When a site uses `color-mix()` or CSS variables to create semi-transparent backgrounds (common for badges and tags), `getComputedStyle()` returns the fully resolved opaque color. If the foreground uses the same variable, both compute to the same hex value → reported as 1:1 ratio.

This affects **decorative elements only** (badges, tags, carousel arrows). Content text contrast is always accurate thanks to the alpha channel blending fix. Sites using traditional hex/rgb colors report accurate scores.

## AI-Enriched Audits (Optional)

Liveviewer can enrich WCAG audits with natural-language explanations and fix suggestions using LLMs.

### Quick Start (OpenAI)
```bash
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o-mini    # optional, defaults to gpt-4o-mini
liveviewer audit https://example.com --wcag --llm-enrich
```

**Tip:** For heavy pages (e.g., web.dev, nytimes.com), add `--wait-until domcontentloaded` to avoid timeouts:
```bash
liveviewer audit https://web.dev --wcag --design --llm-enrich --wait-until domcontentloaded
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
| `--llm-provider` | `openai` | Provider: `openai`, `anthropic`, `google`, `ollama`, or `openai-compatible` |
| `--llm-model` | `gpt-4o-mini` or `OPENAI_MODEL` env | Model name |
| `--llm-api-key` | `OPENAI_API_KEY` env | API key |
| `--llm-base-url` | provider default or `OPENAI_BASE_URL` env | Custom base URL (e.g., `https://openrouter.ai/api/v1`) |
| `--llm-cache-ttl` | `7` | Cache duration in days |
| `--llm-clear-cache` | off | Clear cache before run |
| `--context` | — | Site purpose/audience description for more relevant suggestions |
| `--context-file` | — | Read context from file |
| `--ai-prompt` | off | Print the AI prompt to stdout without calling an API (useful for manual review) |

### Audit Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--wcag` | off | Enable WCAG contrast analysis |
| `--design` | off | Enable Design QA + ARIA rules |
| `--mobile` | off | Run both 1280×800 and 375×812 viewports (merged results) |
| `--viewports` | — | Comma-separated viewport list (e.g., `1280x800,375x812,768x1024`) |
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
const { audit, recommend, generateFixSuggestions } = require('@liveviewer/core');
const { enrichWithLLM } = require('@liveviewer/llm');

const result = await audit(url, { wcag: true, viewport: { width: 1280, height: 800 } });

// Deterministic fix suggestions (no API key needed)
const fixes = generateFixSuggestions(result);
console.log(fixes);

// Optional AI enrichment with context
const llmResult = await enrichWithLLM(result, {
  provider: 'openai',
  model: 'gpt-4o-mini',
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
| `OPENAI_API_KEY` | For AI enrichment | API key for LLM provider (also `--llm-api-key`) |
| `OPENAI_BASE_URL` | For custom LLM endpoints | Override API base URL (also `--llm-base-url`) |
| `OPENAI_MODEL` | For custom LLM endpoints | Override default model name (also `--llm-model`) |
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


