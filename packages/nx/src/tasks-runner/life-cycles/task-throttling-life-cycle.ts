import * as os from 'node:os';
import { performance } from 'node:perf_hooks';
import type { BatchInfo } from '../../native';
import { Task, TaskGraph } from '../../config/task-graph';
import { LifeCycle, TaskResult } from '../life-cycle';

const NX_AGENTS_URL = 'https://nx.dev/ci/features/distribute-task-execution';

interface TaskTiming {
  startTime?: number;
  endTime?: number;
  readyTime?: number;
  dispatchTime?: number;
  continuous: boolean;
}

/** How a task on the finish-gating chain was unblocked. */
type GateKind = 'root' | 'dep' | 'slot' | 'hashing' | 'other';

export interface GatingLink {
  id: string;
  duration: number;
  gate: GateKind;
}

export interface ThrottleSummary {
  runDuration: number;
  criticalPathDuration: number;
  criticalPathTasks: string[];
  totalWork: number;
  /**
   * The actual finish-gating chain: the sequence of tasks that determined the
   * finish (from a root to the last-finishing task), each tagged with how it
   * was unblocked — its dependency, the task that freed its slot, hashing, etc.
   */
  gatingChain: GatingLink[];
  /** runDuration − criticalPathDuration: savings under infinite parallelism. */
  slotContentionCost: number;
  slotContentionPct: number;
  parallel: number;
  cores: number;
  slotBoundFloor: number;
  slotBound: boolean;
  isCI: boolean;
  recommendation: string;
}

/**
 * Measures how much wall-clock time a run loses to parallelism contention
 * versus the lower bound imposed by the task graph (its critical path), and
 * prints a verbose report at the end of the run.
 *
 * This is gated behind `NX_THROTTLE_REPORT` (see `constructLifeCycles`) while
 * we validate the numbers. The threshold gating + production-quality one-line
 * summary live in a later phase; here we always print the full breakdown.
 *
 * Headline metric:
 *
 *   slotContentionCost = runDuration − criticalPathDuration
 *
 * which is the exact wall-clock time this run could have saved with unlimited
 * parallelism (the critical path must run sequentially, so it is the floor;
 * with infinite slots every task starts the instant its deps finish, so the
 * optimal run equals the critical path exactly). It is the savings for *this*
 * DAG with *these* durations, not a prediction of incremental --parallel
 * changes, and it folds in a small amount of orchestrator overhead.
 *
 * Scope: discrete tasks only. Continuous tasks have no end time and are
 * excluded from every calculation.
 */
/**
 * The most recently constructed throttle lifecycle. `flushThrottleReport`
 * reads this to print after the terminal/TUI has been torn down — the TUI
 * patches `console` to a no-op during the run, so the report can't be printed
 * from `endCommand`. Cleared on flush.
 */
let activeThrottleLifeCycle: TaskThrottlingLifeCycle | null = null;

export class TaskThrottlingLifeCycle implements LifeCycle {
  private readonly timings = new Map<string, TaskTiming>();
  /** Thread pool size reported to startCommand (discrete + continuous). */
  private total: number | undefined;
  /** taskId → ids of the other tasks in its batch (batches run sequentially). */
  private readonly batchSiblings = new Map<string, string[]>();

  constructor(private readonly taskGraph: TaskGraph) {
    activeThrottleLifeCycle = this;
  }

  startCommand(parallel?: number): void {
    this.total = parallel;
  }

  setTaskReadyTime(taskId: string, readyTime: number): void {
    this.entry(taskId).readyTime ??= readyTime;
  }

  setTaskDispatchTime(taskId: string, dispatchTime: number): void {
    this.entry(taskId).dispatchTime ??= dispatchTime;
  }

  registerRunningBatch(_batchId: string, batchInfo: BatchInfo): void {
    for (const id of batchInfo.taskIds) {
      this.batchSiblings.set(
        id,
        batchInfo.taskIds.filter((other) => other !== id)
      );
    }
  }

  endTasks(taskResults: TaskResult[]): void {
    for (const { task } of taskResults) {
      const entry = this.entry(task.id);
      // Use `!= null` (not truthiness): a real epoch timestamp is never 0, but
      // synthetic/relative timelines can legitimately start at 0.
      if (task.startTime != null) {
        entry.startTime = task.startTime;
      }
      if (task.endTime != null) {
        entry.endTime = task.endTime;
      }
    }
  }

  private entry(taskId: string): TaskTiming {
    let entry = this.timings.get(taskId);
    if (!entry) {
      entry = { continuous: this.taskGraph.tasks[taskId]?.continuous ?? false };
      this.timings.set(taskId, entry);
    }
    return entry;
  }

  /** Discrete tasks that actually executed and have a start + end timestamp. */
  private timedTasks(): Array<{ id: string; start: number; end: number }> {
    const result: Array<{ id: string; start: number; end: number }> = [];
    for (const [id, t] of this.timings) {
      if (!t.continuous && t.startTime != null && t.endTime != null) {
        result.push({ id, start: t.startTime, end: t.endTime });
      }
    }
    return result;
  }

  /**
   * Longest-duration chain through the dependency DAG, by execution time.
   * `finishEst[t] = duration[t] + max(finishEst[d] for completed deps d)`.
   */
  private criticalPath(durations: Map<string, number>): {
    path: string[];
    duration: number;
  } {
    const memo = new Map<string, number>();
    const pred = new Map<string, string | null>();

    const finishEst = (id: string): number => {
      const cached = memo.get(id);
      if (cached != null) {
        return cached;
      }
      let best = 0;
      let bestDep: string | null = null;
      for (const dep of this.taskGraph.dependencies[id] ?? []) {
        if (!durations.has(dep)) {
          continue; // skip continuous / untimed deps
        }
        const f = finishEst(dep);
        if (f > best) {
          best = f;
          bestDep = dep;
        }
      }
      const value = best + (durations.get(id) ?? 0);
      memo.set(id, value);
      pred.set(id, bestDep);
      return value;
    };

    let terminal: string | null = null;
    let terminalFinish = -1;
    for (const id of durations.keys()) {
      const f = finishEst(id);
      if (f > terminalFinish) {
        terminalFinish = f;
        terminal = id;
      }
    }

    const path: string[] = [];
    for (let node = terminal; node != null; node = pred.get(node) ?? null) {
      path.unshift(node);
    }
    return { path, duration: terminal == null ? 0 : terminalFinish };
  }

  /**
   * A task can't start before all its dependencies finish, so its real ready
   * time is the later of its stamped readyTime and the max endTime of its deps.
   * This corrects batched tasks: they share one stamped readyTime when the
   * batch is queued, but actually run sequentially inside the batch process, so
   * the stamped time would count earlier batch tasks' execution as "wait".
   */
  private effectiveReadyTime(id: string): number | undefined {
    const t = this.timings.get(id);
    const ready = t?.readyTime;
    if (ready == null) {
      return undefined;
    }
    let result = ready;
    // A task can't start before its dependencies finish.
    for (const dep of this.taskGraph.dependencies[id] ?? []) {
      const end = this.timings.get(dep)?.endTime;
      if (end != null) {
        result = Math.max(result, end);
      }
    }
    // A batch runs its tasks sequentially in one process, so this task couldn't
    // start until the previous batch task finished — even without an explicit
    // dependency. Use the latest sibling that finished by the time this started.
    // This makes the first batch task show batchStart − batchReady and the rest
    // ~0, instead of counting earlier batch tasks' execution as "wait".
    const start = t?.startTime;
    for (const sibling of this.batchSiblings.get(id) ?? []) {
      const end = this.timings.get(sibling)?.endTime;
      if (end != null && start != null && end <= start) {
        result = Math.max(result, end);
      }
    }
    return result;
  }

  /**
   * The finish-gating chain: walk back from the last-finishing task, at each
   * step following what actually gated it — its latest-finishing dependency, or
   * (if it waited after its deps were ready) the task whose end freed the slot
   * it took. Captures slot-gating that a pure dependency chain misses, so it's
   * the real sequence that determined the finish. Each link records how that
   * task was unblocked.
   */
  private computeGatingChain(
    durations: Map<string, number>,
    hashWindows: Array<[number, number]>
  ): GatingLink[] {
    const EPS = 50; // ms tolerance for "started right when its deps were ready"
    let terminal: string | null = null;
    let maxEnd = -Infinity;
    for (const id of durations.keys()) {
      const end = this.timings.get(id)?.endTime;
      if (end != null && end > maxEnd) {
        maxEnd = end;
        terminal = id;
      }
    }

    const chain: GatingLink[] = [];
    const seen = new Set<string>();
    let node: string | null = terminal;
    while (node != null && !seen.has(node)) {
      seen.add(node);
      const t = this.timings.get(node);
      const start = t?.startTime ?? 0;
      const ready = this.effectiveReadyTime(node) ?? start;
      let gate: GateKind;
      let blocker: string | null;
      if (start - ready <= EPS) {
        blocker = this.latestFinishingDep(node, durations);
        gate = blocker ? 'dep' : 'root';
      } else {
        const freer = this.slotFreer(node, ready, start, durations);
        if (freer) {
          gate = 'slot';
          blocker = freer;
        } else {
          // Waited with free slots: the coordinator hashing, or unexplained.
          gate =
            overlap(ready, start, hashWindows) >= (start - ready) / 2
              ? 'hashing'
              : 'other';
          blocker = this.latestFinishingDep(node, durations);
        }
      }
      chain.unshift({ id: node, duration: durations.get(node) ?? 0, gate });
      node = blocker;
    }
    return chain;
  }

  /** The dependency that finished latest (and thus gated this task's start). */
  private latestFinishingDep(
    id: string,
    durations: Map<string, number>
  ): string | null {
    let best: string | null = null;
    let bestEnd = -Infinity;
    for (const dep of this.taskGraph.dependencies[id] ?? []) {
      if (!durations.has(dep)) {
        continue;
      }
      const end = this.timings.get(dep)?.endTime ?? -Infinity;
      if (end > bestEnd) {
        bestEnd = end;
        best = dep;
      }
    }
    return best;
  }

  /** The task whose end freed the slot `id` took: ran during, and ended within, [ready, start]. */
  private slotFreer(
    id: string,
    ready: number,
    start: number,
    durations: Map<string, number>
  ): string | null {
    let best: string | null = null;
    let bestEnd = -Infinity;
    for (const other of durations.keys()) {
      if (other === id) {
        continue;
      }
      const ot = this.timings.get(other);
      if (ot?.startTime == null || ot.endTime == null) {
        continue;
      }
      if (
        ot.startTime < start &&
        ot.endTime > ready &&
        ot.endTime <= start + 1 &&
        ot.endTime > bestEnd
      ) {
        bestEnd = ot.endTime;
        best = other;
      }
    }
    return best;
  }

  /**
   * Compute the structured throttle summary, or `null` when no discrete task
   * timings were recorded. Pure aside from reading `os` / `process.env.CI`.
   */
  getSummary(): ThrottleSummary | null {
    const timed = this.timedTasks();
    if (timed.length === 0) {
      return null;
    }

    const durations = new Map<string, number>();
    let totalWork = 0;
    let runStart = Infinity;
    let runEnd = -Infinity;
    for (const { id, start, end } of timed) {
      const duration = Math.max(0, end - start);
      durations.set(id, duration);
      totalWork += duration;
      runStart = Math.min(runStart, start);
      runEnd = Math.max(runEnd, end);
    }

    const runDuration = Math.max(0, runEnd - runStart);
    const { path, duration: criticalPathDuration } =
      this.criticalPath(durations);
    const slotContentionCost = Math.max(0, runDuration - criticalPathDuration);

    // Discrete parallelism (the total pool passed to startCommand minus
    // continuous tasks) and machine cores.
    const continuousCount = Object.values(this.taskGraph.tasks).filter(
      (t) => t.continuous
    ).length;
    const parallel = Math.max(
      1,
      (this.total ?? continuousCount + 1) - continuousCount
    );
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;

    // Walk the actual finish-gating chain (see computeGatingChain): the real
    // sequence of tasks that determined the finish, each tagged with what
    // gated it (a dependency, the task that freed its slot, hashing, …).
    const hashWindows = collectHashWindows();
    const gatingChain = this.computeGatingChain(durations, hashWindows);

    const slotBoundFloor = totalWork / parallel;
    const slotBound = slotBoundFloor > criticalPathDuration;
    const isCI = !!process.env.CI;
    const hasSlotGate = gatingChain.some((c) => c.gate === 'slot');
    const dominant = gatingChain.reduce<{
      id: string;
      duration: number;
    } | null>(
      (acc, c) =>
        !acc || c.duration > acc.duration
          ? { id: c.id, duration: c.duration }
          : acc,
      null
    );

    const slotContentionPct =
      runDuration > 0 ? (slotContentionCost / runDuration) * 100 : 0;
    const recommendation = buildRecommendation({
      slotBound,
      hasSlotGate,
      runOverhead: slotContentionCost,
      criticalPathDuration,
      parallel,
      cores,
      isCI,
      dominant,
    });

    return {
      runDuration,
      criticalPathDuration,
      criticalPathTasks: path,
      totalWork,
      gatingChain,
      slotContentionCost,
      slotContentionPct,
      parallel,
      cores,
      slotBoundFloor,
      slotBound,
      isCI,
      recommendation,
    };
  }
}

/**
 * Print the throttle report (if enabled) after the run summary. Called from
 * run-command once the terminal has been restored, so it appears in every
 * output mode — including the TUI, which no-ops `console` during the run.
 */
export function flushThrottleReport(): void {
  const lifeCycle = activeThrottleLifeCycle;
  activeThrottleLifeCycle = null;
  if (!lifeCycle) {
    return;
  }
  const summary = lifeCycle.getSummary();
  if (!summary) {
    return;
  }
  // After the TUI tears down, the terminal can still be in raw mode (no
  // \n → \r\n translation), which staircases plain "\n" output. Use \r\n on a
  // TTY; keep plain \n when piped so logs/files don't get stray carriage returns.
  const eol = process.stdout.isTTY ? '\r\n' : '\n';
  process.stdout.write(formatReport(summary).split('\n').join(eol) + eol);
}

/**
 * Absolute-epoch [start, end] windows during which the coordinator was hashing,
 * read from nx's existing `hashSingleTask` / `hashMultipleTasks` perf measures.
 * Used to attribute critical-path wait to hashing vs slot contention. Returns
 * [] if the performance API is unavailable.
 */
function collectHashWindows(): Array<[number, number]> {
  try {
    const origin = performance.timeOrigin;
    return performance
      .getEntriesByType('measure')
      .filter((m) => m.name.startsWith('hash'))
      .map((m): [number, number] => [
        origin + m.startTime,
        origin + m.startTime + m.duration,
      ]);
  } catch {
    return [];
  }
}

/** Total time [a, b] overlaps the given (unsorted, possibly overlapping) intervals. */
function overlap(
  a: number,
  b: number,
  intervals: Array<[number, number]>
): number {
  let sum = 0;
  for (const [s, e] of intervals) {
    sum += Math.max(0, Math.min(b, e) - Math.max(a, s));
  }
  return sum;
}

/** Run overhead below this (ms) means you're effectively at the critical-path floor. */
const MEANINGFUL_OVERHEAD = 1000;

/**
 * Recommend based on whether more parallelism would actually help: it does when
 * the run is volume-limited (slot-bound) or the finish chain was slot-gated.
 * Otherwise the run is at its critical-path floor and the lever is the chain.
 */
function buildRecommendation(args: {
  slotBound: boolean;
  hasSlotGate: boolean;
  runOverhead: number;
  criticalPathDuration: number;
  parallel: number;
  cores: number;
  isCI: boolean;
  dominant: { id: string; duration: number } | null;
}): string {
  const {
    slotBound,
    hasSlotGate,
    runOverhead,
    criticalPathDuration,
    parallel,
    cores,
    isCI,
    dominant,
  } = args;

  // You can never recover more than the run overhead; if it's negligible the run
  // is already at its critical-path floor.
  const parallelWouldHelp =
    runOverhead >= MEANINGFUL_OVERHEAD && (slotBound || hasSlotGate);

  if (parallelWouldHelp) {
    if (parallel >= cores) {
      return `The finish chain is slot-gated even at --parallel=${parallel} (machine has ${cores} cores). Distribute across machines with Nx Cloud Agents → ${NX_AGENTS_URL}`;
    }
    return `The finish chain is slot-gated. Consider --parallel=${cores} (currently ${parallel}, machine has ${cores} cores) to recover up to ~${formatDuration(
      runOverhead
    )} (down to the ${formatDuration(criticalPathDuration)} critical-path floor).`;
  }

  const dom = dominant
    ? ` — ${dominant.id} dominates at ${formatDuration(dominant.duration)}`
    : '';
  const speedUp = `This run is at its critical-path floor (${formatDuration(
    criticalPathDuration
  )}); raising --parallel won't shorten it. Speed up or split the finish chain${dom}.`;
  return isCI
    ? `${speedUp} A faster CI runner also helps if those tasks are CPU-bound.`
    : speedUp;
}

const GATE_LABEL: Record<GateKind, string> = {
  root: '',
  dep: '',
  slot: '  ← slot-gated (waited for a free slot)',
  hashing: '  ← waited on hashing',
  other: '  ← waited (scheduling/startup)',
};

function formatReport(s: ThrottleSummary): string {
  const fmt = formatDuration;
  return [
    '',
    'Throttle report (NX_THROTTLE_REPORT):',
    `  Run duration:            ${fmt(s.runDuration)}`,
    `  Critical path (floor):   ${fmt(s.criticalPathDuration)}   (${
      s.criticalPathTasks.length
    } tasks)`,
    `  Total work:              ${fmt(s.totalWork)}`,
    `  Parallelism:             ${s.parallel} slots  (machine has ${s.cores} cores)`,
    `  Environment:             ${s.isCI ? 'CI' : 'local'}`,
    '',
    `  Run overhead:            +${fmt(
      s.slotContentionCost
    )}   (${s.slotContentionPct.toFixed(
      1
    )}% over floor, recoverable with infinite parallelism)`,
    `  Finish-gating chain (what determined the ${fmt(s.runDuration)} finish):`,
    ...s.gatingChain.map(
      (c) => `    ${c.id}  —  ${fmt(c.duration)}${GATE_LABEL[c.gate]}`
    ),
    `  Bottleneck class:        ${
      s.slotBound ? 'slot-bound' : 'critical-path-bound'
    }`,
    '',
    `  Recommendation: ${s.recommendation}`,
    '',
  ].join('\n');
}

/** Format a millisecond duration as e.g. "3m 30s", "18s", or "0.4s". */
function formatDuration(ms: number): string {
  if (ms >= 60_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  if (ms >= 10_000) {
    return `${Math.round(ms / 1000)}s`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}
