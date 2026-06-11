import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const cliBin = path.resolve(root, 'packages/cli/bin/liveviewer.js');
const auditsDir = path.resolve(root, 'audits');

function run(cmd, args, opts = {}) {
  const label = `${cmd} ${args.join(' ')}`.slice(0, 100);
  console.log(`> ${label}`);
  const result = spawnSync(cmd, args, { cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, ...opts });
  if (result.error) throw new Error(`Command failed: ${result.error.message}`);
  if (result.status !== 0 && result.status !== null) throw new Error(`Exit ${result.status}: ${result.stderr?.slice(0, 500)}`);
  if (result.stdout) {
    const lines = result.stdout.split('\n').filter(l => l.trim()).slice(0, 20);
    console.log(lines.map(l => `  ${l}`).join('\n'));
    if (result.stdout.split('\n').length > 20) console.log(`  ... (${result.stdout.split('\n').length} total lines)`);
  }
  return result.stdout || '';
}

function latestAuditFile(prefix) {
  if (!fs.existsSync(auditsDir)) return null;
  const files = fs.readdirSync(auditsDir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(auditsDir, files[0]) : null;
}

function main() {
  console.log('=== Liveviewer CLI Crawling Test ===\n');
  let exitCode = 0;

  // 1. Help text check
  console.log('1. Checking help text for crawl flags...');
  const help = run('node', [cliBin, '--help']);
  const crawlFlags = ['--crawl', '--max-pages', '--depth', '--concurrency', '--delay', '--no-cache', '--cache-dir', '--cache-ttl'];
  for (const flag of crawlFlags) {
    if (!help.includes(flag)) {
      console.error(`   ❌ Missing help flag: ${flag}`);
      exitCode = 1;
    }
  }
  if (exitCode === 0) console.log('   ✅ All crawl flags present in help\n');

  // 2. Run crawl
  console.log('2. Running crawl on https://example.com (max 1 page, depth 0)...');
  if (!fs.existsSync(auditsDir)) fs.mkdirSync(auditsDir, { recursive: true });
  const before = new Set(fs.readdirSync(auditsDir).filter(f => f.startsWith('crawl-') && f.endsWith('.json')));
  run('node', [cliBin, 'audit', 'https://example.com', '--crawl', '--max-pages', '1', '--depth', '0', '--no-cache', '--wcag']);
  const after = fs.readdirSync(auditsDir).filter(f => f.startsWith('crawl-') && f.endsWith('.json'));
  const newFiles = after.filter(f => !before.has(f));
  if (newFiles.length === 0) {
    console.error('   ❌ No crawl output file created in audits/');
    exitCode = 1;
  } else {
    const outFile = path.join(auditsDir, newFiles[0]);
    const result = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
    if (!result.summary) {
      console.error('   ❌ Missing summary in output');
      exitCode = 1;
    } else if (!result.pages || result.pages.length < 1) {
      console.error('   ❌ No pages in result');
      exitCode = 1;
    } else {
      console.log(`   ✅ Crawl produced ${result.pages.length} pages`);
      console.log(`   ✅ Avg WCAG: ${result.summary.averageWcagScore}%`);
    }
    fs.unlinkSync(outFile);
  }

  // 3. Version check
  console.log('\n3. Checking CLI version...');
  const version = run('node', [cliBin, '--version']);
  if (!version.match(/^\d+\.\d+\.\d+/)) {
    console.error(`   ❌ Unexpected version: ${version}`);
    exitCode = 1;
  } else {
    console.log(`   ✅ Version: ${version.trim()}`);
  }

  if (exitCode === 0) {
    console.log('\n=== All crawl tests passed ===');
  } else {
    console.log(`\n=== Tests failed (${exitCode} error(s)) ===`);
  }
  process.exit(exitCode);
}

main();
