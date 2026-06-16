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

export interface ThrottleSummary {
  runDuration: number;
  criticalPathDuration: number;
  criticalPathTasks: string[];
  criticalPathLongest: { id: string; duration: number } | null;
  totalWork: number;
  /**
   * Sum of `startTime − readyTime` over the critical-path tasks only — how long
   * the tasks that actually determine the finish spent between becoming ready
   * and starting. Dominated by slot contention when slot-bound; ~0 when there
   * is spare slot capacity (then it's pre-start orchestration overhead).
   */
  criticalPathWait: number;
  /**
   * Breakdown of `criticalPathWait` (they sum to it): time the critical-path
   * tasks spent genuinely waiting for a slot, blocked by the coordinator
   * hashing, and on per-task spawn/setup, respectively.
   */
  criticalPathSlotWait: number;
  criticalPathHashing: number;
  criticalPathSpawn: number;
  /** The longest critical-path tasks, each with its own wait, for triage. */
  criticalPathTop: Array<{ id: string; duration: number; wait: number }>;
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

    // Break the critical-path tasks' ready→start time into slot-wait, hashing,
    // and spawn/setup. Hashing runs in the coordinator before dispatch and
    // blocks it, so the portion of [ready, dispatch] overlapping a hash window
    // is attributed to hashing; the rest of [ready, dispatch] is slot-wait; and
    // [dispatch, start] is spawn/setup. The three sum to criticalPathWait.
    const hashWindows = collectHashWindows();
    const perTask: Array<{ id: string; duration: number; wait: number }> = [];
    let criticalPathSlotWait = 0;
    let criticalPathHashing = 0;
    let criticalPathSpawn = 0;
    for (const id of path) {
      const t = this.timings.get(id);
      const ready = this.effectiveReadyTime(id);
      if (t?.startTime == null || ready == null) {
        continue;
      }
      const start = t.startTime;
      // No dispatch stamp (e.g. cache hits never hit dispatchDiscreteWorker) →
      // treat dispatch as start so spawn is 0 and the gap splits into wait/hash.
      const dispatch = t.dispatchTime ?? start;
      const preDispatch = Math.max(0, dispatch - ready);
      let hashing = 0;
      for (const [hs, he] of hashWindows) {
        hashing += Math.max(0, Math.min(dispatch, he) - Math.max(ready, hs));
      }
      hashing = Math.min(hashing, preDispatch);
      const slotWait = preDispatch - hashing;
      const spawn = Math.max(0, start - dispatch);
      criticalPathHashing += hashing;
      criticalPathSlotWait += slotWait;
      criticalPathSpawn += spawn;
      perTask.push({
        id,
        duration: durations.get(id) ?? 0,
        wait: slotWait + hashing + spawn,
      });
    }
    const criticalPathWait =
      criticalPathSlotWait + criticalPathHashing + criticalPathSpawn;
    // The longest critical-path tasks — the ones worth optimizing — with each
    // one's wait, so you can see whether the longest tasks also waited most
    // (often they don't: a long batch task runs right after its predecessor).
    const criticalPathTop = [...perTask]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3);

    const continuousCount = Object.values(this.taskGraph.tasks).filter(
      (t) => t.continuous
    ).length;
    // startCommand receives the total pool (discrete + continuous); recover the
    // discrete parallelism the same way getThreadPoolSize derived it.
    const parallel = Math.max(
      1,
      (this.total ?? continuousCount + 1) - continuousCount
    );
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;

    const slotBoundFloor = totalWork / parallel;
    const slotBound = slotBoundFloor > criticalPathDuration;
    const isCI = !!process.env.CI;

    const criticalPathLongest = path.reduce<{
      id: string;
      duration: number;
    } | null>((acc, id) => {
      const duration = durations.get(id) ?? 0;
      return !acc || duration > acc.duration ? { id, duration } : acc;
    }, null);

    const slotContentionPct =
      runDuration > 0 ? (slotContentionCost / runDuration) * 100 : 0;
    const recommendation = buildRecommendation({
      slotBound,
      criticalPathSlotWait,
      criticalPathDuration,
      parallel,
      cores,
      isCI,
      longest: criticalPathLongest,
    });

    return {
      runDuration,
      criticalPathDuration,
      criticalPathTasks: path,
      criticalPathLongest,
      totalWork,
      criticalPathWait,
      criticalPathSlotWait,
      criticalPathHashing,
      criticalPathSpawn,
      criticalPathTop,
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

/** Critical-path slot wait below this (ms) is treated as noise, not a signal. */
const MEANINGFUL_SLOT_WAIT = 2000;

/**
 * Recommend based on whether more parallelism would actually help: it does when
 * the run is volume-limited (slot-bound) OR the critical chain genuinely waited
 * for a slot. Otherwise the run is at its critical-path floor and the lever is
 * the chain itself, not more slots.
 */
function buildRecommendation(args: {
  slotBound: boolean;
  criticalPathSlotWait: number;
  criticalPathDuration: number;
  parallel: number;
  cores: number;
  isCI: boolean;
  longest: { id: string; duration: number } | null;
}): string {
  const {
    slotBound,
    criticalPathSlotWait,
    criticalPathDuration,
    parallel,
    cores,
    isCI,
    longest,
  } = args;

  const parallelWouldHelp =
    slotBound || criticalPathSlotWait >= MEANINGFUL_SLOT_WAIT;

  if (parallelWouldHelp) {
    if (parallel >= cores) {
      return `Slot-starved even at --parallel=${parallel} (machine has ${cores} cores). Distribute across machines with Nx Cloud Agents → ${NX_AGENTS_URL}`;
    }
    // When only the critical chain waited (not volume-bound), the recoverable
    // time is bounded by that wait, down to the critical-path floor.
    const recover =
      !slotBound && criticalPathSlotWait > 0
        ? ` to recover up to ~${formatDuration(
            criticalPathSlotWait
          )} (down to the ${formatDuration(
            criticalPathDuration
          )} critical-path floor)`
        : '';
    return `Consider --parallel=${cores} (currently ${parallel}, machine has ${cores} cores)${recover}.`;
  }

  const dominant = longest
    ? ` — ${longest.id} dominates at ${formatDuration(longest.duration)}`
    : '';
  const speedUp = `This run is at its critical-path floor (${formatDuration(
    criticalPathDuration
  )}); raising --parallel won't shorten it. Speed up or split the critical path${dominant}.`;
  return isCI
    ? `${speedUp} A faster CI runner also helps if those tasks are CPU-bound.`
    : speedUp;
}

function formatReport(s: ThrottleSummary): string {
  const fmt = formatDuration;
  const longest = s.criticalPathLongest;
  return [
    '',
    'Throttle report (NX_THROTTLE_REPORT):',
    `  Run duration:            ${fmt(s.runDuration)}`,
    `  Critical path:           ${fmt(s.criticalPathDuration)}   (${
      s.criticalPathTasks.length
    } tasks${
      longest ? `; longest: ${longest.id} at ${fmt(longest.duration)}` : ''
    })`,
    `  Total work:              ${fmt(s.totalWork)}`,
    `  Parallelism:             ${s.parallel} slots  (machine has ${s.cores} cores)`,
    `  Environment:             ${s.isCI ? 'CI' : 'local'}`,
    '',
    `  Run overhead:            +${fmt(
      s.slotContentionCost
    )}   (${s.slotContentionPct.toFixed(1)}% over the critical-path floor)`,
    `  Critical-path wait:      ${fmt(
      s.criticalPathWait
    )}   (critical tasks: ready → start)`,
    `    - slot wait:           ${fmt(s.criticalPathSlotWait)}`,
    `    - hashing:             ${fmt(s.criticalPathHashing)}`,
    `    - spawn/setup:         ${fmt(s.criticalPathSpawn)}`,
    `  Longest critical-path tasks (of ${s.criticalPathTasks.length}):`,
    ...s.criticalPathTop.map(
      (t) => `    ${t.id}  —  ${fmt(t.duration)} run, ${fmt(t.wait)} wait`
    ),
    `  Slot-bound floor:        ${fmt(s.slotBoundFloor)}   (totalWork / parallel)`,
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
