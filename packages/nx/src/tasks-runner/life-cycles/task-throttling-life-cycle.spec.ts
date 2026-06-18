import * as os from 'node:os';
import { Task, TaskGraph } from '../../config/task-graph';
import { TaskResult } from '../life-cycle';
import {
  TaskThrottlingLifeCycle,
  formatDuration,
  formatReport,
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

/** A lifecycle whose hashing windows can be injected for the hashing-gate test. */
class TestThrottle extends TaskThrottlingLifeCycle {
  constructor(
    graph: TaskGraph,
    private readonly windows: Array<[number, number]>
  ) {
    super(graph);
  }
  protected hashWindows(): Array<[number, number]> {
    return this.windows;
  }
}

/** Feed a lifecycle a full run and return its summary. */
function run(
  graph: TaskGraph,
  total: number,
  opts: { batches?: string[][]; hashWindows?: Array<[number, number]> } = {}
) {
  const lc = new TestThrottle(graph, opts.hashWindows ?? []);
  lc.startCommand(total);
  for (const taskIds of opts.batches ?? []) {
    lc.registerRunningBatch('batch', { executorName: 'e', taskIds } as never);
  }
  const results = Object.values(graph.tasks).map(
    (task) => ({ task }) as unknown as TaskResult
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
    // parallel=1. `a` holds the only slot 0–1000. `b` is independent, eligible at
    // the run start, and queues for the slot until 1000 → recoverable by slots.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 2000 });
    const s = run(makeGraph([a, b]), 1)!;

    expect(s.overhead).toBe(1000);
    // cores-dependent split; the sum is what's robustly assertable.
    expect(s.recoverableByParallel + s.recoverableByMachines).toBe(1000);
    expect(s.coordinatorOverhead).toBe(0);
    expect(s.recommendation).toContain('queuing for slots');
    // `b` finished last but is NOT on the critical path (`a` is, same duration).
    // The finish lineage still surfaces b's slot wait, so the bucket has a
    // visible source instead of "recoverable" with no slot wait shown anywhere.
    const bLink = s.finishChain.find((g) => g.id === 'b')!;
    expect(bLink.gate).toBe('slot');
    expect(bLink.wait).toBe(1000);
  });

  it('attributes a wait with free slots to coordinator overhead', () => {
    // `early` defines the run start; `x` is eligible at 0 but starts at 5000 with
    // free slots and nothing running → not slot contention, pure coordinator time.
    const early = makeTask('early', { start: 0, end: 100 });
    const x = makeTask('x', { start: 5000, end: 6000 });
    const s = run(makeGraph([early, x]), 4)!;

    expect(s.recoverableByParallel).toBe(0);
    expect(s.recoverableByMachines).toBe(0);
    expect(s.coordinatorOverhead).toBe(5000);
    expect(s.finishChain[0]).toMatchObject({ id: 'x', gate: 'other' });
    // Coordinator overhead is footnoted, but the actionable advice names the
    // biggest task on the critical path to speed up.
    expect(s.recommendation).toContain('coordinator');
    expect(s.recommendation).toContain('x (1.0s)');
  });

  it('recommends the biggest critical-path tasks when no parallelism lever helps', () => {
    // A pure dependency chain at its floor (no overhead). The advice should name
    // the longest tasks on the path to speed up — not a parallelism lever.
    const a = makeTask('a', { start: 0, end: 1000 });
    const b = makeTask('b', { start: 1000, end: 4000 });
    const c = makeTask('c', { start: 4000, end: 5000 });
    const s = run(makeGraph([a, b, c], { b: ['a'], c: ['b'] }), 1)!;

    expect(s.overhead).toBe(0);
    expect(s.recommendation).toContain('Speed up or split');
    expect(s.recommendation).toContain('critical path');
    expect(s.recommendation).toContain('b (3.0s)'); // longest, listed first
    expect(s.recommendation).not.toContain('--parallel');
    expect(s.recommendation).not.toContain('Nx Cloud Agents');
  });

  it('mentions a sub-meaningful parallel win as secondary when critical-path-bound', () => {
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    // parallel=1. `a` holds the only slot 0–500. `b` is independent, eligible at
    // the run start, queues 500ms for the slot, then runs the long leg 500–3500.
    // The floor is b's 3000ms; the 500ms slot wait is a real but minor --parallel
    // win below the lead threshold — it should be mentioned, not flatly denied.
    const a = makeTask('a', { start: 0, end: 500 });
    const b = makeTask('b', { start: 500, end: 3500 });
    const s = run(makeGraph([a, b]), 1)!;

    if (cores >= 2) {
      expect(s.recoverableByParallel).toBe(500);
      expect(s.recommendation).toContain('mostly bound by the critical path');
      expect(s.recommendation).toContain('Raising --parallel');
      expect(s.recommendation).toContain('would recover ~500ms more');
      expect(s.recommendation).toContain('b (3.0s)');
      // Not the primary "raise --parallel" headline (that needs a >=1s win) and
      // not the flat denial (that's only for a ~0 parallel win).
      expect(s.recommendation).not.toContain('queuing for slots');
      expect(s.recommendation).not.toContain("won't make this run faster");
    }
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
    const s = run(makeGraph([...fillers, waiter]), cores)!;

    expect(s.recoverableByMachines).toBe(1000);
    expect(s.recoverableByParallel).toBe(0);
    expect(s.recommendation).toContain('Nx Cloud Agents');
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

    expect(report).toContain('Throttle report:');
    expect(report).toContain('Critical-path floor:');
    expect(report).toContain('recoverable by --parallel');
    expect(report).toContain('coordinator overhead (hashing/scheduling)');
    expect(report).toContain('What determined the');
    expect(report).toContain('Recommendation:');
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
