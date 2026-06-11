# Benchmark Results – P0 Fixes

## Rule: afw4f7 (Text has minimum contrast)

| Metric | Before | After P0 | Delta |
|--------|--------|----------|-------|
| **True Positives** | 5 | **6** | +1 |
| **False Positives** | 12 | **9** | -3 |
| **True Negatives** | 7 | **10** | +3 |
| **False Negatives** | 9 | **8** | -1 |
| **Precision** | 29.4% | **40.0%** | +10.6pp |
| **Recall** | 35.7% | **42.9%** | +7.2pp |

## P0 Fixes Applied

### P0.1 – Default background fallback
- **File:** `packages/core/src/auditor.js:135`
- **Fix:** When `getComputedStyle(document.documentElement).backgroundColor` returns transparent (`rgba(0,0,0,0)`), default to `rgb(255,255,255)` instead.
- **Impact:** +3 TN (passed-8, passed-10, passed-11 now correctly pass)
- **Root cause:** Pages without explicit background color had text-on-transparent computed as 1:1 ratio.

### P0.2 – Opacity blending
- **File:** `packages/core/src/auditor.js` (new `blendOpacity` function + integration)
- **Fix:** For elements with `opacity < 1`, blend foreground color with background using: `result = opacity × fg + (1 − opacity) × bg`
- **Impact:** +1 TP (failed-5 now correctly detects `#000` with `opacity: .3` on `#FFF` as 2.1:1)
- **Root cause:** CSS `opacity` property was ignored; only `rgba()` color values were blended.

## Remaining Issues (to be addressed in P1)

| Category | Count | Cases |
|----------|-------|-------|
| Gradient backgrounds | 5 | passed-2, passed-3, failed-2, failed-3, failed-7 |
| Shadow DOM | 2 | passed-9, failed-6 |
| Hidden elements not filtered | 3 | inapplicable-1 (display:none), inapplicable-2 (off-screen), inapplicable-4 (SVG text) |
| Disabled elements not filtered | 3 | inapplicable-7, inapplicable-10, inapplicable-11 |
| aria-hidden not handled | 1 | inapplicable-3 |
| Text-shadow not considered | 2 | passed-4 (FP), failed-11 (FN) |
| Non-human language exception | 1 | passed-7 (FP) |
