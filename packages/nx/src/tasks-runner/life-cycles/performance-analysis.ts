import * as os from 'node:os';
import { performance } from 'node:perf_hooks';
import { TaskGraph } from '../../config/task-graph';
import { NxJsonConfiguration } from '../../config/nx-json';
import { isNxCloudDisabled, isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { isCI as isCiEnv } from '../../utils/is-ci';
import { MEANINGFUL_OVERHEAD } from './performance-report';
import { TaskResult } from '../life-cycle';

const CACHE_HIT_STATUSES = new Set([
  'local-cache',
  'local-cache-kept-existing',
  'remote-cache',
]);

/** Gap (ms) still counted as the same pre-dispatch hashing phase; a larger gap means older, unrelated hashing (e.g. a daemon's previous run). */
const PRE_DISPATCH_HASH_GAP = 1000;

/** A critical-path task shorter than this fraction of the path is noise, not a speed-up target. */
const CRITICAL_PATH_TOP_MIN_FRACTION = 0.2;

export interface TaskTiming {
  startTime?: number;
  endTime?: number;
  continuous: boolean;
}

/** A discrete task that ran, with its window and whether it monopolizes the pool (`parallelism: false`). */
export interface TimedTask {
  id: string;
  start: number;
  end: number;
  nonParallel: boolean;
}

/**
 * One [start, end) slice of the run where the counts below hold steady — the gap between
 * two adjacent sweep boundaries (see {@link buildTimespans}). Because nothing changes
 * within the slice, the analysis treats it as a flat rectangle of `end - start` ms.
 */
export interface Timespan {
  /** Slice bounds (epoch ms); occ/waiting/nonParallel are constant across [start, end). */
  start: number;
  end: number;
  /** Slots busy for the whole slice (a `parallelism: false` task counts as the entire pool). */
  occ: number;
  /** Tasks eligible to run but still queued for a free slot. */
  waiting: number;
  /** `parallelism: false` tasks running during the slice (each one holds every slot). */
  nonParallel: number;
}

/**
 * A task and how long it ran (ms). The unit the report's task lists are built from —
 * shared with the renderers so the producer and the formatters can't drift.
 */
export interface TaskDurationRow {
  id: string;
  duration: number;
}

export interface PerformanceSummary {
  runDuration: number;
  criticalPathDuration: number;
  criticalPathTaskCount: number;
  /** Longest critical-path tasks that ran (desc, capped at a few), cache hits excluded; empty when the path was fully cached. */
  criticalPathTop: TaskDurationRow[];
  /** Ids of tasks that failed (slowest first), for the GitHub Actions summary's failed-tasks list. Continuous tasks and tasks without a complete window are excluded. */
  failedTasks: string[];
  /** runDuration − criticalPathDuration. */
  overhead: number;
  /** Overhead split by lever; these + coordinatorOverhead sum to `overhead`. Their sum is the slot-contention time (derived, never stored, so the halves can't drift). */
  recoverableByParallel: number;
  recoverableByMachines: number;
  coordinatorOverhead: number;
  parallel: number;
  cores: number;
  isCI: boolean;
  /** In CI and not already distributing — so suggesting Nx Agents is actionable. */
  canDistribute: boolean;
  /** Already running on Nx Agents (NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT set). */
  distributing: boolean;
  /** Coordinator overhead outweighs task work, so the longest tasks aren't the lever (typical cached run). */
  coordinatorDominated: boolean;
  cacheHits: number;
  /** Tasks with any cache outcome (hits + tasks that ran). */
  cacheableCount: number;
  cacheSkipped: boolean;
  remoteCacheEnabled: boolean;
  /** The workspace opted out of Nx Cloud (`neverConnectToCloud` / NX_NO_CLOUD) — never recommend it. */
  cloudOptedOut: boolean;
}

/** Construction-time inputs for {@link PerformanceLifeCycle}. */
export interface PerformanceLifeCycleOptions {
  /** Whether `--skip-nx-cache` was passed (feeds the cache-skipped check). */
  skipNxCache?: boolean;
  /** Passed in at construction so the lifecycle doesn't re-read nx.json. */
  nxJson?: NxJsonConfiguration;
}

/** Per-call memo state for the critical-path search (one fresh instance per run). */
interface FinishContext {
  durations: Map<string, number>;
  memo: Map<string, number>;
  pred: Map<string, string | null>;
  visiting: Set<string>;
}

/**
 * Pure analysis over one finished run's collected timings — no lifecycle state and no
 * mutation. Built once per run from the {@link PerformanceLifeCycle}'s accumulated
 * maps; everything here is a function of that snapshot plus the environment it reads.
 */
export class PerformanceAnalysis {
  constructor(
    private readonly timings: Map<string, TaskTiming>,
    private readonly statuses: Map<string, TaskResult['status']>,
    private readonly taskGraph: TaskGraph,
    private readonly batchSiblings: Map<string, string[]>,
    /** Resolved `--parallel` (getThreadPoolSize's `discrete`), set on the lifecycle by the runner; falls back to 1. */
    private readonly parallel: number,
    private readonly options: PerformanceLifeCycleOptions
  ) {}

  /**
   * Whether a remote (Nx Cloud) cache is active, from the nx.json handed in at
   * construction. Assumes no remote cache when it wasn't provided rather than
   * re-reading nx.json from disk — the CLI path always provides it.
   */
  private remoteCacheEnabled(): boolean {
    return this.options.nxJson ? isNxCloudUsed(this.options.nxJson) : false;
  }

  // === Analysis (pure functions of the collected timings + task graph) ===

  /** Discrete tasks that ran and have a start + end timestamp. */
  private timedTasks(): TimedTask[] {
    const result: TimedTask[] = [];
    for (const [id, t] of this.timings) {
      if (!t.continuous && t.startTime != null && t.endTime != null) {
        result.push({
          id,
          start: t.startTime,
          end: t.endTime,
          // A parallelism:false task occupies the whole pool; carried here so the
          // occupancy timeline (buildTimespans) stays a pure function of `timed`.
          nonParallel: this.taskGraph.tasks[id]?.parallelism === false,
        });
      }
    }
    return result;
  }

  /**
   * Longest-duration chain through the dependency DAG — the floor with unlimited
   * slots. `finishEstimate(t) = duration[t] + max(finishEstimate(p) for predecessors
   * p)`. Predecessors are real dependencies *plus* earlier batch siblings (a batch runs
   * sequentially in one process, so that ordering is part of the floor too). On equal
   * finish estimates keep the longer-running predecessor.
   */
  private criticalPath(durations: Map<string, number>): {
    path: string[];
    duration: number;
  } {
    const ctx: FinishContext = {
      durations,
      memo: new Map(),
      pred: new Map(),
      visiting: new Set(),
    };

    let terminal: string | null = null;
    let terminalFinish = -1;
    let terminalDur = -1;
    for (const id of durations.keys()) {
      const f = this.finishEstimate(id, ctx);
      const d = durations.get(id) ?? 0;
      if (finishesLater(f, d, terminalFinish, terminalDur)) {
        terminalFinish = f;
        terminalDur = d;
        terminal = id;
      }
    }

    return {
      path: tracePath(terminal, ctx.pred),
      duration: terminal == null ? 0 : terminalFinish,
    };
  }

  /**
   * Real predecessors of `id`: dependencies plus any earlier batch sibling that FINISHED
   * before `id` started. A batch runs sequentially in one process, so that ordering is
   * part of the floor; concurrent batch executors aren't, and chaining them would inflate
   * it. (Matches readyTime.)
   */
  private predecessorsFor(
    id: string,
    durations: Map<string, number>
  ): string[] {
    const start = this.timings.get(id)?.startTime ?? Infinity;
    const deps = (this.taskGraph.dependencies[id] ?? []).filter((d) =>
      durations.has(d)
    );
    const siblings = (this.batchSiblings.get(id) ?? []).filter((s) => {
      const sEnd = this.timings.get(s)?.endTime;
      return durations.has(s) && sEnd != null && sEnd <= start;
    });
    return [...deps, ...siblings];
  }

  /**
   * Longest finish time of any chain reaching `id` — its duration plus the best
   * predecessor's finish estimate — memoized in `ctx`. `ctx.visiting` guards a cycle in
   * a malformed graph (the back-edge contributes nothing).
   */
  private finishEstimate(id: string, ctx: FinishContext): number {
    const cached = ctx.memo.get(id);
    if (cached != null) {
      return cached;
    }
    if (ctx.visiting.has(id)) {
      return 0;
    }
    ctx.visiting.add(id);
    let best = 0;
    let bestPred: string | null = null;
    let bestDur = -1;
    for (const p of this.predecessorsFor(id, ctx.durations)) {
      const f = this.finishEstimate(p, ctx);
      const d = ctx.durations.get(p) ?? 0;
      if (finishesLater(f, d, best, bestDur)) {
        best = f;
        bestPred = p;
        bestDur = d;
      }
    }
    ctx.visiting.delete(id);
    const value = best + (ctx.durations.get(id) ?? 0);
    ctx.memo.set(id, value);
    ctx.pred.set(id, bestPred);
    return value;
  }

  /**
   * Earliest this task became eligible, independent of slots: the latest of run
   * start, dependency ends, any continuous dependency's *start* (an ordering
   * constraint, not contention), and any earlier batch sibling's end.
   */
  private readyTime(id: string, runStart: number): number {
    const start = this.timings.get(id)?.startTime;
    let result = runStart;
    for (const dep of this.taskGraph.dependencies[id] ?? []) {
      const end = this.timings.get(dep)?.endTime;
      if (end != null) {
        result = Math.max(result, end);
      }
    }
    for (const cdep of this.taskGraph.continuousDependencies?.[id] ?? []) {
      const cStart = this.timings.get(cdep)?.startTime;
      if (cStart != null) {
        result = Math.max(result, cStart);
      }
    }
    for (const sibling of this.batchSiblings.get(id) ?? []) {
      const end = this.timings.get(sibling)?.endTime;
      if (end != null && start != null && end <= start) {
        result = Math.max(result, end);
      }
    }
    return result;
  }

  /**
   * Longest critical-path tasks that RAN (desc, capped at 3). Cache hits are excluded
   * (their duration is just restore time); no-status tasks (synthetic test runs) are
   * kept.
   */
  private computeCriticalPathTop(
    criticalPathTasks: string[],
    durations: Map<string, number>,
    criticalPathDuration: number
  ): TaskDurationRow[] {
    return (
      criticalPathTasks
        .filter((id) => {
          const status = this.statuses.get(id);
          return !status || !CACHE_HIT_STATUSES.has(status);
        })
        .map((id) => ({ id, duration: durations.get(id) ?? 0 }))
        // Only tasks that meaningfully shape the path are worth speeding up.
        .filter(
          (t) =>
            t.duration >= CRITICAL_PATH_TOP_MIN_FRACTION * criticalPathDuration
        )
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 3)
    );
  }

  /** Cache outcome: tasks restored (`cacheHits`) and the total with a cache outcome (`cacheableCount` = hits + ran). No-status tasks count for neither. */
  private computeCacheStats(): { cacheHits: number; cacheableCount: number } {
    let cacheHits = 0;
    let cacheRan = 0;
    for (const status of this.statuses.values()) {
      if (CACHE_HIT_STATUSES.has(status)) {
        cacheHits++;
      } else if (status === 'success') {
        cacheRan++;
      }
    }
    return { cacheHits, cacheableCount: cacheHits + cacheRan };
  }

  /**
   * The ids of tasks that failed during the run, slowest first, for the GitHub Actions
   * summary's failed-tasks list. Continuous tasks and tasks without a complete window are
   * excluded (a failed task ran to a non-zero exit, so it has both timestamps). Duration
   * orders the list but isn't shown — for a failure, which task failed is what matters.
   */
  private computeFailedTasks(): string[] {
    const rows: TaskDurationRow[] = [];
    for (const [id, timing] of this.timings) {
      if (
        timing.continuous ||
        timing.startTime == null ||
        timing.endTime == null ||
        this.statuses.get(id) !== 'failure'
      ) {
        continue;
      }
      rows.push({
        id,
        duration: Math.max(0, timing.endTime - timing.startTime),
      });
    }
    return rows.sort((a, b) => b.duration - a.duration).map((r) => r.id);
  }

  /** The structured performance summary, or `null` when no discrete task timings were recorded. */
  summary(): PerformanceSummary | null {
    const timed = this.timedTasks();
    if (timed.length === 0) {
      return null;
    }

    const { durations, totalWork, runStart, taskWindow } =
      computeRunWindow(timed);

    const eligible = new Map<string, number>();
    for (const { id } of timed) {
      eligible.set(id, this.readyTime(id, runStart));
    }

    const { path: criticalPathTasks, duration: criticalPathDuration } =
      this.criticalPath(durations);

    const parallel = Math.max(1, this.parallel);
    const cores = detectCoreCount();

    const timespans = buildTimespans(timed, eligible, parallel);
    const hashWindows = collectHashWindows();

    // Pre-dispatch hashing is part of overhead but not the slot split.
    const runDuration = taskWindow + preDispatchHashTime(runStart, hashWindows);
    const overhead = Math.max(0, runDuration - criticalPathDuration);

    const {
      coordinatorOverhead,
      recoverableByMachines,
      recoverableByParallel,
    } = splitOverhead({
      timespans,
      parallel,
      overhead,
      totalWork,
      cores,
      criticalPathDuration,
    });

    const criticalPathTop = this.computeCriticalPathTop(
      criticalPathTasks,
      durations,
      criticalPathDuration
    );

    const { cacheHits, cacheableCount } = this.computeCacheStats();
    // `skipNxCache` already folds in NX_SKIP_NX_CACHE / NX_DISABLE_NX_CACHE
    // (normalized in command-line-utils) — don't re-read those env vars here.
    const cacheSkipped = this.options.skipNxCache === true;
    const remoteCacheEnabled = this.remoteCacheEnabled();
    const cloudOptedOut = this.options.nxJson
      ? !!isNxCloudDisabled(this.options.nxJson)
      : false;

    // Coordinator-dominated: hashing/scheduling outweighs task work by >3x the
    // critical path, which keeps cold runs critical-path-bound.
    const coordinatorDominated =
      coordinatorOverhead >= MEANINGFUL_OVERHEAD &&
      coordinatorOverhead > 3 * criticalPathDuration;

    // isCiEnv() checks the full set of CI env vars, not just `CI`.
    const isCI = !!isCiEnv();
    // TODO: source from the light client's isDistributedExecution() rather than the env var.
    const distributing =
      !!process.env.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT;

    return {
      runDuration,
      criticalPathDuration,
      criticalPathTaskCount: criticalPathTasks.length,
      criticalPathTop,
      failedTasks: this.computeFailedTasks(),
      overhead,
      recoverableByParallel,
      recoverableByMachines,
      coordinatorOverhead,
      parallel,
      cores,
      isCI,
      // Can only start distributing in CI when not already doing so — and never
      // suggest Nx Agents to a workspace that opted out of Nx Cloud.
      canDistribute: isCI && !distributing && !cloudOptedOut,
      distributing,
      coordinatorDominated,
      cacheHits,
      cacheableCount,
      cacheSkipped,
      remoteCacheEnabled,
      cloudOptedOut,
    };
  }
}

// === Analysis helpers (module-level; no instance state) ===

/**
 * True when a `(finishEstimate, duration)` candidate finishes later than the current
 * best — higher finish wins, ties broken by the longer-running task.
 */
function finishesLater(
  finish: number,
  dur: number,
  bestFinish: number,
  bestDur: number
): boolean {
  return finish > bestFinish || (finish === bestFinish && dur > bestDur);
}

/**
 * Follow the recorded best-predecessor links from `end` back to the root, returning
 * the path root → end. `seen` guards against a cycle in a malformed `pred` chain.
 */
function tracePath(
  end: string | null,
  pred: Map<string, string | null>
): string[] {
  const path: string[] = [];
  const seen = new Set<string>();
  for (
    let node = end;
    node != null && !seen.has(node);
    node = pred.get(node) ?? null
  ) {
    seen.add(node);
    path.unshift(node);
  }
  return path;
}

/** Absolute-epoch [start, end] hashing windows from nx's existing `hash*` perf measures; [] if the performance API is unavailable. */
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

/**
 * Union a set of `[start, end]` intervals into an ordered, non-overlapping set, e.g.
 * `[[1, 3], [2, 5]]` → `[[1, 5]]`. Sort by start, then sweep once: each interval
 * either extends the previous merged one (if it overlaps or touches it) or begins a
 * new one.
 */
export function mergeIntervals(
  intervals: Array<[number, number]>
): Array<[number, number]> {
  const byStart = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of byStart) {
    const previous = merged[merged.length - 1];
    // `previous[1]` is the running end of the last merged interval. This interval
    // overlaps or touches it when its start is at or before that end — so absorb it
    // by extending the end. Otherwise it's disjoint and starts a new interval.
    const overlapsPrevious = previous != null && start <= previous[1];
    if (overlapsPrevious) {
      previous[1] = Math.max(previous[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/** Total time [a, b] overlaps the given (unsorted, possibly overlapping) intervals. */
export function overlap(
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

/**
 * Coordinator hashing wall-clock that ran *before* the first task started — the run
 * window (first task start → last task end) would otherwise miss it. Matters on a
 * cached run where hashing dominates but the tasks restore in milliseconds.
 *
 * `hashWindows` are absolute `[start, end]` spans from nx's `hash*` perf measures.
 */
export function preDispatchHashTime(
  firstTaskStart: number,
  hashWindows: Array<[number, number]>
): number {
  // Keep only the part of each window before the first task, drop any that become
  // empty, then union overlaps so shared time isn't counted twice.
  const preDispatchWindows = mergeIntervals(
    hashWindows
      .map(([start, end]): [number, number] => [
        start,
        Math.min(end, firstTaskStart),
      ])
      .filter(([start, end]) => end > start)
  );

  // Walk newest → oldest, adding each window while it stays contiguous with the one
  // after it. Stop at the first gap wider than PRE_DISPATCH_HASH_GAP — anything older
  // is stale hashing from an earlier run in this process (e.g. the daemon's).
  let total = 0;
  let contiguousFrom = firstTaskStart;
  for (let i = preDispatchWindows.length - 1; i >= 0; i--) {
    const [start, end] = preDispatchWindows[i];
    const gapTooLarge = end < contiguousFrom - PRE_DISPATCH_HASH_GAP;
    if (gapTooLarge) {
      break;
    }
    total += end - start;
    contiguousFrom = start;
  }
  return total;
}

/** Per-task durations, total work, and the run window from the timed tasks. */
function computeRunWindow(
  timed: Array<{ id: string; start: number; end: number }>
): {
  durations: Map<string, number>;
  totalWork: number;
  runStart: number;
  taskWindow: number;
} {
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
  return {
    durations,
    totalWork,
    runStart,
    taskWindow: Math.max(0, runEnd - runStart),
  };
}

/** cgroup-aware core count so a quota-capped CI container gets the right lever (more machines, not a --parallel it can't use). cpus() only as fallback. */
function detectCoreCount(): number {
  return typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;
}

/**
 * The occupancy timeline (contiguous {@link Timespan}s) — single source of truth for
 * slot contention. A `parallelism: false` task occupies the whole pool. Integrates
 * over time rather than sampling one instant, so it's robust to when tasks hand off.
 *
 * Builds it via a delta sweep: each task bumps a counter up at its start and down at
 * its end, then we walk the sorted boundaries accumulating the running totals into one
 * timespan per gap.
 */
export function buildTimespans(
  timed: TimedTask[],
  eligible: Map<string, number>,
  parallel: number
): Timespan[] {
  // Per-timestamp +/- deltas the sweep integrates into timespans: busy slots (occ),
  // eligible-but-waiting tasks, and parallelism:false tasks that hold the whole pool.
  const occDelta = new Map<number, number>();
  const waitDelta = new Map<number, number>();
  const nonParallelDelta = new Map<number, number>();
  const addDelta = (deltas: Map<number, number>, at: number, delta: number) =>
    deltas.set(at, (deltas.get(at) ?? 0) + delta);

  for (const { id, start, end, nonParallel: isNonParallel } of timed) {
    // A parallelism:false task holds every slot, so it weighs the whole pool.
    const weight = isNonParallel ? parallel : 1;
    addDelta(occDelta, start, weight);
    addDelta(occDelta, end, -weight);
    if (isNonParallel) {
      addDelta(nonParallelDelta, start, 1);
      addDelta(nonParallelDelta, end, -1);
    }
    const elig = eligible.get(id) ?? start;
    if (elig < start) {
      addDelta(waitDelta, elig, 1);
      addDelta(waitDelta, start, -1);
    }
  }

  const times = Array.from(
    new Set([
      ...occDelta.keys(),
      ...waitDelta.keys(),
      ...nonParallelDelta.keys(),
    ])
  ).sort((a, b) => a - b);

  const timespans: Timespan[] = [];
  let occ = 0;
  let waiting = 0;
  let nonParallel = 0;
  for (let i = 0; i < times.length; i++) {
    occ += occDelta.get(times[i]) ?? 0;
    waiting += waitDelta.get(times[i]) ?? 0;
    nonParallel += nonParallelDelta.get(times[i]) ?? 0;
    const next = times[i + 1];
    if (next != null && next > times[i]) {
      timespans.push({ start: times[i], end: next, occ, waiting, nonParallel });
    }
  }
  return timespans;
}

/**
 * Split overhead off the occupancy timeline into three buckets that sum to overhead:
 * coordinator time, and slot contention recoverable by more machines vs by a higher
 * --parallel.
 *
 * Slot contention is wall-clock where every slot was busy with a backlog (occ ≥
 * parallel, waiting > 0). Contention while a `parallelism: false` task held the whole
 * pool goes to machines only (a higher local --parallel can't recover it). Of the
 * rest, --parallel helps up to the volume the cores can absorb; the overflow
 * (totalWork/cores − floor) needs more machines.
 */
function splitOverhead({
  timespans,
  parallel,
  overhead,
  totalWork,
  cores,
  criticalPathDuration,
}: {
  timespans: Timespan[];
  parallel: number;
  overhead: number;
  totalWork: number;
  cores: number;
  criticalPathDuration: number;
}): {
  coordinatorOverhead: number;
  recoverableByMachines: number;
  recoverableByParallel: number;
} {
  let slotContendedTime = 0;
  let nonParallelContendedTime = 0;
  for (const s of timespans) {
    if (s.occ >= parallel && s.waiting > 0) {
      const dur = s.end - s.start;
      slotContendedTime += dur;
      if (s.nonParallel > 0) {
        nonParallelContendedTime += dur;
      }
    }
  }
  const recoverableBySlots = Math.min(overhead, slotContendedTime);
  const nonParallelRecoverable = Math.min(
    recoverableBySlots,
    nonParallelContendedTime
  );
  const ordinaryBySlots = recoverableBySlots - nonParallelRecoverable;
  const machineBound =
    parallel < cores
      ? Math.max(0, totalWork / cores - criticalPathDuration)
      : Infinity;
  const ordinaryByMachines = Math.min(ordinaryBySlots, machineBound);
  return {
    coordinatorOverhead: overhead - recoverableBySlots,
    recoverableByMachines: nonParallelRecoverable + ordinaryByMachines,
    recoverableByParallel: ordinaryBySlots - ordinaryByMachines,
  };
}
