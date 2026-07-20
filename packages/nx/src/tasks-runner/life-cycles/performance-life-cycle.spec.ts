import * as os from 'node:os';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { NxJsonConfiguration } from '../../config/nx-json';
import { Task, TaskGraph } from '../../config/task-graph';
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import * as nxCloudUtils from '../../utils/nx-cloud-utils';
import { TaskResult } from '../life-cycle';
import {
  PerformanceLifeCycle,
  flushPerformanceReport,
  getPerformanceReport,
  getPerformanceSummaryPayload,
} from './performance-life-cycle';
import {
  buildTimespans,
  mergeIntervals,
  overlap,
  PerformanceSummary,
  preDispatchHashTime,
  TimedTask,
} from './performance-analysis';
import { formatDuration } from '../../native';
import {
  buildExitSummaryPayload,
  buildRecommendations,
  formatReport,
  formatReportMarkdown,
  recommendationToPayloadString,
} from './performance-report';
import { getThreadPoolSize } from '../task-orchestrator';

function makeTask(
  id: string,
  opts: {
    start?: number;
    end?: number;
    continuous?: boolean;
    parallelism?: boolean;
  } = {}
): Task {
  return {
    id,
    target: { project: id, target: 'build' },
    overrides: {},
    outputs: [],
    parallelism: opts.parallelism ?? true,
    continuous: opts.continuous ?? false,
    startTime: opts.start,
    endTime: opts.end,
  } as unknown as Task;
}

function makeGraph(
  tasks: Task[],
  deps: Record<string, string[]> = {},
  continuousDeps: Record<string, string[]> = {}
): TaskGraph {
  return {
    roots: tasks
      .filter((t) => (deps[t.id] ?? []).length === 0)
      .map((t) => t.id),
    tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
    dependencies: Object.fromEntries(
      tasks.map((t) => [t.id, deps[t.id] ?? []])
    ),
    continuousDependencies: Object.fromEntries(
      tasks.map((t) => [t.id, continuousDeps[t.id] ?? []])
    ),
  } as unknown as TaskGraph;
}

interface TestEnv {
  windows?: Array<[number, number]>;
  skipped?: boolean;
  remoteCache?: boolean;
  isCI?: boolean;
  distributing?: boolean;
  neverConnectToCloud?: boolean;
}

// The lifecycle reads its signals from the environment (CI, distribution) and a
// couple of helpers (hash windows via perf measures, remote cache via isNxCloudUsed)
// rather than constructor seams. Tests drive the env vars through
// `withEnvironmentVariables` (auto snapshot/restore) and the helpers through jest
// spies set up in beforeEach.
let getEntriesByTypeSpy: jest.SpyInstance;

/**
 * Make collectHashWindows() observe the given absolute-epoch [start, end] hash
 * windows by faking the perf-measure entries it reads — origin-relative, to match
 * collectHashWindows' `timeOrigin + startTime` math.
 */
function setHashWindows(windows: Array<[number, number]>): void {
  const origin = performance.timeOrigin;
  getEntriesByTypeSpy.mockImplementation((type: string): any =>
    type === 'measure'
      ? windows.map(([start, end], i) => ({
          name: `hash-${i}`,
          entryType: 'measure',
          startTime: start - origin,
          duration: end - start,
        }))
      : []
  );
}

beforeEach(() => {
  getEntriesByTypeSpy = jest.spyOn(performance, 'getEntriesByType');
  setHashWindows([]);
  jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** The env vars the given TestEnv implies (CI short-circuit + distribution flag). */
function envFor(env: TestEnv): Record<string, string | null> {
  return {
    // The `CI === 'false'` short-circuit forces isCI() false even on a CI machine.
    CI: env.isCI ? 'true' : 'false',
    NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT: env.distributing ? '3' : null,
  };
}

/** Construct a PerformanceLifeCycle with its non-env signals (mocks) set up. */
function makeLifeCycle(
  graph: TaskGraph,
  env: TestEnv = {}
): PerformanceLifeCycle {
  if (env.windows) {
    setHashWindows(env.windows);
  }
  (nxCloudUtils.isNxCloudUsed as jest.Mock).mockReturnValue(
    env.remoteCache ?? true
  );
  return new PerformanceLifeCycle(graph, {
    skipNxCache: env.skipped,
    nxJson: {
      neverConnectToCloud: env.neverConnectToCloud,
    } as NxJsonConfiguration,
  });
}

/** Recover `--parallel` from a thread-pool total the way run-command does. */
function parallelFromTotal(graph: TaskGraph, total: number): number {
  const continuous = Object.values(graph.tasks).filter(
    (t) => t.continuous
  ).length;
  return Math.max(1, total - continuous);
}

/** Feed a lifecycle a full run and return its summary. */
function run(
  graph: TaskGraph,
  total: number,
  opts: {
    batches?: string[][];
    hashWindows?: Array<[number, number]>;
    statuses?: Record<string, TaskResult['status']>;
    cacheSkipped?: boolean;
    remoteCacheEnabled?: boolean;
    isCI?: boolean;
    distributing?: boolean;
    neverConnectToCloud?: boolean;
  } = {}
) {
  const env: TestEnv = {
    windows: opts.hashWindows,
    skipped: opts.cacheSkipped,
    remoteCache: opts.remoteCacheEnabled,
    isCI: opts.isCI,
    distributing: opts.distributing,
    neverConnectToCloud: opts.neverConnectToCloud,
  };
  return withEnvironmentVariables(envFor(env), () => {
    const lc = makeLifeCycle(graph, env);
    lc.startCommand(total, parallelFromTotal(graph, total));
    for (const taskIds of opts.batches ?? []) {
      lc.registerRunningBatch('batch', { executorName: 'e', taskIds } as never);
    }
    const results = Object.values(graph.tasks).map(
      (task) =>
        ({ task, status: opts.statuses?.[task.id] }) as unknown as TaskResult
    );
    lc.endTasks(results);
    return lc.getSummary();
  });
}

/** The lever recommendations as plain strings — what production re-derives for the report/payload. */
const recStrings = (s: PerformanceSummary): string[] =>
  buildRecommendations(s).map(recommendationToPayloadString);

describe('PerformanceLifeCycle', () => {
  it('returns null when there are no discrete task timings', () => {
    expect(run(makeGraph([makeTask('a')]), 4)).toBeNull();
  });

  it('returns null for an empty task graph', () => {
    expect(run(makeGraph([]), 4)).toBeNull();
  });

  it('returns null when only continuous tasks ran (no end times)', () => {
    const c1 = makeTask('c1', { continuous: true });
    const c2 = makeTask('c2', { continuous: true });
    expect(run(makeGraph([c1, c2]), 4)).toBeNull();
  });

  it('reports a zero-duration run without dividing by zero', () => {
    // Instant task (start == end) → runDuration 0; the recoverable % must guard
    // the division and still render.
    const a = makeTask('a', { start: 0, end: 0 });
    const s = run(makeGraph([a]), 1)!;

    expect(s.runDuration).toBe(0);
    expect(s.overhead).toBe(0);
    const report = formatReport(s);
    expect(report).toContain('Run duration:      <1ms');
    expect(report).not.toContain('NaN');
    expect(report).not.toContain('Infinity');
  });

  it('reports zero overhead for a single dependency chain', () => {
    const a = makeTask('a', { start: 0, end: 10 });
    const b = makeTask('b', { start: 10, end: 20 });
    const c = makeTask('c', { start: 20, end: 30 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1)!;

    expect(s.runDuration).toBe(30);
    expect(s.criticalPathDuration).toBe(30);
    expect(s.overhead).toBe(0);
  });

  it('reports zero overhead when everything runs in parallel', () => {
    const tasks = ['a', 'b', 'c', 'd', 'e'].map((id) =>
      makeTask(id, { start: 0, end: 10 })
    );
    const s = run(makeGraph(tasks), 5)!;

    expect(s.runDuration).toBe(10);
    expect(s.overhead).toBe(0);
    expect(s.recoverableByParallel).toBe(0);
  });

  it('attributes slot queuing (spare cores) to recoverable-by-parallelism', () => {
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    // parallel=1. `a` holds the only slot 0–20000; `b` is independent, eligible at
    // the run start, and queues for the slot until 20000 → recoverable by slots.
    const a = makeTask('a', { start: 0, end: 20000 });
    const b = makeTask('b', { start: 20000, end: 40000 });
    const s = run(makeGraph([a, b]), 1, { isCI: true })!;

    expect(s.overhead).toBe(20000);
    // cores-dependent split; only the sum is robustly assertable.
    expect(s.recoverableByParallel + s.recoverableByMachines).toBe(20000);
    expect(s.coordinatorOverhead).toBe(0);
    const recs = recStrings(s).join('\n');
    if (cores >= 2) {
      // 50% slot wait (>20%) with spare cores → --parallel leads, agents not yet.
      expect(recs).toContain('Increase parallelism');
      expect(recs).toMatch(/recover up to 20\.0s/);
      expect(recs).not.toContain('Nx Agents');
    } else {
      // Single core → no --parallel headroom, so agents is the lever (CI run).
      expect(recs).toContain('Nx Agents');
    }
  });

  it('does not count a ready task idle on a free slot as recoverable', () => {
    // parallel=2, both independent. `b` is eligible at the run start but doesn't
    // start until 100 — 100ms of ready work on a free slot (occ < parallel). That's
    // dispatch latency, not contention, so it stays out of the recoverable split.
    const a = makeTask('a', { start: 0, end: 10 });
    const b = makeTask('b', { start: 100, end: 110 });
    const s = run(makeGraph([a, b]), 2)!;

    expect(s.recoverableByParallel + s.recoverableByMachines).toBe(0);
  });

  it('displays the critical path (longest chain), not the last-finishing task', () => {
    // parallel=1: `a` holds the only slot 0–1000 (the critical path); `b` queues
    // and finishes last. We display `a`; b's off-path slot wait lives in the
    // recoverable-by-parallel bucket.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const s = run(makeGraph([a, b]), 1)!;

    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['a']); // the critical path
  });

  it('displays only the longest few critical-path tasks, not the whole chain', () => {
    // Contiguous chain of five increasing-length tasks (no gaps → zero overhead);
    // the display shows the top three by duration, not all five (t2 sits exactly
    // at the 20%-of-path floor and stays).
    const durs = [10000, 20000, 30000, 40000, 50000];
    let offset = 0;
    const tasks = durs.map((d, i) => {
      const t = makeTask(`t${i}`, { start: offset, end: offset + d });
      offset += d;
      return t;
    });
    const deps = { t1: ['t0'], t2: ['t1'], t3: ['t2'], t4: ['t3'] };
    const s = run(makeGraph(tasks, deps), 1)!;

    expect(s.overhead).toBe(0);
    expect(s.criticalPathTaskCount).toBe(5);
    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['t4', 't3', 't2']);
    const report = formatReport(s);
    expect(report).toContain('t4'); // longest, shown
    expect(report).not.toContain('t0'); // shortest, trimmed
  });

  it('drops critical-path tasks under 20% of the path from the speed-up list', () => {
    // Chain: `b` dominates the 50s path; `a` sits exactly at the 20% floor (kept),
    // `c` at 10% (dropped as noise — speeding it up barely moves the path).
    const a = makeTask('a', { start: 0, end: 10000 });
    const b = makeTask('b', { start: 10000, end: 45000 });
    const c = makeTask('c', { start: 45000, end: 50000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1)!;

    expect(s.criticalPathDuration).toBe(50000);
    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('attributes a wait with free slots to coordinator overhead', () => {
    // `x` is eligible at 0 but starts at 50000 with free slots and nothing running
    // → not slot contention, pure coordinator time.
    const early = makeTask('early', { start: 0, end: 1000 });
    const x = makeTask('x', { start: 50000, end: 60000 });
    const s = run(makeGraph([early, x]), 4, { isCI: true })!;

    expect(s.recoverableByParallel).toBe(0);
    expect(s.recoverableByMachines).toBe(0);
    expect(s.coordinatorOverhead).toBe(50000);
    // Coordinator (50s) dwarfs the work (10s critical path) → dominated: recommend
    // distributing across machines (CI run), drop the longest-tasks section, and don't
    // restate the coordinator-overhead number (it's a header stat).
    expect(s.coordinatorDominated).toBe(true);
    const recs = recStrings(s).join('\n');
    expect(recs).toContain('Distribute across machines with Nx Agents');
    expect(recs).not.toContain('coordinator overhead');
    expect(recs).not.toContain('Speed up or split');
    expect(formatReport(s)).not.toContain('longest tasks on the critical path');
  });

  it('recovers slot contention at low parallelism even when an idle gap follows it', () => {
    // Regression: at low --parallel, a long coordinator gap after a burst of slot
    // contention used to swallow the WHOLE overhead into "non-recoverable" (0
    // recoverable). Here `c0`/`c1` saturate both slots 0–1000 while `w` queues
    // (real contention), then the coordinator sits idle 1000–5000. The 1s of
    // contention is recoverable; only the 4s idle gap is coordinator overhead.
    const c0 = makeTask('c0', { start: 0, end: 1000 });
    const c1 = makeTask('c1', { start: 0, end: 1000 });
    const w = makeTask('w', { start: 5000, end: 6000 });
    const s = run(makeGraph([c0, c1, w]), 2)!;

    expect(s.overhead).toBe(5000);
    // cores-dependent split; assert the robust sum + remainder.
    expect(s.recoverableByParallel + s.recoverableByMachines).toBe(1000);
    expect(s.coordinatorOverhead).toBe(4000);
  });

  it('stays critical-path-bound (shows tasks) when coordinator only slightly exceeds the work', () => {
    // critical path = `a` (20s); `x` finishes last after a 48s coordinator wait →
    // coordinator ~30s, only ~1.5x the critical path (not >3x). A cold run with
    // real work like this isn't "maxed" — stay critical-path-bound and show tasks.
    const early = makeTask('early', { start: 0, end: 1000 });
    const a = makeTask('a', { start: 0, end: 20000 });
    const x = makeTask('x', { start: 48000, end: 50000 });
    const s = run(makeGraph([early, a, x]), 4)!;

    expect(s.criticalPathDuration).toBe(20000);
    expect(s.coordinatorOverhead).toBeGreaterThan(20000); // > critical path...
    expect(s.coordinatorDominated).toBe(false); // ...but not >3x → not dominated
    const report = formatReport(s);
    expect(report).toContain('Speed up or split the longest tasks');
    expect(report).toContain('on the critical path');
  });

  it('recommends the biggest critical-path tasks but not agents for a pure chain (nothing to recover) in CI', () => {
    // Pure dependency chain at its floor: zero recoverable time. More machines
    // can't shorten a sequential chain, so advice names the longest tasks to speed
    // up only — no agents, no higher --parallel.
    const a = makeTask('a', { start: 0, end: 10000 });
    const b = makeTask('b', { start: 10000, end: 40000 });
    const c = makeTask('c', { start: 40000, end: 50000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1, {
      isCI: true,
    })!;

    expect(s.overhead).toBe(0);
    const recs = recStrings(s).join('\n');
    expect(recs).toContain('Speed up or split');
    expect(recs).toContain('longest tasks on the critical path');
    expect(recs).toContain('b'); // the longest task, listed inline
    expect(s.criticalPathTop[0].id).toBe('b');
    // Nothing for agents to recover (and no spare slot for --parallel either).
    expect(recs).not.toContain('Nx Agents');
    expect(recs).not.toContain('--parallel');
    expect(recStrings(s).length).toBe(1); // just speed-up
  });

  it('suppresses every recommendation when the run is already fast (< 30s)', () => {
    // Machine-bound contention that would earn advice on a long run — but the whole
    // run took 2s, so there is nothing worth optimizing: stats only, no advice.
    const np = makeTask('np', { start: 0, end: 1200, parallelism: false });
    const q = makeTask('q', { start: 1200, end: 2000 });
    const s = run(makeGraph([np, q]), 2, { isCI: true })!;

    expect(s.runDuration).toBe(2000);
    expect(s.recoverableByMachines).toBe(800); // real contention, still no advice
    expect(recStrings(s)).toHaveLength(0);
    expect(formatReport(s)).not.toContain('Recommendation');
  });

  it('keeps a small --parallel win in the header, not the recommendation', () => {
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    // parallel=1. `a` holds the only slot 0–5000; `b` queues 5s then runs
    // 5000–35000. 5s recoverable is below the 20% lead threshold → advice is
    // critical-path (not slot), small win shows as a header stat.
    const a = makeTask('a', { start: 0, end: 5000 });
    const b = makeTask('b', { start: 5000, end: 35000 });
    const s = run(makeGraph([a, b]), 1)!;

    if (cores >= 2) {
      expect(s.recoverableByParallel).toBe(5000);
      const recs = recStrings(s).join('\n');
      expect(recs).toContain('Speed up or split');
      expect(recs).not.toContain('--parallel');
      expect(formatReport(s)).toMatch(/Recoverable time:\s+5\.0s/);
    }
  });

  it('omits the distribute (agents) recommendation outside CI', () => {
    // Same chain as the CI case but local: agents are CI-only, so the only lever
    // shown is speeding up the longest tasks.
    const a = makeTask('a', { start: 0, end: 10000 });
    const b = makeTask('b', { start: 10000, end: 40000 });
    const c = makeTask('c', { start: 40000, end: 50000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1, {
      isCI: false,
    })!;

    expect(recStrings(s).length).toBe(1); // just speed-up, no distribute
    expect(recStrings(s)[0]).toContain('Speed up or split');
    expect(recStrings(s).join('\n')).not.toContain('Nx Agents');
  });

  it('omits the distribute recommendation when already distributing (CI)', () => {
    // Already on Nx Agents and no slot contention → only the critical-path
    // speed-up; no "start distributing" recommendation.
    const a = makeTask('a', { start: 0, end: 10000 });
    const b = makeTask('b', { start: 10000, end: 40000 });
    const c = makeTask('c', { start: 40000, end: 50000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1, {
      isCI: true,
      distributing: true,
    })!;

    expect(recStrings(s).length).toBe(1); // just speed-up
    expect(recStrings(s).join('\n')).not.toContain('Nx Agents');
  });

  it('recommends more agents (with the recoverable figure) when distributing', () => {
    // Slot contention on a distributed run → the lever is more agents, not local
    // --parallel; figure is the total recoverable slot-contention time (20.0s).
    const a = makeTask('a', { start: 0, end: 20000 });
    const b = makeTask('b', { start: 20000, end: 40000 });
    const s = run(makeGraph([a, b]), 1, { distributing: true })!;

    const recs = recStrings(s).join('\n');
    expect(recs).toContain('Add more Nx Agents to recover up to');
    expect(recs).toMatch(/recover up to 20\.0s/);
    expect(recs).not.toContain('Increase parallelism');
  });

  it('treats a wait for a continuous dependency to start as eligibility, not contention', () => {
    // `serve` (continuous) comes up at 3000; `e2e` depends on it and starts at
    // 3000 — never slot-blocked, just waiting for serve. Its wait must be 0
    // (eligible at serve's start), so the 3000 is coordinator overhead, not recoverable.
    const serve = makeTask('serve', { start: 3000, continuous: true });
    const d = makeTask('d', { start: 0, end: 3000 });
    const e2e = makeTask('e2e', { start: 3000, end: 13000 });
    const graph = makeGraph([serve, d, e2e], {}, { e2e: ['serve'] });
    const s = run(graph, 1)!;

    // e2e waited only for serve to come up (eligibility, not contention), so the
    // 3000 is coordinator overhead, not recoverable.
    expect(s.recoverableByParallel).toBe(0);
    expect(s.recoverableByMachines).toBe(0);
    expect(s.coordinatorOverhead).toBe(3000);
  });

  it('folds batch sequencing into the floor, not coordinator overhead', () => {
    // a and b are independent but in one batch, run sequentially in one process.
    // That ordering is part of the floor, so the packed run has zero overhead.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const s = run(makeGraph([a, b]), 1, { batches: [['a', 'b']] })!;

    expect(s.overhead).toBe(0);
    expect(s.coordinatorOverhead).toBe(0);
    expect(s.recoverableByParallel).toBe(0);
  });

  it('treats a parallelism:false task as occupying the whole pool', () => {
    // `np` runs alone (parallelism:false), so the machine is saturated and `x`
    // (eligible at 0) is genuinely slot-blocked, not idle.
    const np = makeTask('np', { start: 0, end: 1000, parallelism: false });
    const x = makeTask('x', { start: 1000, end: 2000 });
    const s = run(makeGraph([np, x]), 2)!;

    expect(s.overhead).toBe(1000);
    expect(s.recoverableByParallel + s.recoverableByMachines).toBe(1000);
    expect(s.coordinatorOverhead).toBe(0);
  });

  it('attributes pool-monopolized contention to machines, never to --parallel', () => {
    // `np` monopolizes both slots (parallelism:false) while `x` queues. A higher
    // local --parallel can't recover that (the task holds every slot by design),
    // so the time lands in recoverable-by-machines and --parallel is not suggested.
    const np = makeTask('np', { start: 0, end: 20000, parallelism: false });
    const x = makeTask('x', { start: 20000, end: 40000 });
    const s = run(makeGraph([np, x]), 2)!;

    expect(s.recoverableByMachines).toBe(20000);
    expect(s.recoverableByParallel).toBe(0);
    expect(recStrings(s).join('\n')).not.toContain('Increase parallelism');
  });

  it('attributes volume beyond one machine to recoverable-by-machines even when parallel < cores', () => {
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    // 3×cores independent tasks serialized at parallel=1. totalWork/cores −
    // criticalPath = 3000 − 1000 = 2000 of machine-bound volume that raising
    // --parallel alone cannot recover.
    const n = cores * 3;
    const tasks = Array.from({ length: n }, (_, i) =>
      makeTask(`t${i}`, { start: i * 1000, end: (i + 1) * 1000 })
    );
    const s = run(makeGraph(tasks), 1)!;

    if (cores >= 2) {
      // parallel(1) < cores → split is by work invariant, not observed occ; both
      // buckets are > 0, which the old observed-occupancy split couldn't produce.
      expect(s.recoverableByMachines).toBe(2000);
      expect(s.recoverableByParallel).toBeGreaterThan(0);
    } else {
      // single core: parallel == cores, so there is no --parallel headroom.
      expect(s.recoverableByParallel).toBe(0);
    }
  });

  it('recommends more machines when the machine is already at its core count', () => {
    const cores = Math.max(
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length,
      os.cpus().length
    );
    // Fill every core 0–20000, then one more task queues at full cores.
    const fillers = Array.from({ length: cores }, (_, i) =>
      makeTask(`f${i}`, { start: 0, end: 20000 })
    );
    const waiter = makeTask('w', { start: 20000, end: 40000 });
    const s = run(makeGraph([...fillers, waiter]), cores, { isCI: true })!;

    expect(s.recoverableByMachines).toBe(20000);
    expect(s.recoverableByParallel).toBe(0);
    expect(recStrings(s).join('\n')).toContain('Nx Agents');
  });

  it('never recommends Nx Agents when the workspace opted out (neverConnectToCloud)', () => {
    // A machine-bound CI run that would otherwise earn the distribute rec.
    const np = makeTask('np', { start: 0, end: 20000, parallelism: false });
    const x = makeTask('x', { start: 20000, end: 40000 });
    const s = run(makeGraph([np, x]), 2, {
      isCI: true,
      neverConnectToCloud: true,
    })!;

    expect(s.canDistribute).toBe(false);
    expect(recStrings(s).join('\n')).not.toContain('Nx Agents');
  });

  it('makes no distribute rec for a machine-bound run outside CI (the lever is CI-only)', () => {
    const cores = Math.max(
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length,
      os.cpus().length
    );
    const fillers = Array.from({ length: cores }, (_, i) =>
      makeTask(`f${i}`, { start: 0, end: 20000 })
    );
    const waiter = makeTask('w', { start: 20000, end: 40000 });
    const s = run(makeGraph([...fillers, waiter]), cores, { isCI: false })!;

    // The distribute lever is CI-only, so a machine-bound local run gets no agents rec.
    expect(recStrings(s).join('\n')).not.toContain('Nx Agents');
  });

  it('makes no recommendation (and lists no tasks) when the critical path was fully cached', () => {
    // Fully-cached run: the "longest tasks" are cache restores, so there's nothing
    // to speed up — don't recommend it, and don't list restore times.
    const a = makeTask('a', { start: 0, end: 30000 });
    const b = makeTask('b', { start: 30000, end: 50000 });
    const c = makeTask('c', { start: 50000, end: 60000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 4, {
      statuses: { a: 'local-cache', b: 'local-cache', c: 'remote-cache' },
    })!;

    expect(s.cacheHits).toBe(3);
    expect(s.criticalPathTop).toHaveLength(0); // all cached → nothing to show
    expect(recStrings(s)).toHaveLength(0);
    expect(formatReport(s)).not.toContain('Speed up or split');
  });

  it('lists only the critical-path tasks that ran (not cache hits) in the speed-up', () => {
    // `b` ran (cache miss); `a` and `c` were cached → only `b` is worth speeding up.
    const a = makeTask('a', { start: 0, end: 10000 });
    const b = makeTask('b', { start: 10000, end: 40000 });
    const c = makeTask('c', { start: 40000, end: 50000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1, {
      statuses: { a: 'local-cache', b: 'success', c: 'local-cache' },
    })!;

    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['b']);
    expect(formatReport(s)).toContain('Speed up or split');
  });

  it('makes no recommendation for a dominated run outside CI (nothing actionable)', () => {
    // Maxed for this machine with no agents lever → nothing to suggest, so the
    // report omits the recommendation entirely.
    const early = makeTask('early', { start: 0, end: 1000 });
    const x = makeTask('x', { start: 50000, end: 60000 });
    const s = run(makeGraph([early, x]), 4, { isCI: false })!;

    expect(s.coordinatorDominated).toBe(true);
    expect(recStrings(s)).toHaveLength(0);
    expect(formatReport(s)).not.toContain('Recommendation');
  });

  it('counts pre-dispatch hashing that ran before the first task (cached/fast run)', () => {
    // The task restores in 100ms (1000→1100), but the coordinator hashed 200→800
    // first. That 600ms of pre-dispatch hashing is overhead the task window misses.
    const a = makeTask('a', { start: 1000, end: 1100 });
    const s = run(makeGraph([a]), 1, { hashWindows: [[200, 800]] })!;
    // runDuration = taskWindow (100) + pre-dispatch hashing (600)
    expect(s.runDuration).toBe(700);
  });

  it('unions overlapping pre-dispatch hash windows (no double count)', () => {
    const a = makeTask('a', { start: 1100, end: 1200 });
    // [200,800] and [600,1000] overlap → 800ms of hashing, not 1000.
    const s = run(makeGraph([a]), 1, {
      hashWindows: [
        [200, 800],
        [600, 1000],
      ],
    })!;
    expect(s.runDuration).toBe(900); // taskWindow 100 + unioned hashing 800
  });

  it('excludes stale pre-dispatch hashing separated by a large gap', () => {
    const a = makeTask('a', { start: 3000, end: 3100 });
    // Real pre-dispatch hashing 2000→2800; an older [0,500] mark from earlier
    // work in the same process is >1s away and excluded.
    const s = run(makeGraph([a]), 1, {
      hashWindows: [
        [0, 500],
        [2000, 2800],
      ],
    })!;
    expect(s.runDuration).toBe(900); // taskWindow 100 + contiguous hashing 800
  });

  it('does not throw on a dependency cycle', () => {
    const a = makeTask('a', { start: 0, end: 10 });
    const b = makeTask('b', { start: 10, end: 20 });
    const graph = makeGraph([a, b], { a: ['b'], b: ['a'] });
    expect(() => run(graph, 2)).not.toThrow();
    expect(run(graph, 2)).not.toBeNull();
  });

  it('excludes continuous tasks from the calculation', () => {
    const serve = makeTask('serve', { continuous: true });
    const build = makeTask('build', { start: 0, end: 20 });
    const s = run(makeGraph([serve, build]), 2)!;

    // Only `build` is a discrete task; `serve` (continuous) is excluded entirely.
    expect(s.criticalPathTaskCount).toBe(1);
    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['build']);
  });

  it('recovers discrete parallelism when continuous tasks share the pool', () => {
    const serve = makeTask('serve', { continuous: true });
    const build = makeTask('build', { start: 0, end: 20 });
    const s = run(makeGraph([serve, build]), 5)!;

    expect(s.parallel).toBe(4);
  });
});

describe('cache reporting', () => {
  it('reports the cache hit rate as a top-of-report stat', () => {
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const c = makeTask('c', { start: 2000, end: 2010 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1, {
      statuses: { a: 'success', b: 'success', c: 'local-cache' },
    })!;

    expect(s.cacheHits).toBe(1);
    expect(s.cacheableCount).toBe(3);
    expect(formatReport(s)).toMatch(/Cache:\s+1\/3 hit \(33%\)/);
  });

  it('recommends Nx Cloud when the hit rate is ~0 and remote cache is off', () => {
    const a = makeTask('a', { start: 0, end: 35000 });
    const s = run(makeGraph([a]), 1, {
      statuses: { a: 'success' }, // 0/1 hit
      remoteCacheEnabled: false,
    })!;

    expect(s.remoteCacheEnabled).toBe(false);
    const report = formatReport(s);
    // No-TTY jest env → no hyperlinks → the tagged URL prints verbatim.
    expect(report).toContain('sharing a cache across your team and CI');
    expect(report).toContain(
      'https://nx.dev/ci/features/remote-cache?utm_source=nx-cli&utm_medium=cli&utm_campaign=performance-report&utm_content=remote-cache'
    );
  });

  it('renders the remote-cache rec as a whole-phrase OSC 8 link (no raw URL) on a hyperlink terminal', () => {
    // FORCE_HYPERLINK overrides the TTY/CI checks in supportsHyperlinks, turning the
    // OSC 8 hyperlinks on inside the no-TTY jest env.
    const prev = process.env.FORCE_HYPERLINK;
    process.env.FORCE_HYPERLINK = '1';
    try {
      const a = makeTask('a', { start: 0, end: 35000 });
      const s = run(makeGraph([a]), 1, {
        statuses: { a: 'success' }, // 0/1 hit
        remoteCacheEnabled: false,
      })!;

      const report = formatReport(s);
      // The whole sentence is the OSC 8 link (visible text), utm-tagged page as
      // the hidden target — never a raw URL. Sequence: ESC]8;; <target> BEL <phrase>.
      const OSC8 = ']8;;';
      expect(report).toContain(
        `${OSC8}https://nx.dev/ci/features/remote-cache?utm_source=nx-cli&utm_medium=cli&utm_campaign=performance-report&utm_content=remote-cacheDrastically reduce your run duration by sharing a cache across your team and CI`
      );
      // The URL must never appear as plain visible text: every occurrence is
      // immediately preceded by the OSC 8 target preamble.
      const url = 'https://nx.dev/ci/features/remote-cache';
      for (
        let i = report.indexOf(url);
        i !== -1;
        i = report.indexOf(url, i + 1)
      ) {
        expect(report.slice(i - OSC8.length, i)).toBe(OSC8);
      }
    } finally {
      if (prev === undefined) {
        delete process.env.FORCE_HYPERLINK;
      } else {
        process.env.FORCE_HYPERLINK = prev;
      }
    }
  });

  it('omits the cache recommendation when local hit rate is high (even if remote is off)', () => {
    const tasks = ['a', 'b', 'c'].map((id) =>
      makeTask(id, { start: 0, end: 35000 })
    );
    const s = run(makeGraph(tasks), 3, {
      statuses: { a: 'local-cache', b: 'local-cache', c: 'local-cache' }, // 3/3 hit
      remoteCacheEnabled: false,
    })!;

    expect(s.cacheHits).toBe(3);
    expect(formatReport(s)).not.toContain('sharing a cache across your team');
  });

  it('omits the cache recommendation when remote cache is already on', () => {
    const a = makeTask('a', { start: 0, end: 35000 });
    const s = run(makeGraph([a]), 1, {
      statuses: { a: 'success' },
      remoteCacheEnabled: true,
    })!;

    expect(formatReport(s)).not.toContain('sharing a cache across your team');
  });

  it('never recommends Nx Cloud when the workspace opted out (neverConnectToCloud)', () => {
    // Cold cache with no remote would normally earn the CTA — but the workspace
    // said never to connect to Nx Cloud, so the report must not push it.
    const a = makeTask('a', { start: 0, end: 35000 });
    const s = run(makeGraph([a]), 1, {
      statuses: { a: 'success' }, // 0/1 hit
      remoteCacheEnabled: false,
      neverConnectToCloud: true,
    })!;

    expect(s.cloudOptedOut).toBe(true);
    expect(formatReport(s)).not.toContain('sharing a cache across your team');
  });

  it('warns (and only warns) when the cache was skipped', () => {
    const a = makeTask('a', { start: 0, end: 35000 });
    const s = run(makeGraph([a]), 1, {
      statuses: { a: 'success' },
      cacheSkipped: true,
    })!;

    expect(s.cacheSkipped).toBe(true);
    const report = formatReport(s);
    expect(report).toMatch(/Cache:\s+Skipped \(--skip-nx-cache\)/);
    expect(report).toContain('drop --skip-nx-cache');
    expect(report).not.toContain('hit (');
  });

  it('omits the cache note when no task has a recorded status', () => {
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const s = run(makeGraph([a, b]), 1)!; // no statuses

    expect(s.cacheableCount).toBe(0);
    expect(formatReport(s)).not.toContain('Cache:');
  });
});

describe('exit summary payload (TUI countdown)', () => {
  function feed(lc: PerformanceLifeCycle, graph: TaskGraph) {
    lc.endTasks(
      Object.values(graph.tasks).map(
        (task) => ({ task }) as unknown as TaskResult
      )
    );
  }

  it('builds the structured payload the TUI pulls at endCommand', () =>
    withEnvironmentVariables(envFor({}), () => {
      const a = makeTask('a', { start: 0, end: 1000 });
      const b = makeTask('b', { start: 1000, end: 2000 });
      const graph = makeGraph([a, b], { b: ['a'] });
      feed(makeLifeCycle(graph), graph);

      const payload = getPerformanceSummaryPayload();
      expect(payload).not.toBeNull();
      // The TUI builds the visual from these stats, not a pre-formatted string.
      expect(payload!.runDurationMs).toBe(2000);
      expect(payload!.criticalPathMs).toBe(2000);
      expect(payload!.criticalPathTaskCount).toBe(2);
      expect(Array.isArray(payload!.recommendations)).toBe(true);
    }));

  it('carries the remote-cache CTA link text as data (popup hardcodes no URLs)', () =>
    withEnvironmentVariables(envFor({}), () => {
      // Cold cache, remote off → the remote-cache CTA is recommended (a phrase link),
      // surfaced as a link for the popup to hyperlink in place.
      const a = makeTask('a', { start: 0, end: 35000 });
      const graph = makeGraph([a]);
      const lc = makeLifeCycle(graph, { remoteCache: false });
      lc.endTasks([{ task: a, status: 'success' } as unknown as TaskResult]);

      const payload = getPerformanceSummaryPayload()!;
      // The CTA link text matches the phrase in the recommendation, so the popup
      // links the text it was handed without a byte-identical constant of its own.
      expect(payload.links).toEqual([
        {
          text: 'Drastically reduce your run duration by sharing a cache across your team and CI',
          href: 'https://nx.dev/ci/features/remote-cache?utm_source=nx-cli&utm_medium=cli&utm_campaign=performance-report&utm_content=remote-cache',
        },
      ]);
      expect(
        payload.recommendations.some((r) => r.includes(payload.links[0].text))
      ).toBe(true);
    }));

  it('embeds the critical-path task rows as aligned columns in the payload string', () => {
    // The popup renders the payload string verbatim, so its task rows are a real output
    // format — pinned here because the terminal snapshot covers only the terminal path
    // and the Markdown assertions cover only the nested-list path. The same chain as the
    // formatReport snapshot: `c` is filtered out for being under the 20% threshold.
    const a = makeTask('a', { start: 0, end: 10000 });
    const b = makeTask('b', { start: 10000, end: 40000 });
    const c = makeTask('c', { start: 40000, end: 45000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 2, {
      statuses: { a: 'success', b: 'success', c: 'success' },
      remoteCacheEnabled: false,
      isCI: true,
    })!;

    const speedUp = buildExitSummaryPayload(s).recommendations.find((r) =>
      r.startsWith('Speed up or split')
    );
    // Newline-led, two-space indent, four-space gutter, right-aligned durations — the
    // columns the terminal report prints, carried into the payload byte for byte.
    expect(speedUp).toBe(
      'Speed up or split the longest tasks on the critical path:\n' +
        '  b    30.0s\n' +
        '  a    10.0s'
    );
  });

  it('clears the active lifecycle once consumed, so a later flush gets nothing', () =>
    withEnvironmentVariables(envFor({}), () => {
      const a = makeTask('a', { start: 0, end: 1000 });
      const graph = makeGraph([a]);
      feed(makeLifeCycle(graph), graph);

      expect(getPerformanceSummaryPayload()).not.toBeNull();
      // The popup now owns the report; the terminal flush path must not re-render it.
      expect(getPerformanceSummaryPayload()).toBeNull();
    }));

  it('hands the popup the report for multi-task TUI runs, consuming it', () =>
    withEnvironmentVariables({ ...envFor({}), NX_TUI: 'true' }, () => {
      const a = makeTask('a', { start: 0, end: 1000 });
      const b = makeTask('b', { start: 1000, end: 2000 });
      const graph = makeGraph([a, b], { b: ['a'] });
      feed(makeLifeCycle(graph), graph);

      // >1 task under the TUI → the popup gets the payload and owns it.
      expect(getPerformanceReport(2)).not.toBeUndefined();
      expect(getPerformanceSummaryPayload()).toBeNull();
    }));

  it('leaves the report for the flush when there is no TUI popup', () =>
    withEnvironmentVariables({ ...envFor({}), NX_TUI: 'false' }, () => {
      const a = makeTask('a', { start: 0, end: 1000 });
      const b = makeTask('b', { start: 1000, end: 2000 });
      const graph = makeGraph([a, b], { b: ['a'] });
      feed(makeLifeCycle(graph), graph);

      // No TUI → no popup payload, and the report is NOT consumed (the flush prints it).
      expect(getPerformanceReport(2)).toBeUndefined();
      expect(getPerformanceSummaryPayload()).not.toBeNull();
    }));

  it('skips the popup for single-task runs', () =>
    withEnvironmentVariables({ ...envFor({}), NX_TUI: 'true' }, () => {
      const graph = makeGraph([makeTask('a', { start: 0, end: 1000 })]);
      feed(makeLifeCycle(graph), graph);

      expect(getPerformanceReport(1)).toBeUndefined();
      expect(getPerformanceSummaryPayload()).not.toBeNull(); // left for the flush
    }));
});

describe('formatDuration', () => {
  it('shows whole milliseconds below a second', () => {
    expect(formatDuration(470)).toBe('470ms');
    expect(formatDuration(47)).toBe('47ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('handles zero and sub-millisecond instants', () => {
    expect(formatDuration(0)).toBe('<1ms');
    expect(formatDuration(0.4)).toBe('<1ms'); // rounds to 0
    expect(formatDuration(0.6)).toBe('1ms');
  });

  it('shows one decimal from 1s up to a minute', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(3500)).toBe('3.5s');
    expect(formatDuration(13400)).toBe('13.4s');
    expect(formatDuration(18000)).toBe('18.0s');
  });

  it('is consistent across the 10s boundary (no tier jump)', () => {
    expect(formatDuration(9999)).toBe('10.0s');
    expect(formatDuration(10000)).toBe('10.0s');
  });

  it('switches to m/s at a minute and rolls up correctly', () => {
    expect(formatDuration(59500)).toBe('59.5s');
    expect(formatDuration(59950)).toBe('1m 0s'); // rounds to 60.0s → 1m 0s
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(119500)).toBe('2m 0s'); // never "1m 60s"
  });
});

describe('formatReport', () => {
  it('renders the headline, buckets, critical path, and recommendation', () => {
    const a = makeTask('a', { start: 0, end: 20000 });
    const b = makeTask('b', { start: 20000, end: 40000 });
    const report = formatReport(run(makeGraph([a, b]), 1)!);

    expect(report).toContain('Critical path:');
    expect(report).toContain('Recoverable time:');
    // Single recommendation (no cache advice here) stays a plain line, not a list.
    expect(report).toContain('Recommendation:');
  });

  it('OSC 8-links the distribute phrase when hyperlinks are supported', () => {
    // The snapshot test pins the no-OSC-8 form (FORCE_HYPERLINK=0); this pins the other
    // branch: with hyperlinks on, the distribute phrase becomes an OSC 8 link whose visible
    // text is the phrase and whose target carries the utm-tagged agents URL.
    const OSC8 = ']8;;';
    const BEL = '';
    const agentsHref =
      'https://nx.dev/ci/features/distribute-task-execution?utm_source=nx-cli&utm_medium=cli&utm_campaign=performance-report&utm_content=nx-agents';
    const phrase = 'Distribute across machines with Nx Agents';

    const prev = process.env.FORCE_HYPERLINK;
    process.env.FORCE_HYPERLINK = '1';
    try {
      // CI + cold cache + recoverable contention (40% of the run) → the report carries
      // the distribute rec.
      const np = makeTask('np', { start: 0, end: 24000, parallelism: false });
      const q = makeTask('q', { start: 24000, end: 40000 });
      const s = run(makeGraph([np, q]), 2, {
        statuses: { np: 'success', q: 'success' },
        remoteCacheEnabled: false,
        isCI: true,
      })!;
      const report = formatReport(s);

      expect(report).toContain(`${OSC8}${agentsHref}${BEL}${phrase}`);
    } finally {
      if (prev === undefined) {
        delete process.env.FORCE_HYPERLINK;
      } else {
        process.env.FORCE_HYPERLINK = prev;
      }
    }
  });

  it('lists the parallelism lever before the cache recommendation', () => {
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    // Slot-bound run (spare cores), cold cache, no remote → both a parallelism rec
    // and a cache rec. Parallelism (the immediate local lever) comes first.
    const a = makeTask('a', { start: 0, end: 20000 });
    const b = makeTask('b', { start: 20000, end: 40000 });
    const report = formatReport(
      run(makeGraph([a, b]), 1, {
        statuses: { a: 'success', b: 'success' }, // 0/2 hit
        remoteCacheEnabled: false,
      })!
    );

    if (cores >= 2) {
      const parallelAt = report.indexOf('Increase parallelism');
      const cacheAt = report.indexOf('Drastically reduce');
      expect(parallelAt).toBeGreaterThanOrEqual(0);
      expect(cacheAt).toBeGreaterThan(parallelAt);
    }
  });

  it('links the parallelism lever to the perf docs', () => {
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    const PERF_DOCS =
      'https://nx.dev/docs/concepts/ci-concepts/parallelization-distribution?utm_source=nx-cli&utm_medium=cli&utm_campaign=performance-report&utm_content=parallelization';
    // parallel=1, spare cores: `b` queues for the only slot → 50% recoverable by
    // --parallel, so the parallelism lever shows, and it links to the perf docs.
    const a = makeTask('a', { start: 0, end: 20000 });
    const b = makeTask('b', { start: 20000, end: 40000 });
    const s = run(makeGraph([a, b]), 1)!;

    if (cores >= 2) {
      const report = formatReport(s);
      expect(report).toContain('Increase parallelism to recover up to 20.0s');
      expect(report).toContain(PERF_DOCS); // the lever carries the link

      // The phrase rides in the TUI payload's `links` so the popup hyperlinks it.
      const payload = buildExitSummaryPayload(s);
      expect(payload.links).toContainEqual({
        text: 'Increase parallelism to recover up to 20.0s',
        href: PERF_DOCS,
      });
    }
  });

  it('lists recommendations as bullets in priority order (cache before agents)', () => {
    // A CI run with a cache lever (low hits, remote off) and machine-bound contention
    // (40% of the run) yields both, ordered cache → distribute(agents).
    const np = makeTask('np', { start: 0, end: 24000, parallelism: false });
    const q = makeTask('q', { start: 24000, end: 40000 });
    const report = formatReport(
      run(makeGraph([np, q]), 2, {
        statuses: { np: 'success', q: 'success' }, // 0/2 hit
        remoteCacheEnabled: false,
        isCI: true,
      })!
    );

    expect(report).toContain('Recommendations:');
    expect(report).toContain('- Drastically reduce your run duration');
    const cacheAt = report.indexOf('Drastically reduce');
    const distributeAt = report.indexOf('Distribute across machines');
    expect(cacheAt).toBeGreaterThanOrEqual(0);
    expect(cacheAt).toBeLessThan(distributeAt);
  });

  it('lists the cache recommendation before the speed-up table', () => {
    // A cold-cache chain: no parallelism/machine lever, so the recs are the cache CTA
    // followed by the deep manual work (speed up the longest tasks) LAST.
    const a = makeTask('a', { start: 0, end: 10000 });
    const b = makeTask('b', { start: 10000, end: 40000 });
    const report = formatReport(
      run(makeGraph([a, b], { b: ['a'] }), 2, {
        statuses: { a: 'success', b: 'success' }, // 0/2 hit
        remoteCacheEnabled: false,
        isCI: true,
      })!
    );

    expect(report).toContain('Recommendations:');
    expect(report).toMatch(/- Speed up or split/);
    const cacheAt = report.indexOf('Drastically reduce');
    const speedUpAt = report.indexOf('Speed up or split');
    expect(cacheAt).toBeGreaterThanOrEqual(0);
    expect(cacheAt).toBeLessThan(speedUpAt);
  });

  it('lists the critical-path tasks by duration, without wait annotations', () => {
    // The speed-up inline list shows tasks + durations only; waits live in the
    // overhead buckets, not here.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const c = makeTask('c', { start: 2000, end: 3000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1)!;

    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(formatReport(s)).not.toContain('waited');
  });

  it('renders the full report deterministically (snapshot)', () => {
    // Layout/wording safety net. A cold-cache chain yields the richest rendering
    // (cache CTA + multi-line speed-up table, with the sub-20% task `c` filtered
    // out of the table). FORCE_HYPERLINK=0 pins clean text (no OSC 8 escape bytes)
    // so the snapshot is TTY-independent.
    const prev = process.env.FORCE_HYPERLINK;
    process.env.FORCE_HYPERLINK = '0';
    try {
      const a = makeTask('a', { start: 0, end: 10000 });
      const b = makeTask('b', { start: 10000, end: 40000 });
      const c = makeTask('c', { start: 40000, end: 45000 });
      const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 2, {
        statuses: { a: 'success', b: 'success', c: 'success' }, // 0/3 hit, cold cache
        remoteCacheEnabled: false,
        isCI: true,
      })!;
      expect(formatReport(s)).toMatchInlineSnapshot(`
        "  Run duration:      45.0s
          Cache:             0/3 hit (0%)
          Critical path:     45.0s (3 tasks)
          Recoverable time:  <1ms

          Recommendations:
            - Drastically reduce your run duration by sharing a cache across your team and CI → https://nx.dev/ci/features/remote-cache?utm_source=nx-cli&utm_medium=cli&utm_campaign=performance-report&utm_content=remote-cache.
            - Speed up or split the longest tasks on the critical path:
                b    30.0s
                a    10.0s"
      `);
    } finally {
      if (prev === undefined) {
        delete process.env.FORCE_HYPERLINK;
      } else {
        process.env.FORCE_HYPERLINK = prev;
      }
    }
  });
});

describe('summary.failedTasks', () => {
  /** Build a lifecycle, feed it a finished run, and return its summary so `failedTasks` can be inspected. */
  function summaryOf(
    graph: TaskGraph,
    statuses: Record<string, TaskResult['status']> = {}
  ): PerformanceSummary {
    return withEnvironmentVariables(envFor({}), () => {
      const lc = makeLifeCycle(graph);
      lc.endTasks(
        Object.values(graph.tasks).map(
          (task) =>
            ({ task, status: statuses[task.id] }) as unknown as TaskResult
        )
      );
      return lc.getSummary()!;
    });
  }

  it('lists only the failed task ids, slowest first', () => {
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 0, end: 3000 });
    const c = makeTask('c', { start: 0, end: 2000 });
    const s = summaryOf(makeGraph([a, b, c]), {
      a: 'failure',
      b: 'failure',
      c: 'success', // excluded — it passed
    });

    expect(s.failedTasks).toEqual(['b', 'a']);
  });

  it('returns nothing when no task failed', () => {
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 0, end: 2000 });
    const s = summaryOf(makeGraph([a, b]), { a: 'success', b: 'local-cache' });

    expect(s.failedTasks).toEqual([]);
  });

  it('excludes continuous tasks and tasks without a complete window', () => {
    const failed = makeTask('failed', { start: 0, end: 1000 });
    const serve = makeTask('serve', { start: 0, continuous: true }); // no end time
    const partial = makeTask('partial', { start: 5 }); // started, never finished
    const s = summaryOf(makeGraph([failed, serve, partial]), {
      failed: 'failure',
      serve: 'failure',
      partial: 'failure',
    });

    expect(s.failedTasks).toEqual(['failed']);
  });
});

describe('formatReportMarkdown', () => {
  it('renders the report with a failed-tasks list as Markdown (snapshot)', () => {
    // A CI run with a cold cache and no remote yields the richest report; the failed
    // task is surfaced right under the stats.
    const a = makeTask('a', { start: 0, end: 45000 });
    const b = makeTask('b', { start: 0, end: 15000 });
    const s = run(makeGraph([a, b]), 2, {
      statuses: { a: 'failure', b: 'success' },
      remoteCacheEnabled: false,
      isCI: true,
    })!;
    expect(formatReportMarkdown(s, 'run-many -t build')).toMatchInlineSnapshot(`
      "## Nx Run Report — \`run-many -t build\`

      ### ❌ 1 failed task

      - \`a\`

      ### Performance

      - **Run duration:** 45.0s
      - **Cache:** 0/1 hit (0%)
      - **Critical path:** 45.0s (1 task)
      - **Recoverable time:** <1ms

      ### Recommendations

      - [Drastically reduce your run duration by sharing a cache across your team and CI](https://nx.dev/ci/features/remote-cache?utm_source=nx-cli&utm_medium=cli&utm_campaign=performance-report&utm_content=remote-cache).
      - Speed up or split the longest tasks on the critical path:
        - \`a\` — 45.0s"
    `);
  });

  it('reports success instead of a failed-tasks list when nothing failed', () => {
    const a = makeTask('a', { start: 0, end: 1000 });
    const s = run(makeGraph([a]), 1, { statuses: { a: 'success' } })!;

    const md = formatReportMarkdown(s, '');
    expect(md).not.toContain('failed task');
    expect(md).toContain('### ✅ All tasks succeeded');
  });

  it('puts the nx command in the heading so stacked reports stay distinguishable', () => {
    const a = makeTask('a', { start: 0, end: 1000 });
    const s = run(makeGraph([a]), 1, { statuses: { a: 'success' } })!;

    expect(formatReportMarkdown(s, 'run-many -t build test')).toContain(
      '## Nx Run Report — `run-many -t build test`'
    );
  });

  it('renders the distribute recommendation as a phrase Markdown link', () => {
    // Machine-bound contention surfaces a distribute-across-machines rec — a phrase link
    // Markdown renders as the whole sentence linked (to the utm-tagged agents URL).
    const np = makeTask('np', { start: 0, end: 24000, parallelism: false });
    const q = makeTask('q', { start: 24000, end: 40000 });
    const s = run(makeGraph([np, q]), 2, { isCI: true })!;
    const md = formatReportMarkdown(s, '');

    expect(md).toContain(
      '[Distribute across machines with Nx Agents](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx-cli&utm_medium=cli&utm_campaign=performance-report&utm_content=nx-agents)'
    );
  });

  it('renders a phrase recommendation as a single Markdown link (whole sentence linked)', () => {
    // A cold cache with no remote surfaces the remote-cache CTA — a phrase link.
    const a = makeTask('a', { start: 0, end: 35000 });
    const s = run(makeGraph([a]), 1, {
      statuses: { a: 'success' }, // 0/1 hit → low hit rate
      remoteCacheEnabled: false,
      isCI: true,
    })!;

    expect(formatReportMarkdown(s, '')).toContain(
      '[Drastically reduce your run duration by sharing a cache across your team and CI](https://nx.dev/ci/features/remote-cache?utm_source=nx-cli&utm_medium=cli&utm_campaign=performance-report&utm_content=remote-cache)'
    );
  });
});

describe('overlap', () => {
  it('sums the overlap of [a,b] with each interval', () => {
    expect(overlap(0, 10, [[5, 15]])).toBe(5);
    expect(
      overlap(0, 10, [
        [5, 15],
        [20, 30],
      ])
    ).toBe(5);
    expect(
      overlap(0, 100, [
        [10, 20],
        [30, 35],
      ])
    ).toBe(15);
    expect(overlap(0, 10, [[20, 30]])).toBe(0);
  });
});

describe('mergeIntervals', () => {
  it('returns an empty list unchanged', () => {
    expect(mergeIntervals([])).toEqual([]);
  });

  it('sorts and leaves disjoint intervals separate', () => {
    expect(
      mergeIntervals([
        [10, 15],
        [0, 5],
      ])
    ).toEqual([
      [0, 5],
      [10, 15],
    ]);
  });

  it('unions overlapping intervals', () => {
    expect(
      mergeIntervals([
        [0, 5],
        [3, 8],
      ])
    ).toEqual([[0, 8]]);
  });

  it('merges touching intervals (next starts exactly at the previous end)', () => {
    expect(
      mergeIntervals([
        [0, 5],
        [5, 10],
      ])
    ).toEqual([[0, 10]]);
  });

  it('chains a transitive overlap into one interval', () => {
    expect(
      mergeIntervals([
        [10, 15],
        [0, 5],
        [4, 12],
      ])
    ).toEqual([[0, 15]]);
  });
});

describe('preDispatchHashTime', () => {
  it('sums hashing that ran before the first task', () => {
    expect(preDispatchHashTime(1000, [[200, 800]])).toBe(600);
  });

  it('clips a window that overruns the first task start', () => {
    // [200, 1500] is only pre-dispatch up to the first task at 1000.
    expect(preDispatchHashTime(1000, [[200, 1500]])).toBe(800);
  });

  it('unions overlapping windows so shared time is not double-counted', () => {
    expect(
      preDispatchHashTime(1100, [
        [200, 800],
        [600, 1000],
      ])
    ).toBe(800);
  });

  it('stops at a gap wider than the threshold, dropping stale hashing', () => {
    // [0, 500] sits >1s before [2000, 2800] → stale; only the recent window counts.
    expect(
      preDispatchHashTime(3000, [
        [0, 500],
        [2000, 2800],
      ])
    ).toBe(800);
  });

  it('is 0 when nothing hashed before the first task', () => {
    expect(preDispatchHashTime(1000, [])).toBe(0);
    expect(preDispatchHashTime(1000, [[1000, 2000]])).toBe(0); // all after the first task
  });
});

describe('buildTimespans', () => {
  const timed = (
    rows: Array<[string, number, number, boolean?]>
  ): TimedTask[] =>
    rows.map(([id, start, end, nonParallel = false]) => ({
      id,
      start,
      end,
      nonParallel,
    }));

  it('returns no timespans for no tasks', () => {
    expect(buildTimespans([], new Map(), 2)).toEqual([]);
  });

  it('tracks occupancy as tasks overlap', () => {
    // a: [0,10], b: [5,15] → occ ramps 1 → 2 → 1 across the three boundaries.
    const timespans = buildTimespans(
      timed([
        ['a', 0, 10],
        ['b', 5, 15],
      ]),
      new Map(),
      2
    );

    expect(timespans).toEqual([
      { start: 0, end: 5, occ: 1, waiting: 0, nonParallel: 0 },
      { start: 5, end: 10, occ: 2, waiting: 0, nonParallel: 0 },
      { start: 10, end: 15, occ: 1, waiting: 0, nonParallel: 0 },
    ]);
  });

  it('counts a task eligible-but-not-started as waiting', () => {
    // b is eligible at 0 but only starts at 5 while a holds the single slot.
    const timespans = buildTimespans(
      timed([
        ['a', 0, 10],
        ['b', 5, 10],
      ]),
      new Map([['b', 0]]),
      1
    );

    expect(timespans).toEqual([
      { start: 0, end: 5, occ: 1, waiting: 1, nonParallel: 0 },
      { start: 5, end: 10, occ: 2, waiting: 0, nonParallel: 0 },
    ]);
  });

  it('weighs a parallelism:false task as the whole pool', () => {
    // np monopolizes the pool: occ jumps to `parallel` (3), nonParallel counts it.
    const timespans = buildTimespans(
      timed([['np', 0, 10, true]]),
      new Map(),
      3
    );

    expect(timespans).toEqual([
      { start: 0, end: 10, occ: 3, waiting: 0, nonParallel: 1 },
    ]);
  });
});

describe('flushPerformanceReport', () => {
  let logSpy: jest.SpyInstance;
  let logged: string | undefined;

  beforeEach(() => {
    logged = undefined;
    logSpy = jest.spyOn(console, 'log').mockImplementation((msg?: any) => {
      logged = String(msg);
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs the report without a trailing newline (console.log adds the only one)', () =>
    withEnvironmentVariables(envFor({}), () => {
      const a = makeTask('a', { start: 0, end: 1000 });
      feedActive(makeGraph([a]));

      flushPerformanceReport();

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logged).not.toBe('');
      // formatReport doesn't self-terminate; console.log supplies the single newline.
      expect(logged!.endsWith('\n')).toBe(false);
    }));

  it('is a no-op once the payload was already consumed', () =>
    withEnvironmentVariables(envFor({}), () => {
      const a = makeTask('a', { start: 0, end: 1000 });
      feedActive(makeGraph([a]));
      // The TUI path consumes the report via the payload getter first.
      expect(getPerformanceSummaryPayload()).not.toBeNull();

      flushPerformanceReport();

      expect(logSpy).not.toHaveBeenCalled();
    }));

  it('swallows a write failure (cosmetic report never fails the run)', () =>
    withEnvironmentVariables(envFor({}), () => {
      logSpy.mockImplementation(() => {
        throw new Error('EPIPE');
      });
      const a = makeTask('a', { start: 0, end: 1000 });
      feedActive(makeGraph([a]));

      expect(() => flushPerformanceReport()).not.toThrow();
    }));

  it('appends the report (command in heading, failed-tasks table) to the GitHub Actions job summary', () => {
    const dir = mkdtempSync(join(os.tmpdir(), 'nx-perf-gha-'));
    const summaryFile = join(dir, 'summary.md');
    const originalArgv = process.argv;
    // currentNxCommand() reads argv after the node + nx-bin entries.
    process.argv = ['node', '/path/to/nx', 'run-many', '-t', 'build'];
    try {
      withEnvironmentVariables(
        {
          ...envFor({}),
          GITHUB_ACTIONS: 'true',
          GITHUB_STEP_SUMMARY: summaryFile,
          // Simulate a top-level invocation; `nx test` sets this on the jest task's env.
          NX_TASK_TARGET_PROJECT: null,
        },
        () => {
          const a = makeTask('a', { start: 0, end: 1000 });
          feedActive(makeGraph([a]), 'failure');
          flushPerformanceReport();
        }
      );

      const written = readFileSync(summaryFile, 'utf-8');
      expect(written).toContain('## Nx Run Report — `run-many -t build`');
      expect(written).toContain('### ❌ 1 failed task');
      expect(written).toContain('- `a`');
      // Trailing newline so a later step's summary content starts on its own line.
      expect(written.endsWith('\n')).toBe(true);
    } finally {
      process.argv = originalArgv;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not write a job summary outside GitHub Actions', () => {
    const dir = mkdtempSync(join(os.tmpdir(), 'nx-perf-gha-'));
    const summaryFile = join(dir, 'summary.md');
    try {
      withEnvironmentVariables(
        // GITHUB_STEP_SUMMARY points somewhere writable, but GITHUB_ACTIONS is unset.
        {
          ...envFor({}),
          GITHUB_ACTIONS: null,
          GITHUB_STEP_SUMMARY: summaryFile,
        },
        () => {
          const a = makeTask('a', { start: 0, end: 1000 });
          feedActive(makeGraph([a]));
          flushPerformanceReport();
        }
      );

      expect(existsSync(summaryFile)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not write a job summary for a nested nx run (only the outer run writes)', () => {
    const dir = mkdtempSync(join(os.tmpdir(), 'nx-perf-gha-'));
    const summaryFile = join(dir, 'summary.md');
    try {
      withEnvironmentVariables(
        {
          ...envFor({}),
          GITHUB_ACTIONS: 'true',
          GITHUB_STEP_SUMMARY: summaryFile,
          // Set on every task's env by Nx; a nested nx inherits it, marking it as not
          // the top-level invocation.
          NX_TASK_TARGET_PROJECT: 'some-app',
        },
        () => {
          const a = makeTask('a', { start: 0, end: 1000 });
          feedActive(makeGraph([a]));
          flushPerformanceReport();
        }
      );

      expect(existsSync(summaryFile)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Constructing a lifecycle registers it as the module-level
  // `activePerformanceLifeCycle`, which is what flush reads.
  function feedActive(
    graph: TaskGraph,
    status: TaskResult['status'] = 'success'
  ) {
    const lc = makeLifeCycle(graph);
    lc.endTasks(
      Object.values(graph.tasks).map(
        (task) => ({ task, status }) as unknown as TaskResult
      )
    );
  }
});

describe('parallel value', () => {
  it('reports the --parallel passed at construction (continuous slots excluded)', () =>
    withEnvironmentVariables(envFor({}), () => {
      // The runner hands the lifecycle getThreadPoolSize().discrete = --parallel (with
      // continuous excluded) as startCommand's second arg. Pin that seam + that the
      // lifecycle reports it verbatim, so a regression in either fails here instead of
      // silently skewing the recommendations.
      const discrete = makeTask('d', { start: 0, end: 1000 });
      const c1 = makeTask('c1', { continuous: true });
      const c2 = makeTask('c2', { continuous: true });
      const graph = makeGraph([discrete, c1, c2]);

      const { discrete: parallel, total } = getThreadPoolSize(
        { parallel: 3 } as any,
        graph
      );
      expect(parallel).toBe(3); // continuous tasks don't count toward --parallel

      const lc = makeLifeCycle(graph, {});
      lc.startCommand(total, parallel);
      lc.endTasks([
        { task: discrete, status: 'success' } as unknown as TaskResult,
      ]);

      expect(lc.getSummary()!.parallel).toBe(parallel);
    }));
});
