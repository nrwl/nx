/**
 * Markdown report builders for the per-process profiles that nx writes when
 * `NX_PROFILE_OUT` is set. `profile-run.mts` reads every `<pid>_<role>.json`
 * in a run directory and renders them with these.
 */
import * as md from 'markdown-factory';
import perfReport, {
  type ProcessRole,
  type ProfileEntry,
  type ProfileReport,
} from '../packages/nx/src/utils/perf-report.js';

const { computeWallClockMs } = perfReport;

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(1)}ms`;
}

function pct(part: number, total: number): string {
  if (total === 0) return '—';
  return `${((part / total) * 100).toFixed(1)}%`;
}

/** Extract a human-readable label from a process's command string. */
function shortCommand(role: ProcessRole, command: string): string {
  if (role === 'plugin-worker') {
    // command is "<socket-path> <plugin-name> <plugin-script-path> <0|1>"
    // (see startPluginWorker in isolated-plugin.ts), e.g.
    // "/tmp/plugin5122-0.sock @nx/js /path/to/nx/dist/src/plugins/js 0"
    const parts = command.trim().split(/\s+/);
    const scriptPath = parts[2] ?? parts[0];
    // Extract the meaningful part after the last src/ segment
    const srcMatch = scriptPath.match(/src\/(.+)$/);
    return srcMatch ? srcMatch[1] : (scriptPath.split('/').pop() ?? command);
  }
  return command;
}

// ── Section builders ──────────────────────────────────────────────────────────

/**
 * Aggregate spans by (name, source), computing the interval union per group
 * for JS spans that have startTime. Spans running concurrently (e.g. 1110
 * task-execution spans) will show the wall-clock window during which at least
 * one instance was active — not the inflated arithmetic sum.
 */
function aggregateSpans(entries: ProfileEntry[]): Array<{
  name: string;
  source: 'js' | 'native';
  count: number;
  /** Union of span intervals — actual wall-clock covered by this span type. */
  wallClockMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}> {
  type Agg = {
    name: string;
    source: 'js' | 'native';
    count: number;
    intervals: Array<[number, number]>; // [start, end] pairs for union calc
    sumMs: number;
    minMs: number;
    maxMs: number;
  };

  const map = new Map<string, Agg>();
  for (const e of entries) {
    if (e.durationMs < 1) continue;
    const key = `${e.source}|${e.name}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        name: e.name,
        source: e.source,
        count: 0,
        intervals: [],
        sumMs: 0,
        minMs: Infinity,
        maxMs: -Infinity,
      };
      map.set(key, agg);
    }
    agg.count++;
    agg.sumMs += e.durationMs;
    agg.minMs = Math.min(agg.minMs, e.durationMs);
    agg.maxMs = Math.max(agg.maxMs, e.durationMs);
    if (e.startTime != null) {
      agg.intervals.push([e.startTime, e.startTime + e.durationMs]);
    }
  }

  return [...map.values()]
    .map((agg) => ({
      name: agg.name,
      source: agg.source,
      count: agg.count,
      wallClockMs:
        agg.intervals.length > 0
          ? computeWallClockMs(
              agg.intervals.map(([s, e]) => ({ startTime: s, duration: e - s }))
            )
          : agg.sumMs, // native spans: no startTime, fall back to sum
      avgMs: agg.sumMs / agg.count,
      minMs: agg.minMs,
      maxMs: agg.maxMs,
    }))
    .sort((a, b) => b.wallClockMs - a.wallClockMs);
}

/** Build the spans table for one process, capped at `maxRows`. */
export function buildSpansSection(
  report: ProfileReport,
  jsRefTotal: number,
  maxRows = 60
): string {
  const aggregated = aggregateSpans(report.entries);

  if (aggregated.length === 0) return md.italics('No spans ≥ 1 ms recorded.');

  const rows = aggregated.slice(0, maxRows).map((e) => ({
    name: e.name,
    count: e.count > 1 ? `×${e.count}` : '',
    wallClock: fmtMs(e.wallClockMs),
    avg: e.count > 1 ? fmtMs(e.avgMs) : '—',
    pctOfJs: pct(e.wallClockMs, jsRefTotal),
    source: e.source,
  }));

  const truncNote =
    aggregated.length > maxRows
      ? `\n\n${md.italics(`Showing ${maxRows} of ${aggregated.length} unique spans — see ${md.code(`${report.pid}_${report.role}.json`)} for the full list.`)}`
      : '';

  return (
    md.table(rows, [
      { label: 'Span name', mapFn: (r) => r.name },
      { label: '×N', mapFn: (r) => r.count },
      { label: 'Wall-clock', mapFn: (r) => r.wallClock },
      { label: 'Avg/call', mapFn: (r) => r.avg },
      { label: '% of JS ref', mapFn: (r) => r.pctOfJs },
      { label: 'Source', mapFn: (r) => r.source },
    ]) + truncNote
  );
}

/** Build the totals table for one process. */
export function buildTotalsSection(report: ProfileReport): string {
  const nativeTotal = report.entries
    .filter((e) => e.source === 'native')
    .reduce((s, e) => s + e.durationMs, 0);

  type Row = { label: string; value: string };
  const rows: Row[] = [
    {
      label: 'JS wall-clock (union of span intervals)',
      value: fmtMs(report.wallClockMs),
    },
    {
      label: 'Native (Rust core)',
      value: nativeTotal > 0 ? fmtMs(nativeTotal) : '—',
    },
  ];
  if (report.gc) {
    const { totalMs, majorMs, count } = report.gc;
    rows.push({
      label: `GC (${count} events, ${fmtMs(majorMs)} major)`,
      value: fmtMs(totalMs),
    });
  }
  if (report.eventLoopDelay) {
    const { p50Ms, p99Ms, maxMs } = report.eventLoopDelay;
    const warn = p99Ms > 200 ? ' ⚠️' : '';
    rows.push({
      label: `ELD p50/p99/max${warn}`,
      value: `${fmtMs(p50Ms)} / ${fmtMs(p99Ms)} / ${fmtMs(maxMs)}`,
    });
  }
  return md.table(rows, [
    { label: 'Metric', mapFn: (r) => r.label },
    { label: 'Value', mapFn: (r) => r.value },
  ]);
}

// ── Scenario index (multi-file mode) ─────────────────────────────────────────

export interface ProcessDetailLinks {
  /** Relative path to the spans detail file for this process */
  spansFile?: string;
  /** Relative path to the V8 CPU hot spots file */
  cpuFile?: string;
  /** Relative path to the macOS sample / perf file */
  sampleFile?: string;
}

/**
 * Build the `index.md` entry-point for one scenario in multi-file mode.
 * Contains the process summary table and links into the detail/ subdirectory.
 */
export function buildScenarioIndexMarkdown(
  scenarioLabel: string,
  reports: ProfileReport[],
  detailLinks: Map<number, ProcessDetailLinks>
): string {
  const roleOrder: ProcessRole[] = [
    'main',
    'plugin-worker',
    'task-worker',
    'daemon',
  ];
  const sorted = [...reports].sort(
    (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)
  );

  const mainReport = sorted.find((r) => r.role === 'main');
  const mainJsTotal = mainReport?.wallClockMs ?? 0;

  const pluginWorkers = sorted.filter((r) => r.role === 'plugin-worker');
  const taskWorkers = sorted.filter((r) => r.role === 'task-worker');
  const daemons = sorted.filter((r) => r.role === 'daemon');

  const procCounts = [
    `1 main`,
    pluginWorkers.length > 0
      ? `${pluginWorkers.length} plugin-worker${pluginWorkers.length > 1 ? 's' : ''}`
      : null,
    taskWorkers.length > 0
      ? `${taskWorkers.length} task-worker${taskWorkers.length > 1 ? 's' : ''}`
      : null,
    daemons.length > 0 ? `${daemons.length} daemon` : null,
  ]
    .filter(Boolean)
    .join(' + ');

  // Process summary table with links to detail files
  type SummaryRow = {
    pid: string;
    role: string;
    label: string;
    jsTotal: string;
    gc: string;
    eldP99: string;
    spans: string;
    details: string;
  };
  const summaryRows: SummaryRow[] = sorted.map((r) => {
    const links = detailLinks.get(r.pid);
    const detailParts: string[] = [];
    if (links?.spansFile) detailParts.push(`[spans](${links.spansFile})`);
    if (links?.cpuFile) detailParts.push(`[cpu](${links.cpuFile})`);
    if (links?.sampleFile) detailParts.push(`[sample](${links.sampleFile})`);
    return {
      pid: String(r.pid),
      role: r.role,
      label: shortCommand(r.role, r.command),
      jsTotal: fmtMs(r.wallClockMs),
      gc: r.gc ? fmtMs(r.gc.totalMs) : '—',
      eldP99: r.eventLoopDelay
        ? fmtMs(r.eventLoopDelay.p99Ms) +
          (r.eventLoopDelay.p99Ms > 200 ? ' ⚠️' : '')
        : '—',
      spans: String(r.entries.filter((e) => e.durationMs >= 1).length),
      details: detailParts.join(' · ') || '—',
    };
  });

  const summaryTable = md.table(summaryRows, [
    { label: 'PID', mapFn: (r) => r.pid },
    { label: 'Role', mapFn: (r) => r.role },
    { label: 'Command / Plugin', mapFn: (r) => r.label },
    { label: 'JS wall-clock', mapFn: (r) => r.jsTotal },
    { label: 'GC', mapFn: (r) => r.gc },
    { label: 'ELD p99', mapFn: (r) => r.eldP99 },
    { label: 'Spans', mapFn: (r) => r.spans },
    { label: 'Detail files', mapFn: (r) => r.details },
  ]);

  const legendTable = md.table(
    [
      {
        source: md.code('js'),
        what: `${md.code('performance.measure()')} spans in Nx TypeScript code. Nested spans merged — ${md.bold('JS wall-clock')} is the union, not the sum.`,
        when: 'Always',
      },
      {
        source: md.code('native'),
        what: `Timing spans from Nx's Rust core (file hashing, cache restore).`,
        when: md.code('NX_NATIVE_PROFILE=1'),
      },
      {
        source: md.code('gc'),
        what: `V8 GC pause time. High values ⇒ aggressive allocation.`,
        when: `${md.code('NX_PROFILE_OUT')} set`,
      },
      {
        source: md.code('ELD'),
        what: `Event-loop delay p50/p99/max — how long the JS thread was blocked.`,
        when: `${md.code('NX_PROFILE_OUT')} set`,
      },
    ],
    [
      { label: 'Source', mapFn: (r) => r.source },
      { label: 'What it measures', mapFn: (r) => r.what },
      { label: 'When it appears', mapFn: (r) => r.when },
    ]
  );

  return [
    md.h1(scenarioLabel),
    '',
    `${md.bold('Command:')} ${md.code(mainReport?.command ?? '')}`,
    `${md.bold('Recorded:')} ${mainReport?.timestamp ?? new Date().toISOString()}`,
    `${md.bold('Processes:')} ${procCounts}`,
    `${md.bold('Main JS wall-clock:')} ${md.bold(fmtMs(mainJsTotal))} ${md.italics('(union of instrumented span intervals)')}`,
    '',
    md.h2('Process summary'),
    '',
    summaryTable,
    '',
    md.blockQuote(
      `${md.bold('JS wall-clock')} = union of instrumented span intervals (nested/overlapping merged).`,
      `${md.bold('GC')} = V8 garbage-collector pause time.`,
      `${md.bold('ELD p99')} = event-loop delay 99th percentile (> 200 ms ⚠️ indicates blocking).`,
      `${md.bold('Spans')} = number of ${md.code('performance.measure()')} + Rust spans ≥ 1 ms.`
    ),
    '',
    md.h2('Legend'),
    '',
    legendTable,
  ].join('\n');
}
