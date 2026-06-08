#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// chdir to monorepo root so relative paths resolve correctly
process.chdir(path.resolve(__dirname, '..', '..', '..'));

const command = process.argv[2];

if (command === '--version' || command === '-v') {
  console.log(require('../../../package.json').version);
  process.exit(0);
}

if (!command || command === '--help' || command === '-h') {
  console.log(`
Liveviewer — Frame-by-frame visual recording and analysis tool

Usage:
  liveviewer record <url> [options]    Record a website with frame timing analysis
  liveviewer screenshot <url> [options] Take a screenshot with performance metadata
  liveviewer analyze <recording-tag>   Analyze a previous recording
  liveviewer audit <url> [options]     Audit a website (accessibility, layout)
  liveviewer extract <url> [options]   Extract design tokens (colors, typography, spacing)
  liveviewer recommend <audit-json> [options]  Generate recommendations from audit data
  liveviewer mcp                       Start MCP server (for OpenCode integration)
  liveviewer --help                    Show this help

Options for "recommend":
  --extract <file>   Optional style extraction JSON for token-level analysis
  --format           Output format: text (default), markdown, or html
  --output <path>    Output path for HTML report (default: report.html next to audit)
  --fail-on <n>      Exit non-zero if failures exceed n (for CI)

Options for "audit":
  --width <px>        Viewport width (default: 1280)
  --height <px>       Viewport height (default: 800)
  --label <name>      Label for the audit (default: "audit")
  --wcag              Enable WCAG contrast analysis
  --design            Enable design QA analysis (typography, line-height, horizontal scroll)
  --mobile            Audit at both Desktop (1280x800) and Mobile (375x812) viewports, merging results
  --viewports <list>  Comma-separated viewports, e.g. "1280x800,375x812" (overrides --width/--height)
  --fail-on <n>       Exit non-zero if WCAG failures exceed n (for CI)
  --timeout <ms>      Navigation timeout (default: 30000)
  --wait-until <str>  Navigation wait strategy: networkidle (default), load, domcontentloaded
  --llm-enrich        Enable AI enrichment of audit results (requires API key)
  --no-llm            Force deterministic only, skip AI even if key present
  --ai-prompt         Print AI-ready analysis prompt (no API key needed; pipe to AI or copy-paste)
  --llm-provider <n>  AI provider: openai (default) or ollama
  --llm-model <name>  Model (default: gpt-3.5-turbo or llama3 for ollama)
  --llm-api-key <key> API key (or set OPENAI_API_KEY env var)
  --context <text>    Site context/purpose for more relevant AI recommendations (e.g., "Dark mode SaaS dashboard")
  --context-file <p>  Read context from file
  --sarif             Output SARIF 2.1 report to stdout (for GitHub Code Scanning)
  --sarif-output <p>  Write SARIF report to file instead of stdout
  --llm-cache-ttl <d> Cache duration in days (default: 7)
  --llm-clear-cache   Clear LLM cache before running

Options for "extract":
  --width <px>        Viewport width (default: 1280)
  --height <px>       Viewport height (default: 800)
  --label <name>      Label for the extract (default: "extract")
  --styles            Extract design tokens (colors, typography, spacing)
  --brand <path>      Brand config JSON for design system violation detection
  --timeout <ms>      Navigation timeout (default: 30000)
  --wait-until <str>  Navigation wait strategy: networkidle (default), load, domcontentloaded

Options for "record":
  --duration <ms>     Recording duration (default: 5000)
  --width <px>        Viewport width (default: 1280)
  --height <px>       Viewport height (default: 800)
  --label <name>      Label for the recording (default: "recording")
  --visible           Run in visible browser (default: headless)
  --interact <json>   JSON interaction array, e.g. '[{"type":"click","selector":".btn"}]'
  --interaction <str> Natural language interaction shorthand, repeatable:
                        click <sel>   hover <sel>   scroll <y>
                        wait <ms>     type <sel> <text>   screenshot [name]

Options for "screenshot":
  --width <px>        Viewport width (default: 1280)
  --height <px>       Viewport height (default: 800)
  --full-page         Full page screenshot (default: true)
  --label <name>      Label for screenshot (default: "shot")
  --selector <css>    CSS selector for element-level screenshot

Options for "analyze":
  --fps <n>           Frames per second to extract (default: 10)
  --max-frames <n>    Maximum frames (default: 100)
  --threshold <n>     pixelmatch threshold 0-1 (default: 0.1)

Examples:
  liveviewer record https://jaostudio.vercel.app --duration 3000 --label portfolio
  liveviewer record https://jaostudio.vercel.app --interaction "click .btn" --interaction "wait 1000"
  liveviewer screenshot https://jaostudio.vercel.app --full-page --label home
  liveviewer analyze portfolio-1234567890 --fps 5
  liveviewer audit https://example.com --wcag --llm-enrich
  liveviewer audit https://example.com --wcag --mobile --design
  liveviewer audit https://web.dev --wcag --mobile --design --llm-enrich
  liveviewer mcp
`);
  process.exit(0);
}

async function main() {
  const { record, screenshot } = require('@liveviewer/core/src/recorder');
  const { analyzeRecording, generateReport } = require('@liveviewer/core/src/analyzer');
  const { startServer } = require('@liveviewer/core/src/mcp');
  const { audit } = require('@liveviewer/core/src/auditor');
  const { extract, checkBrandViolations } = require('@liveviewer/core/src/extractor');
  const { recommend, generateFixSuggestions } = require('@liveviewer/core/src/recommender');
  const { renderHtml } = require('@liveviewer/core/src/report');
  const { toSarifLog } = require('@liveviewer/core/src/sarif');

  switch (command) {
    case 'record': {
      const url = process.argv[3];
      if (!url) {
        console.error('Error: URL required. Usage: liveviewer record <url>');
        process.exit(1);
      }
      const duration = parseArg('--duration') || 5000;
      const width = parseInt(parseArg('--width') || '1280');
      const height = parseInt(parseArg('--height') || '800');
      const label = parseArg('--label') || 'recording';
      const headless = !hasFlag('--visible');
      const interactions = [
        ...(parseJsonArg('--interact') || []),
        ...collectInteractions()
      ];

      console.log(`Recording ${url} for ${duration}ms at ${width}x${height}...`);
      const result = await record(url, {
        duration: Number(duration),
        viewport: { width, height },
        label,
        headless,
        interactions
      });

      console.log('\nRecording complete!');
      console.log(`  Tag:        ${result.tag}`);
      console.log(`  Video:      ${result.videoPath}`);
      if (result.metrics) {
        console.log(`  Frames:     ${result.metrics.totalFrames}`);
        console.log(`  Mean delta: ${result.metrics.meanDelta}ms`);
        console.log(`  Jank:       ${result.metrics.jankFrames} frames (${result.metrics.jankRate}%)`);
        console.log(`  Smoothness: ${result.metrics.smoothnessScore}/100`);
      }
      console.log(`  Metadata:   recordings/${result.tag}.json`);
      break;
    }

    case 'screenshot': {
      const url = process.argv[3];
      if (!url) {
        console.error('Error: URL required. Usage: liveviewer screenshot <url>');
        process.exit(1);
      }
      const width = parseInt(parseArg('--width') || '1280');
      const height = parseInt(parseArg('--height') || '800');
      const fullPage = !hasFlag('--no-full-page');
      const label = parseArg('--label') || 'shot';
      const selector = parseArg('--selector') || null;

      console.log(`Taking screenshot of ${url} at ${width}x${height}...`);
      const result = await screenshot(url, {
        viewport: { width, height },
        fullPage,
        label,
        selector
      });

      console.log('\nScreenshot saved!');
      console.log(`  File:     ${result.filepath}`);
      if (result.metrics) {
        console.log(`  Title:    ${result.metrics.title}`);
        console.log(`  LCP:      ${result.metrics.lcp ? Math.round(result.metrics.lcp) + 'ms' : 'N/A'}`);
        console.log(`  Images:   ${result.metrics.imageCount} total`);
        if (result.metrics.brokenImages > 0) console.log(`  ⚠ Broken:  ${result.metrics.brokenImages}`);
        if (result.metrics.missingAlt > 0) console.log(`  ⚠ No alt:  ${result.metrics.missingAlt}`);
      }
      break;
    }

    case 'audit': {
      const url = process.argv[3];
      if (!url) {
        console.error('Error: URL required. Usage: liveviewer audit <url>');
        process.exit(1);
      }
      const width = parseInt(parseArg('--width') || '1280');
      const height = parseInt(parseArg('--height') || '800');
      const label = parseArg('--label') || 'audit';
      const doWcag = hasFlag('--wcag');
      const doDesign = hasFlag('--design');
      const doMobile = hasFlag('--mobile');
      const viewportsArg = parseArg('--viewports');
      let auditViewports;
      if (viewportsArg) {
        auditViewports = viewportsArg.split(',').map(v => {
          const [w, h] = v.split('x').map(Number);
          return { width: w, height: h };
        }).filter(v => !isNaN(v.width) && !isNaN(v.height));
      } else if (doMobile) {
        auditViewports = [{ width: 1280, height: 800 }, { width: 375, height: 812 }];
      }
      const timeout = parseInt(parseArg('--timeout') || '30000');
      const waitUntil = parseArg('--wait-until') || 'networkidle';

      const doAiPrompt = hasFlag('--ai-prompt');
      const llmEnrich = (hasFlag('--llm-enrich') || (!hasFlag('--no-llm') && !!parseArg('--llm-api-key') || !!process.env.OPENAI_API_KEY)) && !doAiPrompt;
      const llmProvider = parseArg('--llm-provider') || 'openai';
      const llmModel = parseArg('--llm-model') || (llmProvider === 'ollama' ? 'llama3' : 'gpt-3.5-turbo');
      const llmApiKey = parseArg('--llm-api-key') || process.env.OPENAI_API_KEY || '';
      const llmCacheTtl = parseInt(parseArg('--llm-cache-ttl') || '7');
      const llmClearCache = hasFlag('--llm-clear-cache');

      let context = parseArg('--context') || '';
      const contextFile = parseArg('--context-file');
      if (contextFile) {
        try {
          context = fs.readFileSync(contextFile, 'utf-8').trim();
        } catch (e) {
          console.error(`Error: Could not read context file at ${contextFile}`);
          process.exit(1);
        }
      }

      if (auditViewports) {
        console.log(`Auditing ${url} at ${auditViewports.length} viewport(s): ${auditViewports.map(v => `${v.width}x${v.height}`).join(', ')}...`);
      } else {
        console.log(`Auditing ${url} at ${width}x${height}...`);
      }
      const auditOpts = {
        viewport: { width, height },
        label,
        wcag: doWcag,
        design: doDesign,
        timeout,
        waitUntil
      };
      if (auditViewports) auditOpts.viewports = auditViewports;
      const result = await audit(url, auditOpts);

      console.log('\nAudit complete!');
      console.log(`  Screenshot: ${result.filepath}`);
      if (result.multiViewport) {
        console.log(`  Viewports:  ${result.viewports?.length || 0} (merged)`);
      }
      if (result.wcag) {
        console.log(`  WCAG:       ${result.wcag.passCount}/${result.wcag.totalElements} pass (score: ${result.wcag.score}%)`);
        if (result.wcag.failCount > 0) {
          console.log(`  Failures:   ${result.wcag.failCount} element(s) below contrast threshold`);
          for (const f of result.wcag.failures) {
            console.log(`    - ${f.selector} (ratio: ${f.contrastRatio}, need: ${f.required})`);
          }
        }
      }

      if (result.design) {
        console.log(`  Design QA:   ${result.design.score}% (${result.design.failCount} issue(s))`);
        if (result.design.failures?.length > 0) {
          for (const d of result.design.failures) {
            console.log(`    - [${d.severity.toUpperCase()}] ${d.selector}: ${d.ruleName} (${d.value}, expected ${d.expected})`);
          }
        }
      }

      const fixSuggestions = generateFixSuggestions(result);
      if (fixSuggestions.length > 0) {
        console.log('\n  \u{1F4CB} Fix Suggestions (deterministic):');
        for (const s of fixSuggestions.slice(0, 10)) {
          console.log(`    [${s.severity.toUpperCase()}] ${s.recommendation}`);
        }
        if (fixSuggestions.length > 10) {
          console.log(`    ... and ${fixSuggestions.length - 10} more`);
        }
      } else {
        console.log('\n  \u{2139}\u{FE0F} No simple fixes available \u2014 consider AI enrichment with --llm-enrich');
      }

      if (doAiPrompt) {
        const wcagFails = result.wcag?.failures || [];
        const designFails = result.design?.failures || [];
        if (wcagFails.length > 0 || designFails.length > 0) {
          const { buildPrompt } = require('@liveviewer/llm');
          const prompt = buildPrompt(wcagFails, 'default', designFails.slice(0, 30), context || undefined);
          console.log('\n' + '='.repeat(50));
          console.log('AI PROMPT');
          console.log('='.repeat(50));
          console.log(prompt);
          console.log('='.repeat(50));
          console.log('END AI PROMPT');
          console.log('='.repeat(50));
        } else {
          console.log('\n  ✓ No failures to analyze.');
        }
      }

      if (llmEnrich) {
        console.log('\n  Enriching with LLM...');
        try {
          const { enrichWithLLM } = require('@liveviewer/llm');
          const llmResult = await enrichWithLLM(result, {
            llmEnrich: true,
            provider: llmProvider,
            model: llmModel,
            apiKey: llmApiKey,
            promptTemplate: 'default',
            cacheTtlDays: llmCacheTtl,
            clearCache: llmClearCache,
            context: context || undefined
          });
          result.llm = llmResult;

          if (llmResult.error) {
            console.warn(`  ⚠ LLM enrichment failed: ${llmResult.error}`);
          } else {
            console.log(`  LLM:        ${llmResult.provider}/${llmResult.model}`);
            console.log(`  Summary:    ${llmResult.summary}`);
            if (llmResult.perFailure?.length > 0) {
              for (const pf of llmResult.perFailure.slice(0, 5)) {
                console.log(`    [${pf.severity.toUpperCase()}] ${pf.selector}: ${pf.suggestion}`);
              }
              if (llmResult.perFailure.length > 5) {
                console.log(`    ... and ${llmResult.perFailure.length - 5} more`);
              }
            }
            if (llmResult.cached) {
              console.log('  (cached)');
            }
          }
        } catch (err) {
          result.llm = { error: err.message, provider: llmProvider, model: llmModel };
          console.warn(`  ⚠ LLM enrichment failed: ${err.message}`);
        }

        // Re-save audit result with LLM data
        const metaPath = `audits/${label}-${result.timestamp}.json`;
        fs.writeFileSync(metaPath, JSON.stringify(result, null, 2));
      }

      const doSarif = hasFlag('--sarif');
      const sarifOutput = parseArg('--sarif-output');
      if (doSarif || sarifOutput) {
        const sarifLog = toSarifLog(result);
        const sarifStr = JSON.stringify(sarifLog, null, 2);
        if (sarifOutput) {
          fs.writeFileSync(sarifOutput, sarifStr, 'utf-8');
          console.log(`\n  SARIF report written to ${sarifOutput}`);
        } else {
          console.log('\n' + sarifStr);
        }
      }

      const failOn = parseArg('--fail-on');
      if (failOn !== null && result.wcag) {
        const threshold = parseInt(failOn, 10);
        if (result.wcag.failCount > threshold) {
          console.error(`WCAG failures (${result.wcag.failCount}) exceed threshold (${threshold})`);
          process.exit(1);
        }
      }
      break;
    }

    case 'extract': {
      const url = process.argv[3];
      if (!url) {
        console.error('Error: URL required. Usage: liveviewer extract <url>');
        process.exit(1);
      }
      const width = parseInt(parseArg('--width') || '1280');
      const height = parseInt(parseArg('--height') || '800');
      const label = parseArg('--label') || 'extract';
      const doStyles = hasFlag('--styles');
      const brandPath = parseArg('--brand');
      const timeout = parseInt(parseArg('--timeout') || '30000');
      const waitUntil = parseArg('--wait-until') || 'networkidle';

      console.log(`Extracting from ${url} at ${width}x${height}...`);
      const result = await extract(url, {
        viewport: { width, height },
        label,
        styles: doStyles,
        timeout,
        waitUntil
      });

      if (brandPath && result.styles) {
        let brandConfig;
        try {
          brandConfig = JSON.parse(fs.readFileSync(brandPath, 'utf-8'));
        } catch (e) {
          console.error(`\nError: Could not read brand config at ${brandPath}`);
          process.exit(1);
        }
        result.violations = checkBrandViolations(result, brandConfig);
        // Re-save with violations included
        const filepath = path.join('extracts', `${label}-${result.timestamp}.json`);
        fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
      }

      console.log('\nExtract complete!');
      if (result.styles) {
        const s = result.styles;
        console.log(`  Colors:       ${Object.keys(s.colors).length} unique`);
        console.log(`  Backgrounds:  ${Object.keys(s.backgrounds).length} unique`);
        console.log(`  Fonts:        ${Object.keys(s.fontFamilies).length} families`);
        console.log(`  Sizes:        ${Object.keys(s.fontSizes).length} unique`);
        console.log(`  Metadata:     extracts/${label}-${result.timestamp}.json`);
        if (result.violations) {
          const v = result.violations;
          if (v.colors.length > 0 || v.fonts.length > 0) {
            console.log('');
            console.log('⚠️  Design system violations:');
            for (const c of v.colors) {
              console.log(`  Color ${c.value} appears ${c.count}x (not in brand palette)`);
            }
            for (const f of v.fonts) {
              console.log(`  Font "${f.value}" appears ${f.count}x (not in approved list)`);
            }
          } else {
            console.log('  ✓ No design system violations');
          }
        }
        console.log('');
        console.log('Top colors:');
        const topColors = Object.entries(s.colors)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10);
        for (const [color, data] of topColors) {
          console.log(`  ${color} (${data.count}x)  e.g. ${data.selectors[0] || ''}`);
        }
      }
      break;
    }

    case 'recommend': {
      const auditPath = process.argv[3];
      if (!auditPath) {
        console.error('Error: Audit JSON path required. Usage: liveviewer recommend <audit-json>');
        process.exit(1);
      }
      const extractPath = parseArg('--extract') || null;
      const format = parseArg('--format') || 'text';
      const htmlOutput = parseArg('--output') || null;

      const result = recommend(auditPath, extractPath);
      if (result.error) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      if (format === 'html') {
        let auditData, extractData;
        try {
          auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
          if (extractPath) {
            extractData = JSON.parse(fs.readFileSync(extractPath, 'utf-8'));
          }
        } catch (e) {
          console.error('Error: Could not read audit or extract files');
          process.exit(1);
        }
        const htmlPath = renderHtml(auditData, { extractData, output: htmlOutput });
        console.log(`HTML report generated: ${htmlPath}`);
      } else if (format === 'markdown') {
        console.log(result.markdown);
      } else {
        console.log(`Recommendations for ${result.url}:`);
        console.log(`  Score: ${result.summary.score}% (${result.summary.totalFailures} failures)`);
        console.log('');
        for (const r of result.recommendations) {
          console.log(`  [${r.severity.toUpperCase()}] ${r.recommendation}`);
        }
      }

      const failOn = parseArg('--fail-on');
      if (failOn !== null) {
        const threshold = parseInt(failOn, 10);
        if (result.summary.totalFailures > threshold) {
          console.error(`WCAG failures (${result.summary.totalFailures}) exceed threshold (${threshold})`);
          process.exit(1);
        }
      }
      break;
    }

    case 'analyze': {
      const tag = process.argv[3];
      if (!tag) {
        console.error('Error: Recording tag required. Usage: liveviewer analyze <tag>');
        process.exit(1);
      }
      const metaPath = `recordings/${tag}.json`;
      let recordingData;
      try {
        recordingData = JSON.parse(require('fs').readFileSync(metaPath, 'utf-8'));
      } catch (e) {
        console.error(`Error: Recording metadata not found at ${metaPath}`);
        process.exit(1);
      }
      const fps = parseInt(parseArg('--fps') || '10');
      const maxFrames = parseInt(parseArg('--max-frames') || '100');
      const threshold = parseFloat(parseArg('--threshold') || '0.1');

      console.log(`Analyzing recording "${tag}" at ${fps}fps...`);
      const analysis = await analyzeRecording(recordingData, { fps, maxFrames, diffThreshold: threshold });
      const report = await generateReport(analysis);
      console.log('\n' + report.report);
      break;
    }

    case 'mcp': {
      console.error('Starting Liveviewer MCP server...');
      startServer();
      break;
    }

    default: {
      console.error(`Unknown command: ${command}`);
      console.error('Run "liveviewer --help" for usage.');
      process.exit(1);
    }
  }
}

function parseArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseJsonArg(name) {
  const val = parseArg(name);
  if (val) {
    try { return JSON.parse(val); } catch (e) { return null; }
  }
  return null;
}

function collectInteractions() {
  const results = [];
  const indices = [];
  process.argv.forEach((arg, i) => {
    if (arg === '--interaction' && i + 1 < process.argv.length) {
      indices.push(i + 1);
    }
  });
  for (const idx of indices) {
    const parsed = parseInteractionString(process.argv[idx]);
    if (parsed) results.push(parsed);
  }
  return results;
}

function parseInteractionString(str) {
  const parts = str.trim().split(/\s+/);
  if (parts.length === 0) return null;
  const type = parts[0].toLowerCase();

  switch (type) {
    case 'click':
    case 'hover':
      if (parts.length < 2) return null;
      return { type, selector: parts.slice(1).join(' ') };
    case 'wait':
      return { type, ms: parseInt(parts[1]) || 500 };
    case 'type':
      if (parts.length < 3) return null;
      return { type, selector: parts[1], text: parts.slice(2).join(' ') };
    case 'scroll':
      return { type, y: parseInt(parts[1]) || 0 };
    case 'screenshot':
      return { type, name: parts[1] || undefined };
    default:
      return null;
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
