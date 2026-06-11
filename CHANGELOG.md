# Changelog

## v4.2.0 (2026-06-12)

- **`waitUntil` default changed to `load`** — ensures React hydration completes before element collection; eliminates race condition where dynamic modals/overlays appeared inconsistently between CLI and web app
- **Multi-viewport element merge** — elements from all viewports are now accumulated (deduped by selector) instead of only the last viewport's elements being used for engine analysis; fixes `--mobile` losing design QA findings from earlier viewports
- **`--wait-stable` flag** — optional MutationObserver-based wait for DOM stability (300ms without mutations, 3s timeout); catches dynamic content added after `load` (lazy-loaded widgets, async React updates)
- **Design QA parity** — CLI and web app now produce identical failure counts and scores for the same URL/viewports; dedup verified across viewports
- **Dynamic content fixture** (`test/fixtures/dynamic/`) — blocking and deferred (setTimeout) content scenarios for regression testing
- **Viewport-merge unit tests** — 8 new vitest tests validating merge/dedup logic
- **Hardening verification script** (`scripts/verify-hardening.js`) — 11 checks for delayed content, responsive elements, dedup, and CLI documentation
- **Legal benchmark fixed** — `benchmark-legal.js` updated for `runLegalChecks` returning `{ failures, totalChecks }` (v4.1.1 regression)
- **CI pipeline updated** — `test:viewport-merge` and `test:performance` added to GitHub Actions
- **All 5 benchmarks at 100% precision/recall**: Design QA, SEO, Security, Legal & Privacy, Accessibility

## v4.1.1 (2026-06-12)

- **Legal score fix** — `runLegalChecks` now returns `{ failures, totalChecks: 5 }` instead of bare array; `auditor.js` computes proportional score (`passCount / totalChecks * 100`) instead of hardcoding `score: 0`
- **Parity script HTTPS support** — dynamically requires `https` module when URL protocol is `https:`, fixing redirect errors against production Vercel
- **Legal score confirmed**: 20% on liveviewer homepage (privacy link detected, 4 other rules genuinely fail)

## v4.1.0 (2026-06-12)

- **Performance pillar visible in API** — `sanitized.performance` now serialized in route.ts response (was silently dropped)
- **SEO/Security/Legal detail sections guarded** — wrapped with conditional checks matching WCAG/Design pattern

## v4.0.0 (2026-06-12)

- **6 hardened pillars** all at 100% benchmark accuracy:
  - WCAG contrast (100% on W3C ACT Rule afw4f7, 33/33 cases)
  - Design QA (font-size, line-height, heading hierarchy, horizontal scroll)
  - SEO (title, meta description, canonical, viewport, Open Graph, Twitter Cards, JSON-LD)
  - Security (HSTS, CSP, X-Frame-Options, mixed content, secure cookies, etc.)
  - Legal & Privacy (cookie consent, privacy policy, imprint, terms of service)
  - Performance (Lighthouse integration with grade A–F, LCP, CLS, TBT, FCP, SI, TTI)
- **Visual report** on web app — Recharts radar chart (6-axis score comparison) and stacked pass/fail bar chart per pillar
- **CLI `--all` flag** — runs all 6 pillars in one command
- **Parity script** now uses async parallel execution and proportional tolerance (max 10/10%) for dynamic sites — verified 10/10 real-world URLs match between CLI and web app
- **Production web app** deployed at jao-liveviewer.vercel.app — all pillars available, shareable report links, dark/light mode
- **npm packages published** — `@liveviewer/core`, `@liveviewer/llm`, `@liveviewer/cli` at v4.0.0

## v2.3.0 (2026-06-09)

- Fix suggestions now include viewport info like "on Desktop and Mobile" instead of showing D or M badges next to the ratio
- Viewport badges in failure cards no longer wrap awkwardly next to contrast text
- Smart Panel turned into a slide-in drawer on the right side
- History page saves your last 50 audits in the browser
- Feedback button added so you can report issues straight to GitHub
- Font size bumped to 16px minimum everywhere -- no more tiny text
- Layout widened so results are less cramped
- Light mode is the default now; dark mode toggles via a button and saves to localStorage
- Inter font replaces Geist via next/font for faster loading
- API route now always returns fix suggestions in the response
- Playwright tests updated to use port 3005
- Retry loop added in auditor.js for when the browser closes unexpectedly
- Home page cleaned up -- inline LLM results moved into the Smart Panel
- CLI kept its legacy flags as hidden aliases so old scripts still work
- Both CLI and web app produce the same results for the same URL

## v2.2.1 (2026-04-15)

- Fixed a race condition where chromium would crash with ETXTBSY or ENOSPC during concurrent audits
- Warmup cron now runs a real audit instead of a ping so the browser stays loaded
- Engine fixed to use ESM imports properly
- DeepSeek support added as the default LLM provider
- CLI and web app outputs brought into parity
- Environment variable fallbacks added for LLM config

## v2.2.0 (2026-03-20)

- SARIF 2.1 output for GitHub Code Scanning integration
- Client-side retry added when an audit times out or hits a 503
- Heading hierarchy checks -- warns if you skip from h1 to h3
- Basic ARIA rules: missing alt text, empty buttons, missing lang attribute, missing form labels, skip navigation detection
- Custom viewport list support (`--viewports 1280x800,375x812,768x1024`)
- Parity test script to compare CLI vs web app output

## v2.1.2 (2026-03-05)

- Fixed global install path resolution in sarif.js
- Fixed CLI --version when installed globally

## v2.1.0 (2026-02-15)

- Deterministic fix suggestions -- no API key required, just rule-based recommendations
- --context flag for smart enrichment so you can describe your site
- Context file support via --context-file
- Background ancestor walk for correct alpha blending with rgba colors
- sr-only elements automatically filtered out of contrast checks

## v2.0.0 (2026-01-20)

- Design QA checks: font size minimum, line height range, horizontal scroll detection
- Multi-viewport audits: run Desktop and Mobile at the same time, results merged
- --ai-prompt flag prints the LLM prompt without calling an API
- Shareable report links (8-character ID, 7-day expiry)
- Warmup cron to keep the Vercel deployment from going cold
- CLI and web app now produce the same results for the same URL

## v1.0.0 (2025-12-01)

- Initial release
- WCAG contrast audits via Playwright + axe-core
- Frame-by-frame recording with performance metrics
- Screenshots with LCP and image metadata
- LLM enrichment via OpenAI-compatible providers
- CLI tool with record, screenshot, audit, and extract commands
- Basic Vercel web app deployment
