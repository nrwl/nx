/**
 * Reads hyperfine JSON results and compares against:
 * - goals.json (committed) — target times the team agrees on
 * - baseline.json (gitignored) — local per-machine baseline for personal comparison
 *
 * Run with --set-baseline to save current results as the new local baseline.
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

interface Goals {
  [name: string]: { max: number };
}

const rootDir = __dirname;
const baselinePath = join(rootDir, 'baseline.json');
const goalsPath = join(rootDir, 'goals.json');

const colors = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function loadResult(name: string): HyperfineResult | null {
  const file = join(rootDir, `results-${name}.json`);
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8'));
    return raw.results[0];
  } catch {
    return null;
  }
}

function formatMs(seconds: number): string {
  const ms = seconds * 1000;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(0)}ms`;
}

function formatDelta(current: number, baseline: number): string {
  const pct = ((current - baseline) / baseline) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

function main() {
  const updateBaseline = process.argv.includes('--set-baseline');

  // Load goals (committed)
  let goals: Goals = {};
  if (existsSync(goalsPath)) {
    goals = JSON.parse(readFileSync(goalsPath, 'utf-8'));
  }

  // Auto-set baseline on first run, or when explicitly requested
  const firstRun = !existsSync(baselinePath);
  if (updateBaseline || firstRun) {
    const benchmarkNames = [
      'version',
      'show-projects',
      'cat-warm',
      'copy-warm',
      'build-warm',
    ];
    const newBaseline: Baseline = {};
    for (const name of benchmarkNames) {
      const result = loadResult(name);
      if (result) newBaseline[name] = { mean: result.mean };
    }
    if (Object.keys(newBaseline).length > 0) {
      writeFileSync(baselinePath, JSON.stringify(newBaseline, null, 2) + '\n');
      if (firstRun) {
        console.log(
          colors.green(`First run — baseline saved: ${baselinePath}\n`)
        );
      } else {
        console.log(colors.green(`Baseline updated: ${baselinePath}\n`));
      }
    }
  }

  // Load baseline (local, gitignored)
  let baseline: Baseline = {};
  if (existsSync(baselinePath)) {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
  }

  const benchmarkNames = [
    'version',
    'show-projects',
    'cat-warm',
    'copy-warm',
    'build-warm',
  ];

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
  const col = { name: 16, time: 10 };

  const header = [
    colors.bold('Benchmark'.padEnd(col.name)),
    colors.dim('Goal'.padStart(col.time)),
    colors.dim('Baseline'.padStart(col.time)),
    colors.bold('Current'),
  ].join('  ');
  console.log(header);
  console.log(colors.dim('─'.repeat(col.name + col.time * 2 + 40)));

  for (const name of benchmarkNames) {
    const result = results[name];
    if (!result) continue;

    const goal = goals[name];
    const base = baseline[name];

    // Build colored deltas: (goalDelta | baselineDelta)
    const deltas: string[] = [];

    if (goal) {
      const raw = formatDelta(result.mean, goal.max);
      deltas.push(
        result.mean <= goal.max ? colors.green(raw) : colors.red(raw)
      );
    }

    if (base) {
      const raw = formatDelta(result.mean, base.mean);
      const ratio = (result.mean - base.mean) / base.mean;
      const colorFn =
        ratio < -0.1 ? colors.green : ratio > 0.1 ? colors.red : colors.dim;
      deltas.push(colorFn(raw));
    }

    const deltaSuffix =
      deltas.length > 0 ? ` (${deltas.join(colors.dim(' | '))})` : '';

    console.log(
      [
        colors.cyan(name.padEnd(col.name)),
        colors.dim((goal ? formatMs(goal.max) : '—').padStart(col.time)),
        colors.dim((base ? formatMs(base.mean) : '—').padStart(col.time)),
        `${formatMs(result.mean)}${deltaSuffix}`,
      ].join('  ')
    );
  }

  console.log('');

  // Update baseline if requested
  if (!updateBaseline && !process.env.CI) {
    console.log(colors.dim('To update baseline: pnpm bench -- --set-baseline'));
    console.log('');
  }
}

main();
