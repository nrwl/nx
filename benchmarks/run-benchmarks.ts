/**
 * Reads hyperfine JSON results and compares against a committed baseline.
 * Run with --update-baseline to save current results as the new baseline.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface HyperfineResult {
  command: string;
  mean: number;
  stddev: number;
  min: number;
  max: number;
}

interface Baseline {
  [name: string]: { mean: number };
}

const benchmarkNames = ['version', 'show-projects', 'lint-warm', 'build-warm'];

const rootDir = __dirname;
const baselinePath = join(rootDir, 'baseline.json');

function loadResult(name: string): HyperfineResult | null {
  const file = join(rootDir, `results-${name}.json`);
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  return raw.results[0];
}

function formatMs(seconds: number): string {
  const ms = seconds * 1000;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(0)}ms`;
}

const colors = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function formatDelta(current: number, baseline: number): string {
  const pct = ((current - baseline) / baseline) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

function main() {
  const updateBaseline = process.argv.includes('--update-baseline');

  // Load baseline
  let baseline: Baseline = {};
  if (existsSync(baselinePath)) {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
  }

  // Collect results
  const results: Record<string, HyperfineResult> = {};
  for (const name of benchmarkNames) {
    const result = loadResult(name);
    if (result) results[name] = result;
  }

  if (Object.keys(results).length === 0) {
    console.error(
      'No benchmark results found. Run individual benchmarks first.'
    );
    process.exit(1);
  }

  // Display results
  console.log('');
  const nameWidth = 20;
  const colWidth = 12;
  const header = [
    colors.bold('Benchmark'.padEnd(nameWidth)),
    colors.dim('Baseline'.padStart(colWidth)),
    colors.bold('Current'.padStart(colWidth)),
    colors.bold('Delta'.padStart(colWidth)),
    '',
  ].join('  ');
  console.log(header);
  console.log(colors.dim('─'.repeat(nameWidth + colWidth * 3 + 16)));

  for (const name of benchmarkNames) {
    const result = results[name];
    if (!result) continue;

    const base = baseline[name];
    const current = formatMs(result.mean);

    let baseStr = '—';
    let deltaStr = '';

    if (base) {
      baseStr = formatMs(base.mean);
      const delta = (result.mean - base.mean) / base.mean;
      deltaStr = formatDelta(result.mean, base.mean);

      let colorDelta: (s: string) => string = colors.dim;
      if (delta < -0.1) {
        colorDelta = colors.green;
      } else if (delta > 0.1) {
        colorDelta = colors.red;
      }
      deltaStr = colorDelta(deltaStr.padStart(colWidth));
    }

    console.log(
      [
        colors.cyan(name.padEnd(nameWidth)),
        colors.dim(baseStr.padStart(colWidth)),
        current.padStart(colWidth),
        deltaStr ? deltaStr : ' '.repeat(colWidth),
      ].join('  ')
    );
  }

  console.log('');

  // Update baseline if requested
  if (updateBaseline) {
    const newBaseline: Baseline = { ...baseline };
    for (const [name, result] of Object.entries(results)) {
      newBaseline[name] = { mean: result.mean };
    }
    writeFileSync(baselinePath, JSON.stringify(newBaseline, null, 2) + '\n');
    console.log(colors.green(`Baseline updated: ${baselinePath}`));
  }
}

main();
