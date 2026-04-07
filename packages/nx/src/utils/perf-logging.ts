import {
  PerformanceMeasure,
  PerformanceObserver,
  monitorEventLoopDelay,
  constants as perfConstants,
} from 'perf_hooks';
import type { IntervalHistogram } from 'perf_hooks';

import type { TrackedDetail } from './perf-hooks';

// ── Profile collection ────────────────────────────────────────────────────────
// When NX_PROFILE_OUT is set, every performance measure is captured in memory
// and flushed to <runDir>/<pid>_<role>.json on process exit.
// NX_PROFILE_OUT can be any path; dirname(NX_PROFILE_OUT) is used as the run
// directory where per-PID JSON files are written.
const PROFILE_OUT = process.env['NX_PROFILE_OUT'];
const profileEntries: Array<{
  name: string;
  duration: number;
  startTime: number;
}> = [];

// GC stats and event-loop-delay monitor — only populated when PROFILE_OUT is set
let gcStats: { totalMs: number; majorMs: number; count: number } | null = null;
let eldMonitor: IntervalHistogram | null = null;

/** Determine the role of the current process for profile labelling. */
function getProcessRole(): import('./perf-report').ProcessRole {
  // Lazy-require to keep the analytics/daemon-free fast path for `nx --version`.
  const { isOnDaemon } =
    require('../daemon/is-on-daemon') as typeof import('../daemon/is-on-daemon');
  if (isOnDaemon()) return 'daemon';
  if (process.env['NX_TASK_HASH']) return 'task-worker';
  if ((process.argv[2] ?? '').endsWith('.sock')) return 'plugin-worker';
  return 'main';
}

if (PROFILE_OUT) {
  // ── GC tracking ────────────────────────────────────────────────────────────
  gcStats = { totalMs: 0, majorMs: 0, count: 0 };
  const gcObs = new PerformanceObserver((list) => {
    const stats = gcStats!;
    for (const entry of list.getEntries()) {
      stats.totalMs += entry.duration;
      stats.count++;
      const detail = (entry as unknown as { detail?: { kind?: number } })
        .detail;
      if (
        detail?.kind != null &&
        detail.kind & perfConstants.NODE_PERFORMANCE_GC_MAJOR
      ) {
        stats.majorMs += entry.duration;
      }
    }
  });
  gcObs.observe({ entryTypes: ['gc'] });

  // ── Event-loop delay monitoring ─────────────────────────────────────────────
  // Samples the gap between successive timer callbacks to detect blocking.
  // Values are in nanoseconds; divide by 1e6 for milliseconds.
  eldMonitor = monitorEventLoopDelay({ resolution: 10 });
  eldMonitor.enable();

  const flushProfile = () => {
    if (profileEntries.length === 0) return;
    try {
      // Lazily import to avoid pulling in fs/markdown-factory at startup for
      // every nx invocation.
      const { buildReport, writePidReport } =
        require('./perf-report') as typeof import('./perf-report');
      const { dirname } = require('path') as typeof import('path');

      let nativeJson: string | null = null;
      try {
        const native = require('../native') as {
          getNativeTimings?: () => string | null;
        };
        nativeJson = native.getNativeTimings?.() ?? null;
      } catch {
        // native module not built / function not yet exposed — skip
      }

      const role = getProcessRole();
      const report = buildReport(
        profileEntries,
        nativeJson,
        process.argv.slice(2).join(' '),
        {
          gc: gcStats ?? undefined,
          eventLoopDelay: eldMonitor
            ? {
                p50Ms: eldMonitor.percentile(50) / 1e6,
                p99Ms: eldMonitor.percentile(99) / 1e6,
                maxMs: eldMonitor.max / 1e6,
              }
            : undefined,
          pid: process.pid,
          role,
        }
      );
      // Write to <runDir>/<pid>_<role>.json — each process gets its own file.
      writePidReport(report, dirname(PROFILE_OUT));
    } catch (e) {
      process.stderr.write(`[profile] failed to write report: ${e}\n`);
    }
  };

  // 'exit' fires synchronously before the process terminates.
  // SIGTERM handler ensures the report is written on graceful kills too.
  process.on('exit', flushProfile);
  process.on('SIGTERM', () => {
    flushProfile();
    process.exit(0);
  });
}
// ─────────────────────────────────────────────────────────────────────────────

function isTrackedDetail(detail: unknown): detail is TrackedDetail {
  return (
    typeof detail === 'object' &&
    detail !== null &&
    (detail as any).track === true
  );
}

new PerformanceObserver((list) => {
  // observer is configured for 'measure' entries only (see .observe call below)
  const entries = list.getEntries() as PerformanceMeasure[];
  const logEnabled = process.env.NX_PERF_LOGGING === 'true';
  const tracked = entries.filter((e) => isTrackedDetail(e.detail));

  // Capture every measure for the profile report before any short-circuit.
  if (PROFILE_OUT) {
    for (const entry of entries) {
      profileEntries.push({
        name: entry.name,
        duration: entry.duration,
        startTime: entry.startTime,
      });
    }
  }

  // Short-circuit before loading analytics / daemon logger (~60ms of native
  // binding + module init) when there's nothing to do.
  if (!logEnabled && tracked.length === 0) return;

  if (logEnabled) {
    const { isOnDaemon } =
      require('../daemon/is-on-daemon') as typeof import('../daemon/is-on-daemon');
    const { serverLogger } =
      require('../daemon/logger') as typeof import('../daemon/logger');
    const { logger } = require('./logger') as typeof import('./logger');
    const log = isOnDaemon()
      ? (msg: string) => serverLogger.log(msg)
      : (msg: string) => logger.warn(msg);
    for (const entry of entries) {
      log(`Time taken for '${entry.name}' ${entry.duration}ms`);
    }
  }

  if (tracked.length === 0) return;

  const { customDimensions, reportEvent } =
    require('../analytics') as typeof import('../analytics');
  if (!customDimensions) return;
  const dimensionValues = new Set(Object.values(customDimensions));

  for (const entry of tracked) {
    const { track, ...rest } = entry.detail as TrackedDetail;
    const params: import('../analytics').EventParameters = {
      [customDimensions.duration]: entry.duration,
    };
    for (const [key, value] of Object.entries(rest)) {
      if (dimensionValues.has(key)) params[key] = value;
    }
    reportEvent(entry.name, params);
  }
}).observe({ entryTypes: ['measure'] });
