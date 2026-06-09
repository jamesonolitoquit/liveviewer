# Changelog

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
