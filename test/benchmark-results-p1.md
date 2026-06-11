# Benchmark Results – P0+P1 Fixes

## Rule: afw4f7 (Text has minimum contrast)

### Full progression

| Metric | Before | After P0 | After P0+P1 | Total Delta |
|--------|--------|----------|-------------|-------------|
| **True Positives** | 5 | 6 | 6 | +1 |
| **False Positives** | 12 | 9 | **3** | **-9** |
| **True Negatives** | 7 | 10 | **16** | **+9** |
| **False Negatives** | 9 | 8 | 8 | -1 |
| **Precision** | 29.4% | 40.0% | **66.7%** | **+37.3pp** |
| **Recall** | 35.7% | 42.9% | **42.9%** | **+7.2pp** |

### P0 Fixes

#### P0.1 – Default background fallback
- **File:** `packages/core/src/auditor.js:155-157`
- **Fix:** When `documentElement` background is transparent, default to `rgb(255,255,255)` instead.
- **Impact:** +3 TN (passed-8, passed-10, passed-11 now correctly pass)

#### P0.2 – Opacity blending
- **File:** `packages/core/src/auditor.js` (new `blendOpacity` function + integration)
- **Fix:** For elements with `opacity < 1`, blend fg color with bg: `result = opacity × fg + (1−opacity) × bg`
- **Impact:** +1 TP (failed-5 correctly detects `#000` with `opacity: .3` on `#FFF` as 2.1:1)

### P1 Fixes

#### P1.1 – Hidden element filter
- **File:** `packages/core/src/auditor.js:171-177`
- **Applied checks:** `display: none`, `aria-hidden="true"`, SVG `<svg>`/`<text>` tags, off-screen positioned elements (`position: absolute/fixed` with `getBoundingClientRect` outside viewport)
- **Impact:** +4 TN (inapplicable-1,2,3,4 now correctly skipped)

#### P1.2 – Disabled element filter
- **File:** `packages/core/src/auditor.js:179-188`
- **Applied checks:** `el.disabled`, `aria-disabled="true"`, `fieldset[disabled]` ancestor walk
- **Impact:** +2 TN (inapplicable-10,11 now correctly skipped as inapplicable)

### Remaining Gaps (for v3.2)

| Category | Count | Cases | Difficulty |
|----------|-------|-------|------------|
| Gradient backgrounds (`linear-gradient`, `radial-gradient`) | 5 | passed-2,3, failed-2,3,7 | Hard (pixel sampling) |
| Shadow DOM (open mode) | 2 | passed-9, failed-6 | Medium |
| Text-shadow effects | 2 | passed-4 (FP), failed-11 (FN) | Hard (pixel-level) |
| Non-human language exception | 1 | passed-7 (FP) | Low priority |
| Disabled widget label (via `aria-labelledby`) | 1 | inapplicable-7 (FP) | Medium |
