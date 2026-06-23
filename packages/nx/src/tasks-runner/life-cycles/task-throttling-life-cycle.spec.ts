import * as os from 'node:os';
import { Task, TaskGraph } from '../../config/task-graph';
import { TaskResult } from '../life-cycle';
import {
  TaskThrottlingLifeCycle,
  formatDuration,
  formatReport,
  getThrottleExitSummaryPayload,
  overlap,
} from './task-throttling-life-cycle';

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

/** A lifecycle whose env-dependent signals can be injected for tests. */
class TestThrottle extends TaskThrottlingLifeCycle {
  constructor(
    graph: TaskGraph,
    private readonly env: {
      windows?: Array<[number, number]>;
      skipped?: boolean;
      remoteCache?: boolean;
      isCI?: boolean;
      distributing?: boolean;
    } = {}
  ) {
    super(graph);
  }
  protected hashWindows(): Array<[number, number]> {
    return this.env.windows ?? [];
  }
  protected cacheSkipped(): boolean {
    return this.env.skipped ?? false;
  }
  protected remoteCacheEnabled(): boolean {
    return this.env.remoteCache ?? true;
  }
  protected isCI(): boolean {
    return this.env.isCI ?? false;
  }
  protected distributingTasks(): boolean {
    return this.env.distributing ?? false;
  }
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
  const lc = new TestThrottle(graph, {
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

describe('TaskThrottlingLifeCycle', () => {
  it('returns null when there are no discrete task timings', () => {
    expect(run(makeGraph([makeTask('a')]), 4)).toBeNull();
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
    // parallel=1. `a` holds the only slot 0–1000. `b` is independent, eligible at
    // the run start, and queues for the slot until 1000 → recoverable by slots.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const s = run(makeGraph([a, b]), 1, { isCI: true })!;

    expect(s.overhead).toBe(1000);
    // cores-dependent split; the sum is what's robustly assertable.
    expect(s.recoverableByParallel + s.recoverableByMachines).toBe(1000);
    expect(s.coordinatorOverhead).toBe(0);
    const recs = s.recommendations.join('\n');
    if (cores >= 2) {
      // 50% of the run is slot wait (>20%), so --parallel leads. There are still
      // spare cores, so step up local parallelism — and DON'T point at agents
      // yet. The recommendation quotes the recoverable-by-parallel amount (1.0s
      // here) as the concrete payoff.
      expect(recs).toContain('Increase parallelism');
      expect(recs).toMatch(/recover up to 1\.0s/);
      expect(recs).not.toContain('Nx Agents');
    } else {
      // Single core → no --parallel headroom, so agents is the lever (CI run).
      expect(recs).toContain('Nx Agents');
    }
    // `b` finished last but is NOT on the critical path (`a` is, same duration).
    // The finish lineage still surfaces b's slot wait, so the bucket has a
    // visible source instead of "recoverable" with no slot wait shown anywhere.
    const bLink = s.finishChain.find((g) => g.id === 'b')!;
    expect(bLink.gate).toBe('slot');
    expect(bLink.wait).toBe(1000);
  });

  it('displays the critical path, separate from the finish lineage, when they diverge', () => {
    // parallel=1: `a` holds the only slot 0–1000 — that's the critical path.
    // `b` is independent, queues for the slot, and finishes last — that's the
    // finish lineage. We display the critical path's longest tasks (`a`); b's
    // off-path slot wait lives in the recoverable-by-parallel bucket.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const s = run(makeGraph([a, b]), 1)!;

    expect(s.finishChain.map((c) => c.id)).toEqual(['b']); // attribution basis
    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['a']); // the critical path
  });

  it('displays only the longest few critical-path tasks, not the whole chain', () => {
    // A contiguous dependency chain of five tasks of increasing length (no gaps →
    // zero overhead). The display shows the top three by duration, not all five.
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
    // `early` defines the run start; `x` is eligible at 0 but starts at 5000 with
    // free slots and nothing running → not slot contention, pure coordinator time.
    const early = makeTask('early', { start: 0, end: 100 });
    const x = makeTask('x', { start: 5000, end: 6000 });
    const s = run(makeGraph([early, x]), 4, { isCI: true })!;

    expect(s.recoverableByParallel).toBe(0);
    expect(s.recoverableByMachines).toBe(0);
    expect(s.coordinatorOverhead).toBe(5000);
    expect(s.finishChain[0]).toMatchObject({ id: 'x', gate: 'other' });
    // Coordinator (5s) dwarfs the actual work (1s critical path) → dominated:
    // the machine is maxed, so recommend Nx Agents (CI run) and drop the
    // longest-tasks section (nothing meaningful to "speed up"). The recommendation
    // doesn't restate the coordinator-overhead number — that's a header stat.
    expect(s.coordinatorDominated).toBe(true);
    const recs = s.recommendations.join('\n');
    expect(recs).toContain('about as fast as this machine');
    expect(recs).toContain('Nx Agents');
    expect(recs).not.toContain('coordinator overhead');
    // Dominated → only the agents lever; no "speed up these tasks" list.
    expect(recs).not.toContain('Speed up or split');
    expect(formatReport(s)).not.toContain('longest tasks on the critical path');
  });

  it('recovers slot contention at low parallelism even when an idle gap follows it', () => {
    // Regression: at low --parallel, a long coordinator gap after a burst of slot
    // contention used to swallow the WHOLE overhead into "non-recoverable",
    // reporting 0 recoverable. Here `c0`/`c1` saturate both slots 0–1000 while
    // `w` queues behind them (real slot contention), then the coordinator sits
    // idle 1000–5000 before `w` runs. The 1s of contention is recoverable; only
    // the 4s idle gap is non-recoverable coordinator overhead.
    const c0 = makeTask('c0', { start: 0, end: 1000 });
    const c1 = makeTask('c1', { start: 0, end: 1000 });
    const w = makeTask('w', { start: 5000, end: 6000 });
    const s = run(makeGraph([c0, c1, w]), 2)!;

    expect(s.overhead).toBe(5000);
    // cores-dependent parallel/machines split; assert the robust sum + remainder.
    expect(s.recoverableByParallel + s.recoverableByMachines).toBe(1000);
    expect(s.coordinatorOverhead).toBe(4000);
  });

  it('stays critical-path-bound (shows tasks) when coordinator only slightly exceeds the work', () => {
    // critical path = `a` (2s of real work); `x` finishes last after a 4.8s
    // coordinator wait → coordinator ~3s, only ~1.5x the critical path (not >3x).
    // A cold run with real work like this should NOT be called "maxed" — it stays
    // critical-path-bound so the slowest tasks are shown to look into.
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
    // A pure dependency chain at its floor (no overhead). The advice should name
    // the longest tasks to speed up, and (in CI) offer agents — not a higher
    // --parallel.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 4000 });
    const c = makeTask('c', { start: 4000, end: 5000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1, {
      isCI: true,
    })!;

    expect(s.overhead).toBe(0);
    const recs = s.recommendations.join('\n');
    expect(recs).toContain('Speed up or split');
    // Names the tasks inline (own recommendation), longest first.
    expect(recs).toContain('longest tasks on the critical path');
    expect(recs).toContain('b'); // the longest task, listed inline
    expect(s.criticalPathTop[0].id).toBe('b');
    // A separate recommendation offers Nx Agents (free up CPU for the chain), but
    // neither recommendation suggests a higher --parallel.
    expect(recs).toContain('Nx Agents');
    expect(recs).not.toContain('--parallel');
    expect(s.recommendations.length).toBe(2); // speed-up + distribute, separate
  });

  it('keeps a small --parallel win in the header, not the recommendation', () => {
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    // parallel=1. `a` holds the only slot 0–500; `b` queues 500ms then runs the
    // long leg 500–3500. 500ms recoverable is below the 20% lead threshold, so the
    // advice is critical-path (not slot), and the small win shows as a header stat.
    const a = makeTask('a', { start: 0, end: 500 });
    const b = makeTask('b', { start: 500, end: 3500 });
    const s = run(makeGraph([a, b]), 1)!;

    if (cores >= 2) {
      expect(s.recoverableByParallel).toBe(500);
      const recs = s.recommendations.join('\n');
      expect(recs).toContain('Speed up or split');
      expect(recs).not.toContain('--parallel');
      // The 500ms win is a header stat, not restated in the recommendation.
      expect(formatReport(s)).toMatch(/Recoverable time:\s+500ms/);
    }
  });

  it('omits the distribute (agents) recommendation outside CI', () => {
    // Same critical-path chain as the CI case, but local: agents distribute across
    // CI machines, so the only lever shown is speeding up the longest tasks.
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
    // Already on Nx Agents and no slot contention → nothing to suggest but the
    // critical-path speed-up; no "start distributing" recommendation.
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
    // --parallel. The figure is the total recoverable slot-contention time (1.0s).
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const s = run(makeGraph([a, b]), 1, { distributing: true })!;

    const recs = s.recommendations.join('\n');
    expect(recs).toContain('Add more Nx Agents to recover up to');
    expect(recs).toMatch(/recover up to 1\.0s/);
    expect(recs).not.toContain('Increase parallelism');
  });

  it('treats a wait for a continuous dependency to start as eligibility, not contention', () => {
    // `serve` (continuous) comes up at 3000; `d` holds the only slot 0–3000.
    // `e2e` depends on serve and starts at 3000 — it was never slot-blocked, it
    // was waiting for serve. Its wait must be 0 (eligible at serve's start), so
    // the 3000 lands in coordinator overhead, not recoverable-by-parallelism.
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
    // a and b are independent but in one batch; the batch runs them sequentially
    // in one process (a 0–1000, then b 1000–2000). That ordering is part of the
    // floor, so the perfectly-packed run has zero overhead.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const s = run(makeGraph([a, b]), 1, { batches: [['a', 'b']] })!;

    expect(s.overhead).toBe(0);
    expect(s.coordinatorOverhead).toBe(0);
    expect(s.recoverableByParallel).toBe(0);
    expect(s.finishChain.map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('treats a parallelism:false task as occupying the whole pool', () => {
    // `np` runs alone (parallelism:false), so while it runs the machine is
    // saturated and `x` (eligible at 0) is genuinely slot-blocked, not idle.
    const np = makeTask('np', { start: 0, end: 1000, parallelism: false });
    const x = makeTask('x', { start: 1000, end: 2000 });
    const s = run(makeGraph([np, x]), 2)!;

    expect(s.overhead).toBe(1000);
    expect(s.recoverableByParallel + s.recoverableByMachines).toBe(1000);
    expect(s.coordinatorOverhead).toBe(0);
  });

  it('attributes volume beyond one machine to recoverable-by-machines even when parallel < cores', () => {
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    // 3×cores independent tasks serialized at parallel=1. totalWork = 3·cores·1000,
    // so totalWork/cores − criticalPath = 3000 − 1000 = 2000 of machine-bound
    // volume that raising --parallel alone cannot recover.
    const n = cores * 3;
    const tasks = Array.from({ length: n }, (_, i) =>
      makeTask(`t${i}`, { start: i * 1000, end: (i + 1) * 1000 })
    );
    const s = run(makeGraph(tasks), 1)!;

    if (cores >= 2) {
      // parallel(1) < cores → the split is by work invariant, not observed occ.
      expect(s.recoverableByMachines).toBe(2000);
      // ...and the rest is still recoverable by raising --parallel (both > 0,
      // which the old observed-occupancy split could never produce).
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
    // Fill every core 0–1000, then one more task queues for a slot at full cores.
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
    // A small fully-cached run: the "longest tasks" are cache restores, so there's
    // nothing to speed up — don't recommend it, and don't list restore times.
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

    // Only `b` (the task that ran) is a speed-up candidate; `a` and `c` are cached.
    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['b']);
    expect(formatReport(s)).toContain('Speed up or split');
  });

  it('makes no recommendation for a dominated run outside CI (nothing actionable)', () => {
    // Fully maxed for this machine with no agents lever (e.g. a 100%-cached run) →
    // nothing to suggest, so the report omits the recommendation entirely.
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
    // A fast run: the one task restores in 100ms (1000→1100), but the coordinator
    // hashed 200→800 before dispatching it. That 600ms of pre-dispatch hashing is
    // coordinator overhead the task window alone would miss.
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
    // FORCE_HYPERLINK takes precedence over the TTY/CI checks in
    // supportsHyperlinks, so it flips linkify on inside the no-TTY jest env.
    const prev = process.env.FORCE_HYPERLINK;
    process.env.FORCE_HYPERLINK = '1';
    try {
      const a = makeTask('a', { start: 0, end: 1000 });
      const s = run(makeGraph([a]), 1, {
        statuses: { a: 'success' }, // 0/1 hit
        remoteCacheEnabled: false,
      })!;

      const report = formatReport(s);
      // The whole sentence is the OSC 8 link (visible text), with the utm-tagged
      // page as the hidden target — never a raw URL in the text. Sequence (see
      // terminalLink): ESC]8;; <target> BEL <phrase> ...
      const OSC8 = ']8;;';
      expect(report).toContain(
        `${OSC8}https://nx.dev/ci/features/remote-cache?utm=performance-reportDrastically reduce your run duration by sharing a cache across your team and CI`
      );
      // The remote-cache URL must NOT appear as plain visible text: every
      // occurrence is immediately preceded by the OSC 8 target preamble.
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
    // Stat shows the skip state; advice says how to fix it. No hit-rate noise.
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
  function feed(lc: TestThrottle, graph: TaskGraph) {
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
    feed(new TestThrottle(graph), graph);

    const payload = getThrottleExitSummaryPayload();
    expect(payload).not.toBeNull();
    // The TUI builds the visual from these stats (not a pre-formatted string).
    expect(payload!.runDurationMs).toBe(2000);
    expect(payload!.criticalPathMs).toBe(2000);
    expect(payload!.criticalPathTaskCount).toBe(2);
    expect(Array.isArray(payload!.recommendations)).toBe(true);
  });

  it('clears the active lifecycle once consumed, so a later flush gets nothing', () => {
    const a = makeTask('a', { start: 0, end: 1000 });
    const graph = makeGraph([a]);
    feed(new TestThrottle(graph), graph);

    expect(getThrottleExitSummaryPayload()).not.toBeNull();
    // The popup now owns the report; the terminal flush path must not re-render it.
    expect(getThrottleExitSummaryPayload()).toBeNull();
  });
});

describe('formatDuration', () => {
  it('shows whole milliseconds below a second', () => {
    expect(formatDuration(470)).toBe('470ms');
    expect(formatDuration(47)).toBe('47ms');
    expect(formatDuration(999)).toBe('999ms');
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
    // Run duration is shown alongside the recoverable (slot-contention) time.
    expect(report).toContain('Recoverable time:');
    // Single recommendation (no cache advice here) stays a plain line.
    expect(report).toContain('Recommendation:');
  });

  it('lists the parallelism lever before the cache recommendation', () => {
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    // Slot-bound run (spare cores) with a cold cache and no remote → both a
    // parallelism rec and a cache recommendation. Parallelism (the immediate local
    // lever) comes first, then cache.
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
    // A CI run with a cache lever (low hits, remote off) yields all three: cache,
    // agents, and the longest-tasks advice — rendered as a bulleted list, ordered
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
    expect(report).toMatch(/- Speed up or split/); // the speed recommendation
    const cacheAt = report.indexOf('Drastically reduce');
    const distributeAt = report.indexOf('Distribute tasks');
    const speedUpAt = report.indexOf('Speed up or split');
    expect(cacheAt).toBeGreaterThanOrEqual(0);
    expect(cacheAt).toBeLessThan(distributeAt);
    expect(distributeAt).toBeLessThan(speedUpAt);
  });

  it('lists the critical-path tasks by duration, without wait annotations', () => {
    // The inline list in the speed-up recommendation shows tasks + durations
    // only; waits never appear there (they live in the overhead buckets).
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const c = makeTask('c', { start: 2000, end: 3000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1)!;

    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(formatReport(s)).not.toContain('waited');
  });

  it('renders the full report deterministically (snapshot)', () => {
    // Layout/wording safety net for the formatter. A CI run with a cold cache and
    // no remote yields the richest report: cache CTA + agents + the speed-up table
    // + footer. FORCE_HYPERLINK=0 pins clean text (no OSC 8 escape bytes) so the
    // snapshot is stable regardless of the runner's TTY.
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
          Critical path:             1.0s   (1 tasks)
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
