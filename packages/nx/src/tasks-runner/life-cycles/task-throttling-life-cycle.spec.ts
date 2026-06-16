import { Task, TaskGraph } from '../../config/task-graph';
import { TaskResult } from '../life-cycle';
import { TaskThrottlingLifeCycle } from './task-throttling-life-cycle';

function makeTask(
  id: string,
  opts: { start?: number; end?: number; continuous?: boolean } = {}
): Task {
  return {
    id,
    target: { project: id, target: 'build' },
    overrides: {},
    outputs: [],
    parallelism: true,
    continuous: opts.continuous ?? false,
    startTime: opts.start,
    endTime: opts.end,
  } as unknown as Task;
}

function makeGraph(
  tasks: Task[],
  deps: Record<string, string[]> = {}
): TaskGraph {
  return {
    roots: tasks.filter((t) => (deps[t.id] ?? []).length === 0).map((t) => t.id),
    tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
    dependencies: Object.fromEntries(tasks.map((t) => [t.id, deps[t.id] ?? []])),
    continuousDependencies: Object.fromEntries(tasks.map((t) => [t.id, []])),
  } as unknown as TaskGraph;
}

/** Feed a lifecycle a full run and return its summary. */
function run(
  graph: TaskGraph,
  total: number,
  readyTimes: Record<string, number> = {},
  dispatchTimes: Record<string, number> = {},
  batches: string[][] = []
) {
  const lc = new TaskThrottlingLifeCycle(graph);
  lc.startCommand(total);
  for (const taskIds of batches) {
    lc.registerRunningBatch('batch', { executorName: 'e', taskIds } as never);
  }
  for (const [id, readyTime] of Object.entries(readyTimes)) {
    lc.setTaskReadyTime(id, readyTime);
  }
  for (const [id, dispatchTime] of Object.entries(dispatchTimes)) {
    lc.setTaskDispatchTime(id, dispatchTime);
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
    const graph = makeGraph([a, b, c], { b: ['a'], c: ['b'] });

    const s = run(graph, 1)!;

    expect(s.runDuration).toBe(30);
    expect(s.criticalPathDuration).toBe(30);
    expect(s.slotContentionCost).toBe(0);
    expect(s.gatingChain.map((g) => g.id)).toEqual(['a', 'b', 'c']);
    expect(s.gatingChain.map((g) => g.gate)).toEqual(['root', 'dep', 'dep']);
  });

  it('reports zero overhead when everything runs in parallel', () => {
    const tasks = ['a', 'b', 'c', 'd', 'e'].map((id) =>
      makeTask(id, { start: 0, end: 10 })
    );
    const s = run(makeGraph(tasks), 5)!;

    expect(s.runDuration).toBe(10);
    expect(s.slotContentionCost).toBe(0);
    expect(s.slotBound).toBe(false);
    expect(s.gatingChain).toHaveLength(1);
    expect(s.gatingChain[0].gate).toBe('root');
  });

  it('finds the slot-gated finish chain in the e2e-tail case', () => {
    // dep (10) then 8 e2e tasks depending on it, --parallel=4. e7 finishes last,
    // gated by the SLOT that e0 held (e7 does not depend on e0).
    const dep = makeTask('dep', { start: 0, end: 10 });
    const e2e = [
      makeTask('e0', { start: 10, end: 70 }),
      makeTask('e1', { start: 10, end: 60 }),
      makeTask('e2', { start: 10, end: 55 }),
      makeTask('e3', { start: 10, end: 50 }),
      makeTask('e4', { start: 50, end: 80 }),
      makeTask('e5', { start: 55, end: 80 }),
      makeTask('e6', { start: 60, end: 80 }),
      makeTask('e7', { start: 70, end: 85 }),
    ];
    const deps = Object.fromEntries(e2e.map((t) => [t.id, ['dep']]));
    const graph = makeGraph([dep, ...e2e], deps);
    const readyTimes = Object.fromEntries(
      [dep, ...e2e].map((t) => [t.id, t.id === 'dep' ? 0 : 10])
    );

    const s = run(graph, 4, readyTimes)!;

    expect(s.criticalPathDuration).toBe(70);
    expect(s.slotContentionCost).toBe(15);
    expect(s.slotBound).toBe(true);
    // Finish chain: dep → e0 (held the slot) → e7 (slot-gated by e0).
    expect(s.gatingChain.map((g) => g.id)).toEqual(['dep', 'e0', 'e7']);
    expect(s.gatingChain.find((g) => g.id === 'e7')!.gate).toBe('slot');
  });

  it('attributes a wait to the task that freed the slot', () => {
    // parallel=1. `hog` holds the slot 0–1400. `b` is independent and longest,
    // ready at 1000, starts at 1600 when hog frees the slot → slot-gated by hog.
    const hog = makeTask('hog', { start: 0, end: 1400 });
    const b = makeTask('b', { start: 1600, end: 3200 });
    const s = run(makeGraph([hog, b]), 1, { hog: 0, b: 1000 })!;

    expect(s.gatingChain.map((g) => g.id)).toEqual(['hog', 'b']);
    expect(s.gatingChain[1].gate).toBe('slot');
  });

  it('labels a wait with free slots as other, not slot-gated', () => {
    // x is ready at 0 but starts at 5000 with 4 free slots and nothing running.
    const x = makeTask('x', { start: 5000, end: 6000 });
    const s = run(makeGraph([x]), 4, { x: 0 })!;

    expect(s.gatingChain).toHaveLength(1);
    expect(s.gatingChain[0].gate).toBe('other');
  });

  it('excludes continuous tasks from the calculation', () => {
    const serve = makeTask('serve', { continuous: true });
    const build = makeTask('build', { start: 0, end: 20 });
    const s = run(makeGraph([serve, build]), 2)!;

    expect(s.criticalPathTasks).toEqual(['build']);
    expect(s.gatingChain.map((g) => g.id)).toEqual(['build']);
  });

  it('recovers discrete parallelism when continuous tasks share the pool', () => {
    const serve = makeTask('serve', { continuous: true });
    const build = makeTask('build', { start: 0, end: 20 });
    const s = run(makeGraph([serve, build]), 5)!;

    expect(s.parallel).toBe(4);
  });

  it('treats a batch as sequential, with no phantom slot wait', () => {
    // a and b are independent but in one batch; a runs 0–20, then b 20–50.
    // b's effective ready is a's end (20), so it started immediately → not gated
    // by a slot, no phantom wait.
    const a = makeTask('a', { start: 0, end: 20 });
    const b = makeTask('b', { start: 20, end: 50 });
    const s = run(makeGraph([a, b]), 1, { a: 0, b: 0 }, {}, [['a', 'b']])!;

    expect(s.gatingChain.find((g) => g.id === 'b')?.gate).not.toBe('slot');
  });
});
