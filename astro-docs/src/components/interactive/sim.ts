// Tiny discrete-event CI scheduler used by the blog figures. Every number a
// figure shows (wall clock, VM-minutes, utilization) comes out of this, so the
// toggles compare real schedules of the same task set, not hand-placed bars.

export interface SimTask {
  id: string;
  label: string;
  /** minutes */
  dur: number;
  deps?: string[];
  /** CPU units the task uses while it runs (default 1). */
  cpu?: number;
  /** Visual grouping, e.g. 'build' | 'test' | 'e2e'. */
  kind?: string;
}

export interface SimOptions {
  workers: number;
  /** CPU units per worker. */
  capacity: number;
  /**
   * 'slots': fixed `parallel` tasks per worker, regardless of what they use.
   * 'pack': fit tasks by CPU into free capacity (first-fit, contiguous units).
   */
  mode: 'slots' | 'pack';
  slots?: number;
  /** 'fifo' = definition order, 'critical' = longest remaining chain first. */
  priority: 'fifo' | 'critical';
  /** Minute at which each worker comes online (default 0). */
  workerStart?: number[];
  /**
   * Order to offer free workers in at minute `now` (default: by index).
   * Real agents pull work whenever they free up, so a dependent task does
   * not stay on the machine that ran its dependency.
   */
  workerOrder?: (
    now: number,
    workers: number,
    task: SimTask,
    bars: SimBar[]
  ) => number[];
}

export interface SimBar {
  task: SimTask;
  worker: number;
  start: number;
  end: number;
  /** Row offset inside the worker lane: slot index or first CPU unit. */
  row: number;
  /** Rows the bar covers (slots: 1, pack: cpu units). */
  span: number;
}

export interface SimResult {
  bars: SimBar[];
  makespan: number;
  /** Sum over workers of (makespan - online time). */
  vmMinutes: number;
  /** Sum of cpu * duration. */
  cpuMinutes: number;
  /** cpuMinutes / (vmMinutes * capacity). */
  utilization: number;
}

/** Longest duration from the start of each task to the end of the graph. */
export function remainingChain(tasks: SimTask[]): Map<string, number> {
  const dependents = new Map<string, SimTask[]>();
  for (const t of tasks) {
    for (const d of t.deps ?? []) {
      if (!dependents.has(d)) dependents.set(d, []);
      dependents.get(d)!.push(t);
    }
  }
  const memo = new Map<string, number>();
  const visit = (t: SimTask): number => {
    if (memo.has(t.id)) return memo.get(t.id)!;
    const after = Math.max(0, ...(dependents.get(t.id) ?? []).map(visit));
    const v = t.dur + after;
    memo.set(t.id, v);
    return v;
  };
  tasks.forEach(visit);
  return memo;
}

export function simulate(tasks: SimTask[], opts: SimOptions): SimResult {
  const chain = remainingChain(tasks);
  const order = new Map(tasks.map((t, i) => [t.id, i]));
  const workerStart = Array.from(
    { length: opts.workers },
    (_, i) => opts.workerStart?.[i] ?? 0
  );
  const rows = opts.mode === 'slots' ? (opts.slots ?? 1) : opts.capacity;
  // occupied[w][row] = minute the row frees up
  const occupied = workerStart.map(() => new Array<number>(rows).fill(0));
  const done = new Map<string, number>();
  const started = new Set<string>();
  const bars: SimBar[] = [];
  let now = 0;

  const ready = () =>
    tasks
      .filter(
        (t) =>
          !started.has(t.id) &&
          (t.deps ?? []).every((d) => done.has(d) && done.get(d)! <= now)
      )
      .sort((a, b) =>
        opts.priority === 'critical'
          ? chain.get(b.id)! - chain.get(a.id)! ||
            order.get(a.id)! - order.get(b.id)!
          : order.get(a.id)! - order.get(b.id)!
      );

  let guard = 0;
  while (started.size < tasks.length && guard++ < 10000) {
    for (const t of ready()) {
      const need = opts.mode === 'slots' ? 1 : Math.min(t.cpu ?? 1, rows);
      let placed = false;
      const offer =
        opts.workerOrder?.(now, opts.workers, t, bars) ??
        Array.from({ length: opts.workers }, (_, i) => i);
      for (const w of offer) {
        if (placed) break;
        if (workerStart[w] > now) continue;
        const free = occupied[w];
        for (let r = 0; r + need <= rows; r++) {
          let ok = true;
          for (let k = r; k < r + need; k++) if (free[k] > now) ok = false;
          if (!ok) continue;
          const end = now + t.dur;
          for (let k = r; k < r + need; k++) free[k] = end;
          bars.push({
            task: t,
            worker: w,
            start: now,
            end,
            row: r,
            span: need,
          });
          started.add(t.id);
          done.set(t.id, end);
          placed = true;
          break;
        }
      }
      // Not placed: stays ready, a smaller task behind it may still fit.
    }
    // Advance to the next moment something frees up or a worker comes online.
    const candidates = [...bars.map((b) => b.end), ...workerStart].filter(
      (x) => x > now
    );
    if (candidates.length === 0) break;
    now = Math.min(...candidates);
  }

  const makespan = Math.max(0, ...bars.map((b) => b.end));
  const vmMinutes = workerStart.reduce(
    (sum, s, w) =>
      bars.some((b) => b.worker === w) || s <= makespan
        ? sum + Math.max(0, makespan - s)
        : sum,
    0
  );
  const cpuMinutes = bars.reduce(
    (s, b) => s + (b.task.cpu ?? 1) * b.task.dur,
    0
  );
  return {
    bars,
    makespan,
    vmMinutes,
    cpuMinutes,
    utilization: vmMinutes ? cpuMinutes / (vmMinutes * opts.capacity) : 0,
  };
}

export function fmtMin(m: number): string {
  const whole = Math.floor(m);
  const sec = Math.round((m - whole) * 60);
  return sec ? `${whole}m ${sec}s` : `${whole}m`;
}
