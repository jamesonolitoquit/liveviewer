# Liveviewer

Design QA robot for live websites. Audits WCAG contrast, extracts design tokens, detects jank, and generates client-ready reports.

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

### `audit` — WCAG contrast analysis with background ancestor walk

```bash
liveviewer audit https://example.com --wcag --label audit1
liveviewer audit https://example.com --wcag --fail-on 0
```

Exits non-zero if failures exceed `--fail-on` threshold (for CI).

Reports: `<url>-<timestamp>.png` (screenshot) + `.json` with per-element contrast ratios.

**Alpha blending:** Semi-transparent text (`rgba`) is correctly blended against its background before computing contrast.

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
const { audit, extract } = require('liveviewer/src/auditor');
const { recommend } = require('liveviewer/src/recommender');
const { renderHtml } = require('liveviewer/src/report');
const { record, screenshot } = require('liveviewer/src/recorder');
```

## License

MIT
