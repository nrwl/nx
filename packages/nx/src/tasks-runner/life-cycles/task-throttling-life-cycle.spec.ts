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
    roots: tasks
      .filter((t) => (deps[t.id] ?? []).length === 0)
      .map((t) => t.id),
    tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
    dependencies: Object.fromEntries(
      tasks.map((t) => [t.id, deps[t.id] ?? []])
    ),
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
    lc.registerRunningBatch('batch', {
      executorName: 'e',
      taskIds,
    } as never);
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
    const graph = makeGraph([makeTask('a')]); // no start/end
    expect(run(graph, 4)).toBeNull();
  });

  it('reports zero contention for a single dependency chain', () => {
    // a -> b -> c, each 10ms, run back-to-back. Critical path == run.
    const a = makeTask('a', { start: 0, end: 10 });
    const b = makeTask('b', { start: 10, end: 20 });
    const c = makeTask('c', { start: 20, end: 30 });
    const graph = makeGraph([a, b, c], { b: ['a'], c: ['b'] });

    const s = run(graph, 1)!;

    expect(s.runDuration).toBe(30);
    expect(s.criticalPathDuration).toBe(30);
    expect(s.criticalPathTasks).toEqual(['a', 'b', 'c']);
    expect(s.slotContentionCost).toBe(0);
  });

  it('reports zero contention when everything runs in parallel', () => {
    // 5 independent 10ms tasks, all overlapping, 5 slots.
    const tasks = ['a', 'b', 'c', 'd', 'e'].map((id) =>
      makeTask(id, { start: 0, end: 10 })
    );
    const graph = makeGraph(tasks);

    const s = run(graph, 5)!;

    expect(s.runDuration).toBe(10);
    expect(s.criticalPathDuration).toBe(10);
    expect(s.slotContentionCost).toBe(0);
    expect(s.slotBound).toBe(false);
  });

  it('attributes the e2e-tail case to the critical path, not the last task', () => {
    // dep (10) then 8 e2e tasks all depending on it, --parallel=4.
    // Schedule: e2e durations 60,50,45,40,30,25,20,15.
    const dep = makeTask('dep', { start: 0, end: 10 });
    const e2e = [
      makeTask('e0', { start: 10, end: 70 }), // 60
      makeTask('e1', { start: 10, end: 60 }), // 50
      makeTask('e2', { start: 10, end: 55 }), // 45
      makeTask('e3', { start: 10, end: 50 }), // 40
      makeTask('e4', { start: 50, end: 80 }), // 30
      makeTask('e5', { start: 55, end: 80 }), // 25
      makeTask('e6', { start: 60, end: 80 }), // 20
      makeTask('e7', { start: 70, end: 85 }), // 15 — finishes last
    ];
    const deps = Object.fromEntries(e2e.map((t) => [t.id, ['dep']]));
    const graph = makeGraph([dep, ...e2e], deps);

    const readyTimes = {
      dep: 0,
      e0: 10,
      e1: 10,
      e2: 10,
      e3: 10,
      e4: 10,
      e5: 10,
      e6: 10,
      e7: 10,
    };
    const s = run(graph, 4, readyTimes)!;

    expect(s.runDuration).toBe(85);
    // Critical path is dep -> e0 (10 + 60), NOT the chain ending at e7.
    expect(s.criticalPathDuration).toBe(70);
    expect(s.criticalPathTasks).toEqual(['dep', 'e0']);
    expect(s.criticalPathLongest).toEqual({ id: 'e0', duration: 60 });
    // 85 wall-clock − 70 critical path = 15 recoverable with infinite slots.
    expect(s.slotContentionCost).toBe(15);
    expect(s.totalWork).toBe(295);
    expect(s.parallel).toBe(4);
    // totalWork/parallel = 73.75 > 70 critical path → slot-bound.
    expect(s.slotBound).toBe(true);
    // Longest critical-path tasks, sorted by duration: e0 (60) then dep (10).
    expect(s.criticalPathTop.map((t) => t.id)).toEqual(['e0', 'dep']);
    expect(s.criticalPathTop[0]).toEqual({ id: 'e0', duration: 60, wait: 0 });
  });

  it('excludes continuous tasks from the calculation', () => {
    const serve = makeTask('serve', { continuous: true }); // no end time
    const build = makeTask('build', { start: 0, end: 20 });
    const graph = makeGraph([serve, build]);

    const s = run(graph, 2)!;

    expect(s.criticalPathTasks).toEqual(['build']);
    expect(s.runDuration).toBe(20);
    expect(s.slotContentionCost).toBe(0);
  });

  it('splits critical-path wait into slot wait, hashing, and spawn', () => {
    // a -> b. b becomes ready at 10, acquires a slot at 13 (3ms slot wait),
    // then starts at 15 (2ms spawn/setup). No hash perf measures in the test,
    // so hashing is 0 and the three components sum to criticalPathWait.
    const a = makeTask('a', { start: 0, end: 10 });
    const b = makeTask('b', { start: 15, end: 25 });
    const graph = makeGraph([a, b], { b: ['a'] });

    const s = run(graph, 1, { a: 0, b: 10 }, { a: 0, b: 13 })!;

    expect(s.criticalPathTasks).toEqual(['a', 'b']);
    expect(s.criticalPathSlotWait).toBe(3);
    expect(s.criticalPathSpawn).toBe(2);
    expect(s.criticalPathHashing).toBe(0);
    expect(s.criticalPathWait).toBe(5);
  });

  it('does not count sequential batch execution as critical-path wait', () => {
    // a and b are INDEPENDENT but run in one batch process, queued (ready) at 0.
    // a runs 0–20, then b runs 20–50 (sequential). b is the longest task, so the
    // critical path is [b]. Without batch awareness, b would show a 20ms "wait"
    // that's really a executing; with it, b waited 0 (the batch reached it).
    const a = makeTask('a', { start: 0, end: 20 });
    const b = makeTask('b', { start: 20, end: 50 });
    const graph = makeGraph([a, b]); // no dependency between them

    const s = run(graph, 1, { a: 0, b: 0 }, {}, [['a', 'b']])!;

    expect(s.criticalPathTasks).toEqual(['b']);
    expect(s.criticalPathWait).toBe(0);
    // Invariant: critical-path wait can never exceed run overhead.
    expect(s.criticalPathWait).toBeLessThanOrEqual(s.slotContentionCost);
  });

  it('recovers discrete parallelism when continuous tasks share the pool', () => {
    // total pool = 5, one continuous task → discrete parallel should be 4.
    const serve = makeTask('serve', { continuous: true });
    const build = makeTask('build', { start: 0, end: 20 });
    const graph = makeGraph([serve, build]);

    const s = run(graph, 5)!;

    expect(s.parallel).toBe(4);
  });
});
