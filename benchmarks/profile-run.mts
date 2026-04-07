#!/usr/bin/env tsx
/**
 * profile-run — profile nx commands across scenarios and benchmarks.
 *
 * By default runs all predefined benchmarks, each across four scenarios:
 *   1. daemon-cold    — daemon stopped, no cache
 *   2. daemon-warm    — daemon in-memory cache warm
 *   3. nodaemon-cold  — NX_DAEMON=false, no disk cache
 *   4. nodaemon-warm  — NX_DAEMON=false, disk cache populated
 *
 * Usage
 * ─────
 *   # Run all benchmarks, all scenarios:
 *   pnpm nx profile benchmarks
 *
 *   # Profile a single ad-hoc command (all 4 scenarios):
 *   pnpm nx profile benchmarks -- -- show projects --tui=false
 *
 *   # Single scenario only:
 *   pnpm nx profile benchmarks -- --scenario daemon-warm -- show projects --tui=false
 *
 *   # Single benchmark, all scenarios:
 *   pnpm nx profile benchmarks -- --benchmark show-projects
 *
 * Options
 * ───────
 *   --out <path>          Custom output directory (default: profile-out/<timestamp>)
 *   --no-cpu-prof         Skip V8 CPU sampling
 *   --no-sys-prof         Skip macOS sample / Linux perf
 *   --verbose             Print each performance.measure() to stderr while running
 *   --scenario <name>     Run only one scenario (daemon-cold|daemon-warm|nodaemon-cold|nodaemon-warm)
 *   --benchmark <name>    Run only one predefined benchmark (show-projects|run-many-cat|run-many-copy)
 *
 * Output
 * ──────
 *   profile-out/<timestamp>/
 *     index.md                      — top-level overview + cross-benchmark table
 *     show-projects/
 *       comparison.md               — 4-scenario side-by-side
 *       daemon-cold/
 *         index.md                  — process summary + links
 *         detail/
 *           main-<pid>-spans.md     — JS + native spans table
 *           main-<pid>-cpu.md       — V8 CPU hot spots
 *           main-<pid>-sample.md    — macOS sample hot spots
 *           daemon-<pid>-sample.md
 *           plugin-worker-<pid>-spans.md
 *           plugin-worker-<pid>-sample.md
 *         report.sample.txt         — raw macOS sample output
 *         report.cpuprofile         — raw V8 CPU profile (main)
 *         <pid>_main.json           — raw ProfileReport JSON
 *         <pid>_plugin-worker.json
 *       daemon-warm/  ...
 *       nodaemon-cold/ ...
 *       nodaemon-warm/ ...
 *     run-many-cat/  ...
 *     run-many-copy/ ...
 */

import { spawn, spawnSync, type ChildProcess } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  parseCpuProfile,
  printCpuHotSpots,
  buildCpuMarkdownSection,
} from './perf-cpu-profile.mts';
import {
  parseSampleFile,
  printSampleHotSpots,
  buildSampleMarkdownSection,
} from './perf-sample.mts';
import type {
  ProfileReport,
  ProcessDetailLinks,
} from '../packages/nx/src/utils/perf-report.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScenarioDef {
  name: string;
  label: string;
  daemon: boolean;
  warm: boolean;
}

interface BenchmarkDef {
  name: string;
  label: string;
  nxArgs: string[];
}

interface SamplerEntry {
  proc: ChildProcess;
  path: string;
  pid: number;
  knownRole: string;
  mayDie: boolean;
}

interface ScenarioResult {
  def: ScenarioDef;
  runDir: string;
  reports: ProfileReport[];
  exitStatus: number;
}

// ── Definitions ───────────────────────────────────────────────────────────────

const ALL_SCENARIOS: ScenarioDef[] = [
  { name: 'daemon-cold',   label: 'Daemon — cold',    daemon: true,  warm: false },
  { name: 'daemon-warm',   label: 'Daemon — warm',    daemon: true,  warm: true  },
  { name: 'nodaemon-cold', label: 'No-daemon — cold', daemon: false, warm: false },
  { name: 'nodaemon-warm', label: 'No-daemon — warm', daemon: false, warm: true  },
];

// Predefined benchmarks that map to the hyperfine goals in benchmarks/goals.json.
// "version" is omitted — profiling overhead would dominate a ~20 ms command.
const PREDEFINED_BENCHMARKS: BenchmarkDef[] = [
  { name: 'show-projects',  label: 'show projects',   nxArgs: ['show', 'projects', '--tui=false'] },
  { name: 'run-many-cat',   label: 'run-many (cat)',   nxArgs: ['run-many', '-t', 'cat', '--tui=false'] },
  { name: 'run-many-copy',  label: 'run-many (copy)',  nxArgs: ['run-many', '-t', 'copy', '--tui=false'] },
];

// ── Parse CLI args ────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const doubleDash = rawArgs.indexOf('--');

// If `--` is present, everything after is the nx command (ad-hoc mode).
// If absent, no nx command — run predefined benchmarks.
const scriptArgs = doubleDash >= 0 ? rawArgs.slice(0, doubleDash) : rawArgs;
const adHocNxArgs = doubleDash >= 0 ? rawArgs.slice(doubleDash + 1) : null;

let outPath: string | null = null;
let cpuProf = true;
let sysProf = true;
let verbose = false;
let scenarioFilter: string | null = null;
let benchmarkFilter: string | null = null;

for (let i = 0; i < scriptArgs.length; i++) {
  const a = scriptArgs[i];
  if (a === '--out' && scriptArgs[i + 1])           { outPath = scriptArgs[++i]; }
  else if (a === '--no-cpu-prof')                   { cpuProf = false; }
  else if (a === '--no-sys-prof')                   { sysProf = false; }
  else if (a === '--verbose')                       { verbose = true; }
  else if (a === '--scenario' && scriptArgs[i + 1]) { scenarioFilter = scriptArgs[++i]; }
  else if (a === '--benchmark' && scriptArgs[i + 1]){ benchmarkFilter = scriptArgs[++i]; }
}

// Determine benchmarks to run
let benchmarks: BenchmarkDef[];
if (adHocNxArgs && adHocNxArgs.length > 0) {
  // Ad-hoc command: single custom benchmark
  benchmarks = [{
    name: adHocNxArgs.join('-').replace(/[^a-z0-9-]/gi, '-').slice(0, 40),
    label: adHocNxArgs.join(' '),
    nxArgs: adHocNxArgs,
  }];
} else if (benchmarkFilter) {
  const found = PREDEFINED_BENCHMARKS.find((b) => b.name === benchmarkFilter);
  if (!found) {
    console.error(`Unknown benchmark "${benchmarkFilter}". Valid: ${PREDEFINED_BENCHMARKS.map((b) => b.name).join(', ')}`);
    process.exit(1);
  }
  benchmarks = [found];
} else {
  benchmarks = PREDEFINED_BENCHMARKS;
}

// Determine scenarios to run
const scenarios = scenarioFilter
  ? ALL_SCENARIOS.filter((s) => s.name === scenarioFilter)
  : ALL_SCENARIOS;

if (scenarios.length === 0) {
  console.error(`Unknown scenario "${scenarioFilter}". Valid: ${ALL_SCENARIOS.map((s) => s.name).join(', ')}`);
  process.exit(1);
}

// ── Resolve paths ─────────────────────────────────────────────────────────────

const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
const benchmarksDir = join(repoRoot, 'benchmarks');
const nxBin = join(repoRoot, 'packages', 'nx', 'dist', 'bin', 'nx.js');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const runDir = outPath
  ? resolve(outPath)
  : join(resolve(repoRoot, 'profile-out'), timestamp);
mkdirSync(runDir, { recursive: true });

const daemonProcessJsonPath = join(benchmarksDir, '.nx', 'workspace-data', 'd', 'server-process.json');

// ── Detect system sampler ─────────────────────────────────────────────────────

const platform = process.platform;
const hasSample =
  sysProf &&
  platform === 'darwin' &&
  spawnSync('which', ['sample'], { encoding: 'utf8' }).status === 0;
const hasPerf =
  sysProf &&
  platform === 'linux' &&
  spawnSync('which', ['perf'], { encoding: 'utf8' }).status === 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function waitForExit(proc: ChildProcess): Promise<number> {
  return new Promise((res) => {
    proc.on('exit', (code) => res(code ?? 0));
    proc.on('error', () => res(1));
  });
}

function waitForExitWithTimeout(proc: ChildProcess, timeoutMs: number): Promise<number> {
  return new Promise((res) => {
    let done = false;
    const finish = (code: number) => {
      if (done) return;
      done = true;
      res(code);
    };
    proc.on('exit', (code) => finish(code ?? 0));
    proc.on('error', () => finish(1));
    setTimeout(() => {
      if (done) return;
      try { proc.kill('SIGKILL'); } catch {}
      finish(1);
    }, timeoutMs);
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function readDaemonPid(): number | null {
  if (!existsSync(daemonProcessJsonPath)) return null;
  try {
    const j = JSON.parse(readFileSync(daemonProcessJsonPath, 'utf8'));
    return j.processId ?? null;
  } catch {
    return null;
  }
}

async function waitForDaemon(timeoutMs = 15000): Promise<number | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pid = readDaemonPid();
    if (pid) return pid;
    await waitMs(200);
  }
  return null;
}

function pidFromCpuProfileName(filename: string): number | null {
  const parts = filename.split('.');
  if (parts.length >= 5 && parts[0] === 'CPU') {
    const pid = parseInt(parts[3], 10);
    return Number.isFinite(pid) ? pid : null;
  }
  return null;
}

function slug(role: string, pid: number): string {
  return `${role}-${pid}`;
}

// ── Core: run one nx invocation with full profiling ───────────────────────────

async function runNxWithProfiling(
  def: ScenarioDef,
  nxArgs: string[],
  scenarioRunDir: string
): Promise<ScenarioResult> {
  const detailDir = join(scenarioRunDir, 'detail');
  mkdirSync(detailDir, { recursive: true });

  const cpuProfPath = join(scenarioRunDir, 'report.cpuprofile');
  const sysProfilePath = platform === 'darwin'
    ? join(scenarioRunDir, 'report.sample.txt')
    : join(scenarioRunDir, 'report.perf.data');

  // ── Build env ────────────────────────────────────────────────────────────────
  const existingNodeOptions = (process.env.NODE_OPTIONS ?? '').trim();
  const workerCpuProfOptions = cpuProf
    ? `--cpu-prof --cpu-prof-dir=${scenarioRunDir}` : '';

  // NX_PROFILE_OUT points to index.md — its dirname is used as the runDir for
  // per-process JSON files.
  const indexPath = join(scenarioRunDir, 'index.md');

  const scenarioEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NX_NO_CLOUD: 'true',
    NX_PROFILE_OUT: indexPath,
    NX_NATIVE_PROFILE: '1',
    NODE_OPTIONS: [existingNodeOptions, workerCpuProfOptions].filter(Boolean).join(' '),
    ...(verbose ? { NX_PERF_LOGGING: 'true' } : {}),
    ...(def.daemon ? {} : { NX_DAEMON: 'false' }),
  };

  const nodeArgs: string[] = cpuProf
    ? [`--cpu-prof`, `--cpu-prof-dir=${scenarioRunDir}`, `--cpu-prof-name=report.cpuprofile`]
    : [];

  // ── Sampler state (local to this invocation) ─────────────────────────────────
  const samplerRegistry: SamplerEntry[] = [];
  const sampledPids = new Set<number>();

  function startSampleForPid(pid: number, path: string, mayDie: boolean, knownRole = 'unknown'): void {
    if (sampledPids.has(pid)) return;
    sampledPids.add(pid);
    const sArgs = [String(pid), '3600', '-f', path];
    if (mayDie) sArgs.push('-mayDie');
    const proc = spawn('sample', sArgs, { stdio: 'ignore' });
    samplerRegistry.push({ proc, path, pid, knownRole, mayDie });
  }

  // ── Spawn nx ─────────────────────────────────────────────────────────────────
  const nxProc = spawn(
    process.execPath,
    [...nodeArgs, nxBin, ...nxArgs],
    { env: scenarioEnv, stdio: 'inherit', cwd: benchmarksDir }
  );

  // ── Start samplers ────────────────────────────────────────────────────────────
  if (hasSample) {
    startSampleForPid(nxProc.pid!, sysProfilePath, true, 'main');

    if (def.daemon) {
      (async () => {
        const daemonPid = await waitForDaemon(15000);
        if (daemonPid && !sampledPids.has(daemonPid)) {
          const p = join(scenarioRunDir, `${daemonPid}_daemon.sample.txt`);
          startSampleForPid(daemonPid, p, false, 'daemon');
          console.log(`  [${def.name}] sample: daemon pid ${daemonPid}`);
        }
      })();
    }
  } else if (hasPerf) {
    const proc = spawn('perf', ['record', '-g', '-p', String(nxProc.pid!), '-o', sysProfilePath], { stdio: 'ignore' });
    samplerRegistry.push({ proc, path: sysProfilePath, pid: nxProc.pid!, knownRole: 'main', mayDie: false });
    sampledPids.add(nxProc.pid!);
  }

  // Poll for plugin worker children
  let stopPolling = false;
  if (hasSample) {
    sampledPids.add(nxProc.pid!);
    (async () => {
      while (!stopPolling) {
        try {
          const r = spawnSync('pgrep', ['-P', String(nxProc.pid!)], { encoding: 'utf8' });
          if (r.status === 0 && r.stdout?.trim()) {
            for (const line of r.stdout.trim().split('\n')) {
              const childPid = parseInt(line, 10);
              if (childPid && !sampledPids.has(childPid)) {
                const p = join(scenarioRunDir, `${childPid}_worker.sample.txt`);
                startSampleForPid(childPid, p, true, 'plugin-worker');
              }
            }
          }
        } catch {}
        await waitMs(150);
      }
    })();
  }

  // ── Wait for nx ──────────────────────────────────────────────────────────────
  const exitStatus = await waitForExit(nxProc);
  stopPolling = true;

  for (const entry of samplerRegistry) {
    if (!entry.mayDie) entry.proc.kill('SIGINT');
  }
  await Promise.all(samplerRegistry.map((e) => waitForExitWithTimeout(e.proc, 5000).catch(() => {})));

  // ── Collect per-PID JSON files ────────────────────────────────────────────────
  const pidJsonPattern = /^\d+_(main|plugin-worker|task-worker|daemon)\.json$/;
  const reports: ProfileReport[] = [];
  for (const file of readdirSync(scenarioRunDir).filter((f) => pidJsonPattern.test(f))) {
    try {
      reports.push(JSON.parse(readFileSync(join(scenarioRunDir, file), 'utf8')) as ProfileReport);
    } catch {}
  }

  // ── Build pid→role map (JSON reports + sampler hints) ─────────────────────────
  const pidToRole = new Map<number, string>(samplerRegistry.map((e) => [e.pid, e.knownRole]));
  for (const r of reports) pidToRole.set(r.pid, r.role);

  // ── Build V8 CPU sections & detail files ──────────────────────────────────────
  const cpuProfileByPid = new Map<number, string>();
  if (cpuProf) {
    if (existsSync(cpuProfPath)) {
      const main = reports.find((r) => r.role === 'main');
      if (main) cpuProfileByPid.set(main.pid, cpuProfPath);
    }
    for (const file of readdirSync(scenarioRunDir)) {
      if (!file.startsWith('CPU.') || !file.endsWith('.cpuprofile')) continue;
      const pid = pidFromCpuProfileName(file);
      if (pid !== null) cpuProfileByPid.set(pid, join(scenarioRunDir, file));
    }
  }

  // Load perf-report exports
  type PerfReport = typeof import('../packages/nx/src/utils/perf-report.js');
  const perfReportMod = await import(join(repoRoot, 'packages', 'nx', 'dist', 'src', 'utils', 'perf-report.js')) as unknown as PerfReport;
  const { buildScenarioIndexMarkdown, buildSpansSection, buildTotalsSection } = perfReportMod;

  const mainReport = reports.find((r) => r.role === 'main');
  const mainJsTotal = mainReport?.wallClockMs ?? 0;

  // ── Print terminal summary ────────────────────────────────────────────────────
  if (mainReport) {
    const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(1)}ms`;
    const top = mainReport.entries.slice(0, 8);
    console.log(`\n── [${def.label}] ─────────────────────────────────────────────`);
    for (const e of top) {
      const bar = '█'.repeat(Math.min(28, Math.round((e.durationMs / top[0].durationMs) * 28)));
      console.log(`  ${e.name.padEnd(43)} ${fmtMs(e.durationMs).padStart(9)}  ${bar}`);
    }
    console.log(
      `  Wall-clock: ${fmtMs(mainReport.wallClockMs)}` +
      (mainReport.gc ? `  GC: ${fmtMs(mainReport.gc.totalMs)}` : '') +
      (mainReport.eventLoopDelay ? `  ELD p99: ${fmtMs(mainReport.eventLoopDelay.p99Ms)}` : '')
    );
    console.log('─────────────────────────────────────────────────────────────\n');
  }

  // ── Write per-process detail files ───────────────────────────────────────────
  const detailLinks = new Map<number, ProcessDetailLinks>();

  const roleOrder = ['main', 'plugin-worker', 'task-worker', 'daemon'];
  const sortedReports = [...reports].sort(
    (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)
  );

  for (const r of sortedReports) {
    const s = slug(r.role, r.pid);
    const links: ProcessDetailLinks = {};

    // Spans file
    const spansFile = `detail/${s}-spans.md`;
    const spansContent = [
      `# Spans — ${r.role} (pid ${r.pid})`,
      '',
      buildTotalsSection(r),
      '',
      `## Spans ≥ 1 ms (slowest first)`,
      '',
      `_% relative to main JS wall-clock (${mainJsTotal.toFixed(1)} ms). Nested spans both appear — parents may exceed 100%._`,
      '',
      buildSpansSection(r, mainJsTotal, 120),
    ].join('\n');
    writeFileSync(join(scenarioRunDir, spansFile), spansContent);
    links.spansFile = spansFile;

    // CPU file
    if (cpuProfileByPid.has(r.pid)) {
      const spots = parseCpuProfile(cpuProfileByPid.get(r.pid)!, repoRoot);
      if (spots.length > 0) {
        const cpuFile = `detail/${s}-cpu.md`;
        const cpuContent = [
          `# V8 CPU Hot Spots — ${r.role} (pid ${r.pid})`,
          '',
          buildCpuMarkdownSection(spots, 40),
        ].join('\n');
        writeFileSync(join(scenarioRunDir, cpuFile), cpuContent);
        links.cpuFile = cpuFile;

        // Print to terminal for main only
        if (r.role === 'main') {
          console.log(`── [${def.label}] CPU hot spots ─────────────────────────────────`);
          printCpuHotSpots(spots, 12);
          console.log('─────────────────────────────────────────────────────────────\n');
        }
      }
    }

    detailLinks.set(r.pid, links);
  }

  // ── Write macOS sample detail files ──────────────────────────────────────────
  if (hasSample) {
    const orderedSamplers = [
      ...samplerRegistry.filter((e) => e.knownRole === 'main'),
      ...samplerRegistry.filter((e) => e.knownRole === 'daemon'),
      ...samplerRegistry.filter((e) => e.knownRole !== 'main' && e.knownRole !== 'daemon'),
    ];

    for (const entry of orderedSamplers) {
      if (!existsSync(entry.path)) continue;
      const role = pidToRole.get(entry.pid) ?? entry.knownRole;
      const sr = parseSampleFile(entry.path);
      if (!sr.hotSpots.length) continue;

      const sampleFile = `detail/${slug(role, entry.pid)}-sample.md`;
      writeFileSync(
        join(scenarioRunDir, sampleFile),
        `# System Profile — ${role} (pid ${entry.pid})\n\n` +
        buildSampleMarkdownSection(sr, 40, entry.pid, role)
      );

      // Update detailLinks for JSON-matched processes
      const existingLinks = detailLinks.get(entry.pid);
      if (existingLinks) {
        existingLinks.sampleFile = sampleFile;
      } else {
        detailLinks.set(entry.pid, { sampleFile });
      }

      console.log(`  [${def.name}] sample: ${role} pid ${entry.pid} — ${sr.hotSpots.length} fn, ${sr.totalSamples} samples`);

      // Print terminal hot spots for main process only
      if (role === 'main') {
        console.log(`── [${def.label}] system hot spots ──────────────────────────────`);
        printSampleHotSpots(sr, 12);
        console.log('─────────────────────────────────────────────────────────────\n');
      }
    }
  } else if (hasPerf && existsSync(sysProfilePath)) {
    appendPerfToFile(sysProfilePath, join(detailDir, `main-${mainReport?.pid ?? 0}-perf.md`));
  }

  // ── Write scenario index.md ───────────────────────────────────────────────────
  const indexContent = buildScenarioIndexMarkdown(
    `${def.label} — \`${nxArgs.join(' ')}\``,
    reports,
    detailLinks
  );
  writeFileSync(indexPath, indexContent);

  console.log(`  [${def.name}] → ${scenarioRunDir}/\n`);
  return { def, runDir: scenarioRunDir, reports, exitStatus };
}

function appendPerfToFile(perfData: string, outFile: string): void {
  const result = spawnSync(
    'perf',
    ['report', '--stdio', '-i', perfData, '--max-stack=6', '--percent-limit=0.5', '--no-children'],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  if (result.status !== 0 || !result.stdout?.trim()) return;
  const lines = result.stdout.split('\n').slice(0, 300);
  writeFileSync(outFile,
    `# System Profile (Linux \`perf\`)\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`
  );
}

// ── Scenario comparison report ────────────────────────────────────────────────

const KEY_SPANS = [
  'createProjectGraphAsync',
  'REQUEST_PROJECT_GRAPH round trip',
  'retrieve-project-configurations',
  'code-loading',
  'task-execution',
];

function buildScenarioComparisonMarkdown(benchLabel: string, benchNxArgs: string[], results: ScenarioResult[]): string {
  const fmtMs = (ms: number | undefined) =>
    ms == null ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;

  const presentSpans = KEY_SPANS.filter((span) =>
    results.some((r) => r.reports.find((rep) => rep.role === 'main')?.entries.some((e) => e.name === span))
  );

  const colHeaders = ['Scenario', 'JS wall-clock', ...presentSpans, 'GC', 'ELD p99', 'Workers'];
  const rows = results.map((r) => {
    const main = r.reports.find((rep) => rep.role === 'main');
    if (!main) return null;
    const spanMs = (name: string) => {
      const e = main.entries.find((en) => en.name === name);
      return fmtMs(e?.durationMs);
    };
    const workerCount = r.reports.filter((rep) => rep.role !== 'main').length;
    return [
      `[${r.def.label}](./${r.def.name}/index.md)`,
      fmtMs(main.wallClockMs),
      ...presentSpans.map(spanMs),
      fmtMs(main.gc?.totalMs),
      fmtMs(main.eventLoopDelay?.p99Ms),
      workerCount > 0 ? String(workerCount) : '—',
    ];
  }).filter((r): r is string[] => r !== null);

  const colWidths = colHeaders.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length))
  );
  const fmt = (row: string[]) =>
    '| ' + row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ') + ' |';
  const sep = colWidths.map((w) => '-'.repeat(w));

  return [
    `# ${benchLabel} — Scenario Comparison`,
    '',
    `**Command:** \`${benchNxArgs.join(' ')}\``,
    '',
    fmt(colHeaders),
    fmt(sep),
    ...rows.map(fmt),
    '',
    '> **JS wall-clock** = union of instrumented span intervals (nested spans counted once).',
    '> **Workers** = plugin-worker + task-worker processes that wrote profiling data.',
  ].join('\n');
}

// ── Top-level index ───────────────────────────────────────────────────────────

function buildTopLevelIndex(
  allBenchmarkResults: Array<{ bench: BenchmarkDef; results: ScenarioResult[] }>
): string {
  const fmtMs = (ms: number | undefined) =>
    ms == null ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;

  const scenarioNames = scenarios.map((s) => s.name);

  // Build a cross-benchmark × scenario summary table
  const colHeaders = ['Benchmark', ...scenarioNames.map((s) => s.replace('daemon-', 'D-').replace('nodaemon-', 'ND-'))];
  const rows = allBenchmarkResults.map(({ bench, results }) => {
    const cells = scenarioNames.map((sName) => {
      const r = results.find((res) => res.def.name === sName);
      const main = r?.reports.find((rep) => rep.role === 'main');
      return fmtMs(main?.wallClockMs);
    });
    return [`[${bench.label}](./${bench.name}/comparison.md)`, ...cells];
  });

  const colWidths = colHeaders.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length))
  );
  const fmt = (row: string[]) =>
    '| ' + row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ') + ' |';
  const sep = colWidths.map((w) => '-'.repeat(w));

  return [
    `# Nx Performance Profile — ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## JS wall-clock by benchmark × scenario',
    '',
    '_D = daemon, ND = no-daemon_',
    '',
    fmt(colHeaders),
    fmt(sep),
    ...rows.map(fmt),
    '',
    '## Benchmarks',
    '',
    ...allBenchmarkResults.map(({ bench }) =>
      `- [${bench.label}](./${bench.name}/comparison.md) — \`nx ${bench.nxArgs.join(' ')}\``
    ),
    '',
  ].join('\n');
}

// ── Orchestration ─────────────────────────────────────────────────────────────

console.log(`[profile] output    → ${runDir}/`);
console.log(`[profile] benchmarks: ${benchmarks.map((b) => b.name).join(', ')}`);
console.log(`[profile] scenarios : ${scenarios.map((s) => s.name).join(', ')}`);
if (cpuProf)   console.log(`[profile] v8 cpu    : V8 sampling → *.cpuprofile`);
if (hasSample) console.log(`[profile] sample    : macOS sampler → main + daemon + workers`);
if (hasPerf)   console.log(`[profile] perf      : Linux perf record`);
console.log('');

const allBenchmarkResults: Array<{ bench: BenchmarkDef; results: ScenarioResult[] }> = [];

for (const bench of benchmarks) {
  const benchRunDir = benchmarks.length > 1 ? join(runDir, bench.name) : runDir;
  mkdirSync(benchRunDir, { recursive: true });

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  BENCHMARK: ${bench.label}  (nx ${bench.nxArgs.join(' ')})`);
  console.log(`${'═'.repeat(60)}\n`);

  const benchResults: ScenarioResult[] = [];

  for (const def of scenarios) {
    const scenarioRunDir = join(benchRunDir, def.name);
    mkdirSync(scenarioRunDir, { recursive: true });

    // Setup
    if (!def.warm) {
      process.stdout.write(`  [${def.name}] setup: nx reset… `);
      spawnSync(process.execPath, [nxBin, 'reset'], { cwd: benchmarksDir, stdio: 'ignore' });
      process.stdout.write(`done\n`);
    } else {
      console.log(`  [${def.name}] setup: warm (reusing state from previous scenario)`);
    }

    const result = await runNxWithProfiling(def, bench.nxArgs, scenarioRunDir);
    benchResults.push(result);

    if (def !== scenarios[scenarios.length - 1]) await waitMs(300);
  }

  allBenchmarkResults.push({ bench, results: benchResults });

  // Write benchmark-level comparison.md
  const compMd = buildScenarioComparisonMarkdown(bench.label, bench.nxArgs, benchResults);
  writeFileSync(join(benchRunDir, 'comparison.md'), compMd);
  console.log(`  → ${benchRunDir}/comparison.md`);
}

// ── Top-level index ───────────────────────────────────────────────────────────

if (benchmarks.length > 1) {
  writeFileSync(join(runDir, 'index.md'), buildTopLevelIndex(allBenchmarkResults));
  console.log(`\n[profile] top-level index → ${runDir}/index.md`);
}

console.log(`[profile] done → ${runDir}/`);
process.exit(allBenchmarkResults[allBenchmarkResults.length - 1]?.results.at(-1)?.exitStatus ?? 0);
