/**
 * Per-process profile capture.
 *
 * Each instrumented process (main CLI, plugin workers, task workers, daemon)
 * writes a single JSON file named `<pid>_<role>.json` into the run directory.
 * `benchmarks/profile-run.mts` renders them as markdown.
 *
 * Activated by the perf-logging observer when `NX_PROFILE_OUT` is set.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export type ProcessRole = 'main' | 'plugin-worker' | 'task-worker' | 'daemon';

export interface ProfileEntry {
  name: string;
  /** Wall-clock duration in milliseconds */
  durationMs: number;
  source: 'js' | 'native';
  /**
   * Start time relative to performance.timeOrigin, in milliseconds.
   * Present for JS spans (from performance.measure). Used to compute
   * wall-clock coverage by merging overlapping intervals.
   * Absent for native spans (Rust timings don't carry an absolute start).
   */
  startTime?: number;
}

export interface GcStats {
  totalMs: number;
  majorMs: number;
  count: number;
}

export interface EventLoopDelay {
  p50Ms: number;
  p99Ms: number;
  maxMs: number;
}

export interface ProfileReport {
  pid: number;
  role: ProcessRole;
  command: string;
  timestamp: string;
  /**
   * True wall-clock time covered by JS instrumentation — the length of the
   * union of all JS span intervals [startTime, startTime+duration].
   * Overlapping/nested spans are merged, so this is never double-counted.
   * This is the primary "how long did JS work take" metric.
   */
  wallClockMs: number;
  entries: ProfileEntry[];
  gc?: GcStats;
  eventLoopDelay?: EventLoopDelay;
}

/**
 * Compute the total wall-clock time covered by a set of JS spans by merging
 * their intervals. Nested or overlapping spans are counted only once.
 *
 * Example: if span A is [0, 1000ms] and span B is [200ms, 600ms] (nested),
 * the union is still 1000ms — not 1000+400=1400ms.
 */
export function computeWallClockMs(
  jsEntries: Array<{ startTime: number; duration: number }>
): number {
  const intervals = jsEntries
    .filter((e) => e.startTime >= 0)
    .map((e): [number, number] => [e.startTime, e.startTime + e.duration])
    .sort((a, b) => a[0] - b[0]);

  if (intervals.length === 0) return 0;

  let wallClock = 0;
  let [curStart, curEnd] = intervals[0];
  for (let i = 1; i < intervals.length; i++) {
    const [start, end] = intervals[i];
    if (start <= curEnd) {
      curEnd = Math.max(curEnd, end); // extend current merged interval
    } else {
      wallClock += curEnd - curStart;
      curStart = start;
      curEnd = end;
    }
  }
  wallClock += curEnd - curStart;
  return wallClock;
}

export function buildReport(
  jsEntries: Array<{ name: string; duration: number; startTime: number }>,
  nativeJson: string | null | undefined,
  command: string,
  extras?: {
    gc?: GcStats;
    eventLoopDelay?: EventLoopDelay;
    pid?: number;
    role?: ProcessRole;
  }
): ProfileReport {
  const nativeEntries: ProfileEntry[] = [];
  if (nativeJson) {
    try {
      const parsed = JSON.parse(nativeJson) as Array<{
        name: string;
        durationMs: number;
      }>;
      for (const e of parsed) {
        nativeEntries.push({
          name: e.name,
          durationMs: e.durationMs,
          source: 'native',
        });
      }
    } catch {
      // malformed native JSON — skip gracefully
    }
  }

  const entries: ProfileEntry[] = [
    ...jsEntries.map((e) => ({
      name: e.name,
      durationMs: e.duration,
      startTime: e.startTime,
      source: 'js' as const,
    })),
    ...nativeEntries,
  ].sort((a, b) => b.durationMs - a.durationMs);

  // Wall-clock: union of JS span intervals (nested spans merged, not double-counted).
  const wallClockMs = computeWallClockMs(jsEntries);

  return {
    pid: extras?.pid ?? process.pid,
    role: extras?.role ?? 'main',
    command,
    timestamp: new Date().toISOString(),
    wallClockMs,
    entries,
    gc: extras?.gc,
    eventLoopDelay: extras?.eventLoopDelay,
  };
}

/**
 * Write a per-process profile JSON into `runDir`.
 * Filename: `<pid>_<role>.json` — unique per process, never overwrites siblings.
 */
export function writePidReport(report: ProfileReport, runDir: string): void {
  mkdirSync(runDir, { recursive: true });
  const jsonPath = join(runDir, `${report.pid}_${report.role}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
  process.stderr.write(
    `\n[profile] pid ${report.pid} (${report.role}) → ${report.entries.length} entries\n`
  );
}
