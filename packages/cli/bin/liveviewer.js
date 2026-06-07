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
  --fail-on <n>       Exit non-zero if WCAG failures exceed n (for CI)
  --timeout <ms>      Navigation timeout (default: 30000)
  --wait-until <str>  Navigation wait strategy: networkidle (default), load, domcontentloaded

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
  const { recommend } = require('@liveviewer/core/src/recommender');
  const { renderHtml } = require('@liveviewer/core/src/report');

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
      const timeout = parseInt(parseArg('--timeout') || '30000');
      const waitUntil = parseArg('--wait-until') || 'networkidle';

      console.log(`Auditing ${url} at ${width}x${height}...`);
      const result = await audit(url, {
        viewport: { width, height },
        label,
        wcag: doWcag,
        timeout,
        waitUntil
      });

      console.log('\nAudit complete!');
      console.log(`  Screenshot: ${result.filepath}`);
      if (result.wcag) {
        console.log(`  WCAG:       ${result.wcag.passCount}/${result.wcag.totalElements} pass (score: ${result.wcag.score}%)`);
        if (result.wcag.failCount > 0) {
          console.log(`  Failures:   ${result.wcag.failCount} element(s) below contrast threshold`);
          for (const f of result.wcag.failures) {
            console.log(`    - ${f.selector} (ratio: ${f.contrastRatio}, need: ${f.required})`);
          }
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
