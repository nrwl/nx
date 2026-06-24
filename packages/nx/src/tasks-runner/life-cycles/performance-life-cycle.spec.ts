import * as os from 'node:os';
import { Task, TaskGraph } from '../../config/task-graph';
import { TaskResult } from '../life-cycle';
import {
  PerformanceLifeCycle,
  flushPerformanceReport,
  getPerformanceSummaryPayload,
  overlap,
} from './performance-life-cycle';
import { formatDuration, formatReport } from './performance-report';
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
}

/** Construct a PerformanceLifeCycle with its env-dependent signals injected. */
function makeLifeCycle(
  graph: TaskGraph,
  env: TestEnv = {}
): PerformanceLifeCycle {
  return new PerformanceLifeCycle(graph, {
    hashWindows: () => env.windows ?? [],
    cacheSkipped: () => env.skipped ?? false,
    remoteCacheEnabled: () => env.remoteCache ?? true,
    isCI: () => env.isCI ?? false,
    distributingTasks: () => env.distributing ?? false,
  });
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
  } = {}
) {
  const lc = makeLifeCycle(graph, {
    windows: opts.hashWindows,
    skipped: opts.cacheSkipped,
    remoteCache: opts.remoteCacheEnabled,
    isCI: opts.isCI,
    distributing: opts.distributing,
  });
  lc.startCommand(total);
  for (const taskIds of opts.batches ?? []) {
    lc.registerRunningBatch('batch', { executorName: 'e', taskIds } as never);
  }
  const results = Object.values(graph.tasks).map(
    (task) =>
      ({ task, status: opts.statuses?.[task.id] }) as unknown as TaskResult
  );
  lc.endTasks(results);
  return lc.getSummary();
}

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
    expect(report).toContain('Run duration:              0ms');
    expect(report).not.toContain('NaN');
    expect(report).not.toContain('Infinity');
  });

  it('reports zero overhead and a dependency-gated chain for a single chain', () => {
    const a = makeTask('a', { start: 0, end: 10 });
    const b = makeTask('b', { start: 10, end: 20 });
    const c = makeTask('c', { start: 20, end: 30 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1)!;

    expect(s.runDuration).toBe(30);
    expect(s.criticalPathDuration).toBe(30);
    expect(s.overhead).toBe(0);
    expect(s.finishChain.map((g) => g.id)).toEqual(['a', 'b', 'c']);
    expect(s.finishChain.map((g) => g.gate)).toEqual(['root', 'dep', 'dep']);
  });

  it('reports zero overhead when everything runs in parallel', () => {
    const tasks = ['a', 'b', 'c', 'd', 'e'].map((id) =>
      makeTask(id, { start: 0, end: 10 })
    );
    const s = run(makeGraph(tasks), 5)!;

    expect(s.runDuration).toBe(10);
    expect(s.overhead).toBe(0);
    expect(s.recoverableByParallel).toBe(0);
    expect(s.finishChain).toHaveLength(1);
    expect(s.finishChain[0].gate).toBe('root');
  });

  it('attributes slot queuing (spare cores) to recoverable-by-parallelism', () => {
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    // parallel=1. `a` holds the only slot 0–1000; `b` is independent, eligible at
    // the run start, and queues for the slot until 1000 → recoverable by slots.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const s = run(makeGraph([a, b]), 1, { isCI: true })!;

    expect(s.overhead).toBe(1000);
    // cores-dependent split; only the sum is robustly assertable.
    expect(s.recoverableByParallel + s.recoverableByMachines).toBe(1000);
    expect(s.coordinatorOverhead).toBe(0);
    const recs = s.recommendations.join('\n');
    if (cores >= 2) {
      // 50% slot wait (>20%) with spare cores → --parallel leads, agents not yet.
      expect(recs).toContain('Increase parallelism');
      expect(recs).toMatch(/recover up to 1\.0s/);
      expect(recs).not.toContain('Nx Agents');
    } else {
      // Single core → no --parallel headroom, so agents is the lever (CI run).
      expect(recs).toContain('Nx Agents');
    }
    // `b` finished last but is NOT on the critical path (`a` is, same duration);
    // the finish lineage still surfaces b's slot wait so the bucket has a source.
    const bLink = s.finishChain.find((g) => g.id === 'b')!;
    expect(bLink.gate).toBe('slot');
    expect(bLink.wait).toBe(1000);
  });

  it('measures scheduling latency: a ready task idle while a slot is free', () => {
    // parallel=2, both independent. `b` is eligible at the run start but doesn't
    // start until 100 — 100ms of ready work on a free slot (occ < parallel). Pure
    // dispatch latency, not contention → schedulingOverhead, not the recoverable split.
    const a = makeTask('a', { start: 0, end: 10 });
    const b = makeTask('b', { start: 100, end: 110 });
    const s = run(makeGraph([a, b]), 2)!;

    expect(s.schedulingOverhead).toBe(100);
    expect(s.recoverableByParallel + s.recoverableByMachines).toBe(0);
  });

  it('excludes hashing from scheduling latency', () => {
    // Same free-slot stall, but the coordinator was hashing [10,60] of it → that
    // 50ms is hashing, not scheduling, so it's subtracted: 100 − 50 = 50.
    const a = makeTask('a', { start: 0, end: 10 });
    const b = makeTask('b', { start: 100, end: 110 });
    const s = run(makeGraph([a, b]), 2, { hashWindows: [[10, 60]] })!;

    expect(s.schedulingOverhead).toBe(50);
  });

  it('displays the critical path, separate from the finish lineage, when they diverge', () => {
    // parallel=1: `a` holds the only slot 0–1000 (the critical path); `b` queues
    // and finishes last (the finish lineage). We display `a`; b's off-path slot
    // wait lives in the recoverable-by-parallel bucket.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const s = run(makeGraph([a, b]), 1)!;

    expect(s.finishChain.map((c) => c.id)).toEqual(['b']); // attribution basis
    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['a']); // the critical path
  });

  it('displays only the longest few critical-path tasks, not the whole chain', () => {
    // Contiguous chain of five increasing-length tasks (no gaps → zero overhead);
    // the display shows the top three by duration, not all five.
    const durs = [100, 200, 300, 400, 500];
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

  it('attributes a wait with free slots to coordinator overhead', () => {
    // `x` is eligible at 0 but starts at 5000 with free slots and nothing running
    // → not slot contention, pure coordinator time.
    const early = makeTask('early', { start: 0, end: 100 });
    const x = makeTask('x', { start: 5000, end: 6000 });
    const s = run(makeGraph([early, x]), 4, { isCI: true })!;

    expect(s.recoverableByParallel).toBe(0);
    expect(s.recoverableByMachines).toBe(0);
    expect(s.coordinatorOverhead).toBe(5000);
    expect(s.finishChain[0]).toMatchObject({ id: 'x', gate: 'other' });
    // Coordinator (5s) dwarfs the work (1s critical path) → dominated: recommend
    // Nx Agents (CI run), drop the longest-tasks section, and don't restate the
    // coordinator-overhead number (it's a header stat).
    expect(s.coordinatorDominated).toBe(true);
    const recs = s.recommendations.join('\n');
    expect(recs).toContain('about as fast as this machine');
    expect(recs).toContain('Nx Agents');
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
    // critical path = `a` (2s); `x` finishes last after a 4.8s coordinator wait →
    // coordinator ~3s, only ~1.5x the critical path (not >3x). A cold run with
    // real work like this isn't "maxed" — stay critical-path-bound and show tasks.
    const early = makeTask('early', { start: 0, end: 100 });
    const a = makeTask('a', { start: 0, end: 2000 });
    const x = makeTask('x', { start: 4800, end: 5000 });
    const s = run(makeGraph([early, a, x]), 4)!;

    expect(s.criticalPathDuration).toBe(2000);
    expect(s.coordinatorOverhead).toBeGreaterThan(2000); // > critical path...
    expect(s.coordinatorDominated).toBe(false); // ...but not >3x → not dominated
    const report = formatReport(s);
    expect(report).toContain('Speed up or split the longest tasks');
    expect(report).toContain('on the critical path');
  });

  it('recommends the biggest critical-path tasks (and agents in CI) when no parallelism lever helps', () => {
    // Pure dependency chain at its floor (no overhead). Advice names the longest
    // tasks to speed up and (in CI) offers agents — not a higher --parallel.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 4000 });
    const c = makeTask('c', { start: 4000, end: 5000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1, {
      isCI: true,
    })!;

    expect(s.overhead).toBe(0);
    const recs = s.recommendations.join('\n');
    expect(recs).toContain('Speed up or split');
    expect(recs).toContain('longest tasks on the critical path');
    expect(recs).toContain('b'); // the longest task, listed inline
    expect(s.criticalPathTop[0].id).toBe('b');
    // A separate rec offers Nx Agents; neither suggests a higher --parallel.
    expect(recs).toContain('Nx Agents');
    expect(recs).not.toContain('--parallel');
    expect(s.recommendations.length).toBe(2); // speed-up + distribute, separate
  });

  it('keeps a small --parallel win in the header, not the recommendation', () => {
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    // parallel=1. `a` holds the only slot 0–500; `b` queues 500ms then runs
    // 500–3500. 500ms recoverable is below the 20% lead threshold → advice is
    // critical-path (not slot), small win shows as a header stat.
    const a = makeTask('a', { start: 0, end: 500 });
    const b = makeTask('b', { start: 500, end: 3500 });
    const s = run(makeGraph([a, b]), 1)!;

    if (cores >= 2) {
      expect(s.recoverableByParallel).toBe(500);
      const recs = s.recommendations.join('\n');
      expect(recs).toContain('Speed up or split');
      expect(recs).not.toContain('--parallel');
      expect(formatReport(s)).toMatch(/Recoverable time:\s+500ms/);
    }
  });

  it('omits the distribute (agents) recommendation outside CI', () => {
    // Same chain as the CI case but local: agents are CI-only, so the only lever
    // shown is speeding up the longest tasks.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 4000 });
    const c = makeTask('c', { start: 4000, end: 5000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1, {
      isCI: false,
    })!;

    expect(s.recommendations.length).toBe(1); // just speed-up, no distribute
    expect(s.recommendations[0]).toContain('Speed up or split');
    expect(s.recommendations.join('\n')).not.toContain('Nx Agents');
  });

  it('omits the distribute recommendation when already distributing (CI)', () => {
    // Already on Nx Agents and no slot contention → only the critical-path
    // speed-up; no "start distributing" recommendation.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 4000 });
    const c = makeTask('c', { start: 4000, end: 5000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1, {
      isCI: true,
      distributing: true,
    })!;

    expect(s.recommendations.length).toBe(1); // just speed-up
    expect(s.recommendations.join('\n')).not.toContain('Nx Agents');
  });

  it('recommends more agents (with the recoverable figure) when distributing', () => {
    // Slot contention on a distributed run → the lever is more agents, not local
    // --parallel; figure is the total recoverable slot-contention time (1.0s).
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const s = run(makeGraph([a, b]), 1, { distributing: true })!;

    const recs = s.recommendations.join('\n');
    expect(recs).toContain('Add more Nx Agents to recover up to');
    expect(recs).toMatch(/recover up to 1\.0s/);
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

    const e2eLink = s.finishChain.find((g) => g.id === 'e2e')!;
    expect(e2eLink.wait).toBe(0);
    expect(e2eLink.gate).toBe('root');
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
    expect(s.finishChain.map((g) => g.id)).toEqual(['a', 'b']);
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
    const np = makeTask('np', { start: 0, end: 1000, parallelism: false });
    const x = makeTask('x', { start: 1000, end: 2000 });
    const s = run(makeGraph([np, x]), 2)!;

    expect(s.recoverableByMachines).toBe(1000);
    expect(s.recoverableByParallel).toBe(0);
    expect(s.recommendations.join('\n')).not.toContain('Increase parallelism');
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
    // Fill every core 0–1000, then one more task queues at full cores.
    const fillers = Array.from({ length: cores }, (_, i) =>
      makeTask(`f${i}`, { start: 0, end: 1000 })
    );
    const waiter = makeTask('w', { start: 1000, end: 2000 });
    const s = run(makeGraph([...fillers, waiter]), cores, { isCI: true })!;

    expect(s.recoverableByMachines).toBe(1000);
    expect(s.recoverableByParallel).toBe(0);
    expect(s.recommendations.join('\n')).toContain('Nx Agents');
  });

  it('drops agents (keeps the --parallel tip) for a machine-bound run outside CI', () => {
    const cores = Math.max(
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length,
      os.cpus().length
    );
    const fillers = Array.from({ length: cores }, (_, i) =>
      makeTask(`f${i}`, { start: 0, end: 1000 })
    );
    const waiter = makeTask('w', { start: 1000, end: 2000 });
    const s = run(makeGraph([...fillers, waiter]), cores, { isCI: false })!;

    const recs = s.recommendations.join('\n');
    expect(recs).not.toContain('Nx Agents');
    expect(recs).toContain('a higher --parallel may help');
  });

  it('makes no recommendation (and lists no tasks) when the critical path was fully cached', () => {
    // Fully-cached run: the "longest tasks" are cache restores, so there's nothing
    // to speed up — don't recommend it, and don't list restore times.
    const a = makeTask('a', { start: 0, end: 30 });
    const b = makeTask('b', { start: 30, end: 50 });
    const c = makeTask('c', { start: 50, end: 60 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 4, {
      statuses: { a: 'local-cache', b: 'local-cache', c: 'remote-cache' },
    })!;

    expect(s.cacheHits).toBe(3);
    expect(s.criticalPathTop).toHaveLength(0); // all cached → nothing to show
    expect(s.recommendations).toHaveLength(0);
    expect(formatReport(s)).not.toContain('Speed up or split');
  });

  it('lists only the critical-path tasks that ran (not cache hits) in the speed-up', () => {
    // `b` ran (cache miss); `a` and `c` were cached → only `b` is worth speeding up.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 4000 });
    const c = makeTask('c', { start: 4000, end: 5000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1, {
      statuses: { a: 'local-cache', b: 'success', c: 'local-cache' },
    })!;

    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['b']);
    expect(formatReport(s)).toContain('Speed up or split');
  });

  it('makes no recommendation for a dominated run outside CI (nothing actionable)', () => {
    // Maxed for this machine with no agents lever → nothing to suggest, so the
    // report omits the recommendation entirely.
    const early = makeTask('early', { start: 0, end: 100 });
    const x = makeTask('x', { start: 5000, end: 6000 });
    const s = run(makeGraph([early, x]), 4, { isCI: false })!;

    expect(s.coordinatorDominated).toBe(true);
    expect(s.recommendations).toHaveLength(0);
    expect(formatReport(s)).not.toContain('Recommendation');
  });

  it('classifies a free-slot wait that overlaps a hashing window as hashing', () => {
    const core = makeTask('core', { start: 0, end: 1000 });
    const t = makeTask('t', { start: 3000, end: 4000 });
    const graph = makeGraph([core, t], { t: ['core'] });
    // t is eligible at 1000 but starts at 3000 with free slots; the coordinator
    // was hashing 1000–3000.
    const s = run(graph, 4, { hashWindows: [[1000, 3000]] })!;

    const tLink = s.finishChain.find((g) => g.id === 't')!;
    expect(tLink.gate).toBe('hashing');
    expect(s.recoverableByParallel).toBe(0);
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

    expect(s.finishChain.map((g) => g.id)).toEqual(['build']);
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
    const a = makeTask('a', { start: 0, end: 1000 });
    const s = run(makeGraph([a]), 1, {
      statuses: { a: 'success' }, // 0/1 hit
      remoteCacheEnabled: false,
    })!;

    expect(s.remoteCacheEnabled).toBe(false);
    const report = formatReport(s);
    // No-TTY jest env → linkify is a no-op → the tagged URL prints verbatim.
    expect(report).toContain('sharing a cache across your team and CI');
    expect(report).toContain(
      'https://nx.dev/ci/features/remote-cache?utm=performance-report'
    );
  });

  it('renders the remote-cache rec as a whole-phrase OSC 8 link (no raw URL) on a hyperlink terminal', () => {
    // FORCE_HYPERLINK overrides the TTY/CI checks in supportsHyperlinks, flipping
    // linkify on inside the no-TTY jest env.
    const prev = process.env.FORCE_HYPERLINK;
    process.env.FORCE_HYPERLINK = '1';
    try {
      const a = makeTask('a', { start: 0, end: 1000 });
      const s = run(makeGraph([a]), 1, {
        statuses: { a: 'success' }, // 0/1 hit
        remoteCacheEnabled: false,
      })!;

      const report = formatReport(s);
      // The whole sentence is the OSC 8 link (visible text), utm-tagged page as
      // the hidden target — never a raw URL. Sequence: ESC]8;; <target> BEL <phrase>.
      const OSC8 = ']8;;';
      expect(report).toContain(
        `${OSC8}https://nx.dev/ci/features/remote-cache?utm=performance-reportDrastically reduce your run duration by sharing a cache across your team and CI`
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
      makeTask(id, { start: 0, end: 10 })
    );
    const s = run(makeGraph(tasks), 3, {
      statuses: { a: 'local-cache', b: 'local-cache', c: 'local-cache' }, // 3/3 hit
      remoteCacheEnabled: false,
    })!;

    expect(s.cacheHits).toBe(3);
    expect(formatReport(s)).not.toContain('sharing a cache across your team');
  });

  it('omits the cache recommendation when remote cache is already on', () => {
    const a = makeTask('a', { start: 0, end: 1000 });
    const s = run(makeGraph([a]), 1, {
      statuses: { a: 'success' },
      remoteCacheEnabled: true,
    })!;

    expect(formatReport(s)).not.toContain('sharing a cache across your team');
  });

  it('warns (and only warns) when the cache was skipped', () => {
    const a = makeTask('a', { start: 0, end: 1000 });
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
    lc.startCommand(1);
    lc.endTasks(
      Object.values(graph.tasks).map(
        (task) => ({ task }) as unknown as TaskResult
      )
    );
  }

  it('builds the structured payload the TUI pulls at endCommand', () => {
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
  });

  it('carries the footer + remote-cache links as data (popup hardcodes no URLs)', () => {
    // Cold cache, remote off → the remote-cache CTA is recommended, so it's
    // surfaced as a link for the popup to hyperlink in place.
    const a = makeTask('a', { start: 0, end: 1000 });
    const graph = makeGraph([a]);
    const lc = makeLifeCycle(graph, { remoteCache: false });
    lc.startCommand(1);
    lc.endTasks([{ task: a, status: 'success' } as unknown as TaskResult]);

    const payload = getPerformanceSummaryPayload()!;
    // The docs footer link travels as data (label + tagged href).
    expect(payload.footer).toEqual({
      text: "Learn how to improve your run's performance",
      href: 'https://nx.dev/docs/concepts/ci-concepts/parallelization-distribution?utm=performance-report',
    });
    // The CTA link text matches the phrase in the recommendation, so the popup
    // links the text it was handed without a byte-identical constant of its own.
    expect(payload.links).toEqual([
      {
        text: 'Drastically reduce your run duration by sharing a cache across your team and CI',
        href: 'https://nx.dev/ci/features/remote-cache?utm=performance-report',
      },
    ]);
    expect(
      payload.recommendations.some((r) => r.includes(payload.links[0].text))
    ).toBe(true);
  });

  it('clears the active lifecycle once consumed, so a later flush gets nothing', () => {
    const a = makeTask('a', { start: 0, end: 1000 });
    const graph = makeGraph([a]);
    feed(makeLifeCycle(graph), graph);

    expect(getPerformanceSummaryPayload()).not.toBeNull();
    // The popup now owns the report; the terminal flush path must not re-render it.
    expect(getPerformanceSummaryPayload()).toBeNull();
  });
});

describe('formatDuration', () => {
  it('shows whole milliseconds below a second', () => {
    expect(formatDuration(470)).toBe('470ms');
    expect(formatDuration(47)).toBe('47ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('handles zero and sub-millisecond instants', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(0.4)).toBe('0ms'); // rounds toward zero
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
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const report = formatReport(run(makeGraph([a, b]), 1)!);

    expect(report).toContain('Critical path:');
    expect(report).toContain('Recoverable time:');
    // Single recommendation (no cache advice here) stays a plain line, not a list.
    expect(report).toContain('Recommendation:');
  });

  it('OSC 8-links the footer and agents URLs when hyperlinks are supported', () => {
    // The snapshot test pins the no-OSC-8 form (FORCE_HYPERLINK=0); this pins the
    // other branch: with hyperlinks on, the footer AND agents URL become OSC 8
    // links whose visible text is the clean URL and whose target carries the utm tag.
    const OSC8 = ']8;;';
    const BEL = '';
    const footerHref =
      'https://nx.dev/docs/concepts/ci-concepts/parallelization-distribution?utm=performance-report';
    const footerVisible =
      'https://nx.dev/docs/concepts/ci-concepts/parallelization-distribution';
    const agentsHref =
      'https://nx.dev/ci/features/distribute-task-execution?utm=performance-report';
    const agentsVisible =
      'https://nx.dev/ci/features/distribute-task-execution';

    const prev = process.env.FORCE_HYPERLINK;
    process.env.FORCE_HYPERLINK = '1';
    try {
      // CI + cold cache → the report carries both the agents rec and the footer.
      const a = makeTask('a', { start: 0, end: 1000 });
      const s = run(makeGraph([a]), 1, {
        statuses: { a: 'success' },
        remoteCacheEnabled: false,
        isCI: true,
      })!;
      const report = formatReport(s);

      expect(report).toContain(`${OSC8}${footerHref}${BEL}${footerVisible}`);
      expect(report).toContain(`${OSC8}${agentsHref}${BEL}${agentsVisible}`);
      // Outside the escape the clean visible URL is shown, not the tagged target.
      expect(report).not.toContain(`→ ${footerHref}`);
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
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
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

  it('lists recommendations as bullets in priority order (cache, agents, then tasks)', () => {
    // A CI run with a cache lever (low hits, remote off) yields all three, ordered
    // cache → distribute(agents) → speed-up (the deep manual work) LAST.
    const a = makeTask('a', { start: 0, end: 1000 });
    const report = formatReport(
      run(makeGraph([a]), 1, {
        statuses: { a: 'success' }, // 0/1 hit
        remoteCacheEnabled: false,
        isCI: true,
      })!
    );

    expect(report).toContain('Recommendations:');
    expect(report).toContain('- Drastically reduce your run duration');
    expect(report).toMatch(/- Speed up or split/);
    const cacheAt = report.indexOf('Drastically reduce');
    const distributeAt = report.indexOf('Distribute tasks');
    const speedUpAt = report.indexOf('Speed up or split');
    expect(cacheAt).toBeGreaterThanOrEqual(0);
    expect(cacheAt).toBeLessThan(distributeAt);
    expect(distributeAt).toBeLessThan(speedUpAt);
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
    // Layout/wording safety net. A CI run with cold cache and no remote yields the
    // richest report (cache CTA + agents + speed-up table + footer). FORCE_HYPERLINK=0
    // pins clean text (no OSC 8 escape bytes) so the snapshot is TTY-independent.
    const prev = process.env.FORCE_HYPERLINK;
    process.env.FORCE_HYPERLINK = '0';
    try {
      const a = makeTask('a', { start: 0, end: 1000 });
      const s = run(makeGraph([a]), 1, {
        statuses: { a: 'success' }, // 0/1 hit, cold cache
        remoteCacheEnabled: false,
        isCI: true,
      })!;
      expect(formatReport(s)).toMatchInlineSnapshot(`
        "  Run duration:              1.0s
          Cache:                     0/1 hit (0%)
          Critical path:             1.0s   (1 task)
          Recoverable time:          0ms

          Recommendations:
            - Drastically reduce your run duration by sharing a cache across your team and CI → https://nx.dev/ci/features/remote-cache?utm=performance-report.
            - Distribute tasks across multiple machines with Nx Agents to increase parallelism without overwhelming resource usage → https://nx.dev/ci/features/distribute-task-execution?utm=performance-report.
            - Speed up or split the longest tasks on the critical path:
                a    1.0s

          Learn how to improve your run's performance → https://nx.dev/docs/concepts/ci-concepts/parallelization-distribution?utm=performance-report
        "
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

describe('flushPerformanceReport', () => {
  let writeSpy: jest.SpyInstance;
  let written: string;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    written = '';
    originalIsTTY = process.stdout.isTTY;
    writeSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: any) => {
        written += String(chunk);
        return true;
      });
  });

  afterEach(() => {
    writeSpy.mockRestore();
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
  });

  function setTTY(isTTY: boolean) {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: isTTY,
      configurable: true,
    });
  }

  it('ends piped output in exactly one trailing newline', () => {
    setTTY(false);
    const a = makeTask('a', { start: 0, end: 1000 });
    feedActive(makeGraph([a]));

    flushPerformanceReport();

    expect(written).not.toBe('');
    expect(written.endsWith('\n')).toBe(true);
    expect(written.endsWith('\n\n')).toBe(false);
    expect(written).not.toContain('\r\n');
  });

  it('uses CRLF on a TTY (terminal may still be in raw mode)', () => {
    setTTY(true);
    const a = makeTask('a', { start: 0, end: 1000 });
    feedActive(makeGraph([a]));

    flushPerformanceReport();

    expect(written).toContain('\r\n');
    expect(written.endsWith('\r\n')).toBe(true);
    // A bare "\n" (not part of "\r\n") would staircase a raw terminal.
    expect(/(?<!\r)\n/.test(written)).toBe(false);
  });

  it('is a no-op once the payload was already consumed', () => {
    setTTY(false);
    const a = makeTask('a', { start: 0, end: 1000 });
    feedActive(makeGraph([a]));
    // The TUI path consumes the report via the payload getter first.
    expect(getPerformanceSummaryPayload()).not.toBeNull();

    flushPerformanceReport();

    expect(written).toBe('');
  });

  it('swallows a write failure (cosmetic report never fails the run)', () => {
    setTTY(false);
    writeSpy.mockImplementation(() => {
      throw new Error('EPIPE');
    });
    const a = makeTask('a', { start: 0, end: 1000 });
    feedActive(makeGraph([a]));

    expect(() => flushPerformanceReport()).not.toThrow();
  });

  // Constructing a lifecycle registers it as the module-level
  // `activePerformanceLifeCycle`, which is what flush reads.
  function feedActive(graph: TaskGraph) {
    const lc = makeLifeCycle(graph);
    lc.startCommand(1);
    lc.endTasks(
      Object.values(graph.tasks).map(
        (task) => ({ task, status: 'success' }) as unknown as TaskResult
      )
    );
  }
});

describe('getThreadPoolSize → startCommand contract', () => {
  it('recovers --parallel exactly from the total fed to startCommand', () => {
    // getThreadPoolSize hands startCommand `--parallel + continuousCount`; the
    // lifecycle subtracts the continuous count to recover --parallel. Pin both
    // ends of that seam so a refactor that passes discrete-only (or stops adding
    // the continuous count) fails here instead of silently miscomputing every
    // parallelism recommendation.
    const discrete = makeTask('d', { start: 0, end: 1000 });
    const c1 = makeTask('c1', { continuous: true });
    const c2 = makeTask('c2', { continuous: true });
    const graph = makeGraph([discrete, c1, c2]);

    const { discrete: parallelArg, total } = getThreadPoolSize(
      { parallel: 3 } as any,
      graph
    );
    expect(parallelArg).toBe(3);
    expect(total).toBe(5); // 3 (--parallel) + 2 continuous

    const lc = makeLifeCycle(graph);
    lc.startCommand(total);
    lc.endTasks([
      { task: discrete, status: 'success' } as unknown as TaskResult,
    ]);

    expect(lc.getSummary()!.parallel).toBe(parallelArg);
  });
});
