import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

console.log('╔' + '═'.repeat(58) + '╗');
console.log('║  Liveviewer — Full Benchmark Suite              ║');
console.log('╚' + '═'.repeat(58) + '╝');
console.log();

async function runBenchmark(label, script, args = []) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  [${label}]`);
  console.log(`${'─'.repeat(60)}\n`);

  const result = spawnSync('node', [script, ...args], {
    cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 600000,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  const out = (result.stdout || '') + (result.stderr || '');
  console.log(out);

  if (result.error) {
    console.error(`  ⚠ Benchmark "${label}" failed: ${result.error.message}`);
    return false;
  }
  return true;
}

const benchmarks = [
  ['Contrast (W3C ACT afw4f7)', 'scripts/benchmark.mjs'],
  ['Design QA (internal fixtures)', 'scripts/benchmark-design.js'],
  ['Accessibility + Design (vs axe-core)', 'scripts/benchmark-accessibility.js'],
];

let allPassed = true;
for (const [label, script] of benchmarks) {
  const ok = await runBenchmark(label, path.resolve(root, script));
  if (!ok) allPassed = false;
}

console.log('\n' + '='.repeat(60));
console.log(allPassed ? '  ALL BENCHMARKS PASSED' : '  SOME BENCHMARKS FAILED');
console.log('='.repeat(60));
process.exit(allPassed ? 0 : 1);
