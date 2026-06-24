import * as os from 'node:os';
import { performance } from 'node:perf_hooks';
import type { BatchInfo, PerformanceSummaryPayload } from '../../native';
import { TaskGraph } from '../../config/task-graph';
import { readNxJson } from '../../config/nx-json';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import {
  buildExitSummaryPayload,
  buildRecommendation,
  formatReport,
  MEANINGFUL_OVERHEAD,
} from './performance-report';
import { LifeCycle, TaskResult } from '../life-cycle';

const CACHE_HIT_STATUSES = new Set([
  'local-cache',
  'local-cache-kept-existing',
  'remote-cache',
]);

/** Wait (ms) below which a task counts as starting on time. 0 = flag every wait. */
const EPS = 0;
/** Gap (ms) still counted as the same pre-dispatch hashing phase; a larger gap means older, unrelated hashing (e.g. a daemon's previous run). */
const PRE_DISPATCH_HASH_GAP = 1000;

interface TaskTiming {
  startTime?: number;
  endTime?: number;
  continuous: boolean;
}

type GateKind = 'root' | 'dep' | 'slot' | 'hashing' | 'other';

interface ChainLink {
  id: string;
  gate: GateKind;
  wait: number;
}

/** One contiguous slice of the occupancy timeline: slots busy (`occ`), tasks eligible-but-not-running (`waiting`), and `parallelism: false` tasks running (`monopoly`). */
interface Segment {
  start: number;
  end: number;
  occ: number;
  waiting: number;
  monopoly: number;
}

export interface PerformanceSummary {
  runDuration: number;
  criticalPathDuration: number;
  criticalPathTaskCount: number;
  /** Diagnostic only, not displayed; the overhead split comes from the occupancy timeline. */
  finishChain: ChainLink[];
  /** Longest critical-path tasks that ran (desc, capped at a few), cache hits excluded; empty when the path was fully cached. */
  criticalPathTop: Array<{ id: string; duration: number }>;
  /** runDuration − criticalPathDuration. */
  overhead: number;
  /** Overhead split by lever; these + coordinatorOverhead sum to `overhead`. Their sum is the slot-contention time (derived, never stored, so the halves can't drift). */
  recoverableByParallel: number;
  recoverableByMachines: number;
  coordinatorOverhead: number;
  /** Diagnostic, never displayed: dispatch/scheduling latency (eligible with a free slot but unstarted, hashing excluded). */
  schedulingOverhead: number;
  parallel: number;
  cores: number;
  isCI: boolean;
  /** One rec per lever; rendered as a list when >1. */
  recommendations: string[];
  /** Coordinator overhead outweighs task work, so the longest tasks aren't the lever (typical cached run). */
  coordinatorDominated: boolean;
  cacheHits: number;
  /** Tasks with any cache outcome (hits + tasks that ran). */
  cacheableCount: number;
  cacheSkipped: boolean;
  remoteCacheEnabled: boolean;
}

/**
 * Environment seams for {@link PerformanceLifeCycle}. `skipNxCache` feeds the
 * cache-skipped check; the rest default to reading the live environment and are
 * supplied in tests to avoid touching process.env / the perf API / nx.json.
 */
interface PerformanceLifeCycleOptions {
  skipNxCache?: boolean;
  hashWindows?: () => Array<[number, number]>;
  cacheSkipped?: () => boolean;
  remoteCacheEnabled?: () => boolean;
  isCI?: () => boolean;
  distributingTasks?: () => boolean;
}

/**
 * Measures how much wall-clock a run loses to parallelism contention versus its
 * critical-path floor, and reports it at the end of a run. Added on every run by
 * `constructLifeCycles`, but only emitted where the report is flushed (the CLI
 * `invokeTasksRunner` path) — the programmatic `init-tasks-runner` path collects
 * timings but never displays them.
 *
 * overhead = runDuration − criticalPathDuration, split by CAUSE off the occupancy
 * timeline: slot-queued time (recoverable by parallelism / machines) versus
 * coordinator time (hashing, scheduling, continuous-dep waits).
 *
 * Scope: discrete tasks only. Continuous tasks (no end time) are excluded; a
 * discrete task's wait for a continuous dependency to start is eligibility, not
 * contention.
 */
export class PerformanceLifeCycle implements LifeCycle {
  private readonly timings = new Map<string, TaskTiming>();
  /** taskId → terminal status (cache hit vs ran), for the cache summary. */
  private readonly statuses = new Map<string, TaskResult['status']>();
  /** Thread pool size reported to startCommand (discrete + continuous). */
  private total: number | undefined;
  /** taskId → other tasks in its batch (batches run sequentially). */
  private readonly batchSiblings = new Map<string, string[]>();

  constructor(
    private readonly taskGraph: TaskGraph,
    private readonly options: PerformanceLifeCycleOptions = {}
  ) {
    activePerformanceLifeCycle = this;
  }

  // === Lifecycle hooks (called by the orchestrator as the run progresses) ===

  startCommand(total?: number): void {
    this.total = total;
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
    // Called incrementally (per group/batch); accumulate so the last call sees every timing.
    for (const { task, status } of taskResults) {
      const entry = this.entry(task.id);
      // `!= null`, not truthiness: synthetic/relative timelines can legitimately start at 0.
      if (task.startTime != null) {
        entry.startTime = task.startTime;
      }
      if (task.endTime != null) {
        entry.endTime = task.endTime;
      }
      if (status != null) {
        this.statuses.set(task.id, status);
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

  // === Environment (overridden via constructor options in tests) ===

  private hashWindows(): Array<[number, number]> {
    return this.options.hashWindows?.() ?? collectHashWindows();
  }

  private cacheSkipped(): boolean {
    return (
      this.options.cacheSkipped?.() ??
      (this.options.skipNxCache === true ||
        process.env.NX_SKIP_NX_CACHE === 'true' ||
        process.env.NX_DISABLE_NX_CACHE === 'true')
    );
  }

  /** Whether a remote (Nx Cloud) cache is active. */
  private remoteCacheEnabled(): boolean {
    if (this.options.remoteCacheEnabled) {
      return this.options.remoteCacheEnabled();
    }
    try {
      return isNxCloudUsed(readNxJson());
    } catch {
      return false;
    }
  }

  private isCI(): boolean {
    return this.options.isCI?.() ?? !!process.env.CI;
  }

  /** Whether the run is already distributing across machines (Agents/DTE). */
  private distributingTasks(): boolean {
    return (
      this.options.distributingTasks?.() ??
      !!process.env.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT
    );
  }

  /** Discrete tasks that ran and have a start + end timestamp. */
  // === Analysis (pure functions of the collected timings + task graph) ===

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
   * Longest-duration chain through the dependency DAG — the floor with unlimited
   * slots. `finishEst[t] = duration[t] + max(finishEst[p] for predecessors p)`.
   * Predecessors are real dependencies *plus* earlier batch siblings (a batch runs
   * sequentially in one process, so that ordering is part of the floor too). On equal
   * finish estimates keep the longer-running predecessor.
   */
  private criticalPath(durations: Map<string, number>): {
    path: string[];
    duration: number;
  } {
    const memo = new Map<string, number>();
    const pred = new Map<string, string | null>();
    const visiting = new Set<string>();

    const predecessors = (id: string): string[] => {
      const start = this.timings.get(id)?.startTime ?? Infinity;
      const deps = (this.taskGraph.dependencies[id] ?? []).filter((d) =>
        durations.has(d)
      );
      // Only a batch sibling that FINISHED before this task started is a real
      // sequencing predecessor; batch executors may run concurrently, and chaining
      // those would inflate the floor. (Matches earliestStart.)
      const siblings = (this.batchSiblings.get(id) ?? []).filter((s) => {
        const sEnd = this.timings.get(s)?.endTime;
        return durations.has(s) && sEnd != null && sEnd <= start;
      });
      return [...deps, ...siblings];
    };

    const finishEst = (id: string): number => {
      const cached = memo.get(id);
      if (cached != null) {
        return cached;
      }
      if (visiting.has(id)) {
        return 0; // cycle guard: treat the back-edge as contributing nothing
      }
      visiting.add(id);
      let best = 0;
      let bestPred: string | null = null;
      let bestDur = -1;
      for (const p of predecessors(id)) {
        const f = finishEst(p);
        const d = durations.get(p) ?? 0;
        if (f > best || (f === best && d > bestDur)) {
          best = f;
          bestPred = p;
          bestDur = d;
        }
      }
      visiting.delete(id);
      const value = best + (durations.get(id) ?? 0);
      memo.set(id, value);
      pred.set(id, bestPred);
      return value;
    };

    let terminal: string | null = null;
    let terminalFinish = -1;
    let terminalDur = -1;
    for (const id of durations.keys()) {
      const f = finishEst(id);
      const d = durations.get(id) ?? 0;
      if (f > terminalFinish || (f === terminalFinish && d > terminalDur)) {
        terminalFinish = f;
        terminalDur = d;
        terminal = id;
      }
    }

    // onPath guards a `pred` cycle on a malformed graph (the finishEst guard alone
    // doesn't keep `pred` acyclic).
    const path: string[] = [];
    const onPath = new Set<string>();
    for (
      let node = terminal;
      node != null && !onPath.has(node);
      node = pred.get(node) ?? null
    ) {
      onPath.add(node);
      path.unshift(node);
    }
    return { path, duration: terminal == null ? 0 : terminalFinish };
  }

  /**
   * Earliest this task became eligible, independent of slots: the latest of run
   * start, dependency ends, any continuous dependency's *start* (an ordering
   * constraint, not contention), and any earlier batch sibling's end.
   */
  private earliestStart(id: string, runStart: number): number {
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
   * The occupancy timeline (contiguous {@link Segment}s) — single source of truth for
   * slot contention. A `parallelism: false` task occupies the whole pool. Integrates
   * over time rather than sampling one instant, so it's robust to when tasks hand off.
   */
  private buildSegments(
    timed: Array<{ id: string; start: number; end: number }>,
    eligible: Map<string, number>,
    parallel: number
  ): Segment[] {
    const occDelta = new Map<number, number>();
    const waitDelta = new Map<number, number>();
    const monopolyDelta = new Map<number, number>();
    const bump = (m: Map<number, number>, t: number, d: number) =>
      m.set(t, (m.get(t) ?? 0) + d);

    for (const { id, start, end } of timed) {
      const monopolizes = this.taskGraph.tasks[id]?.parallelism === false;
      const weight = monopolizes ? parallel : 1;
      bump(occDelta, start, weight);
      bump(occDelta, end, -weight);
      if (monopolizes) {
        bump(monopolyDelta, start, 1);
        bump(monopolyDelta, end, -1);
      }
      const elig = eligible.get(id) ?? start;
      if (elig < start) {
        bump(waitDelta, elig, 1);
        bump(waitDelta, start, -1);
      }
    }

    const times = Array.from(
      new Set([
        ...occDelta.keys(),
        ...waitDelta.keys(),
        ...monopolyDelta.keys(),
      ])
    ).sort((a, b) => a - b);

    const segments: Segment[] = [];
    let occ = 0;
    let waiting = 0;
    let monopoly = 0;
    for (let i = 0; i < times.length; i++) {
      occ += occDelta.get(times[i]) ?? 0;
      waiting += waitDelta.get(times[i]) ?? 0;
      monopoly += monopolyDelta.get(times[i]) ?? 0;
      const next = times[i + 1];
      if (next != null && next > times[i]) {
        segments.push({ start: times[i], end: next, occ, waiting, monopoly });
      }
    }
    return segments;
  }

  /** Time within [a, b] during which all slots were busy (occ ≥ parallel). */
  private saturatedTime(
    segments: Segment[],
    a: number,
    b: number,
    parallel: number
  ): number {
    let sum = 0;
    for (const s of segments) {
      if (s.occ >= parallel) {
        sum += Math.max(0, Math.min(b, s.end) - Math.max(a, s.start));
      }
    }
    return sum;
  }

  /**
   * Coordinator hashing wall-clock before the first task started (the run window
   * would otherwise miss it). Walk back from the first task start, summing merged
   * hash intervals within {@link PRE_DISPATCH_HASH_GAP} of the previous, stopping at
   * the first larger gap. Matters on a cached run where hashing dominates but tasks
   * restore in milliseconds.
   */
  private preDispatchHashTime(
    firstTaskStart: number,
    hashWindows: Array<[number, number]>
  ): number {
    const merged: Array<[number, number]> = [];
    for (const [s, e] of hashWindows
      .map(([s, e]): [number, number] => [s, Math.min(e, firstTaskStart)])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0])) {
      const last = merged[merged.length - 1];
      if (last && s <= last[1]) {
        last[1] = Math.max(last[1], e);
      } else {
        merged.push([s, e]);
      }
    }
    let total = 0;
    let boundary = firstTaskStart;
    for (let i = merged.length - 1; i >= 0; i--) {
      const [s, e] = merged[i];
      if (e < boundary - PRE_DISPATCH_HASH_GAP) {
        break; // a real gap: everything earlier is stale
      }
      total += e - s;
      boundary = s;
    }
    return total;
  }

  /**
   * Lineage of the LAST task to finish, walking back through whatever it waited on.
   * Unlike the critical path (longest-duration chain), this follows the task that
   * finished last (in a slot-starved run, an off-path task that queued for a slot),
   * so its waits explain the overhead.
   */
  private finishLineage(durations: Map<string, number>): string[] {
    let terminal: string | null = null;
    let maxEnd = -Infinity;
    for (const id of durations.keys()) {
      const end = this.timings.get(id)?.endTime;
      if (end != null && end > maxEnd) {
        maxEnd = end;
        terminal = id;
      }
    }
    const path: string[] = [];
    const seen = new Set<string>();
    for (let node = terminal; node != null && !seen.has(node); ) {
      seen.add(node);
      path.unshift(node);
      node = this.latestFinishingPredecessor(node, durations);
    }
    return path;
  }

  /**
   * The predecessor (dependency or earlier batch sibling) that finished latest, thus
   * gating this task's start. Picks by end time (who held this up), not finish
   * estimate (who makes the floor longest, as in criticalPath).
   */
  private latestFinishingPredecessor(
    id: string,
    durations: Map<string, number>
  ): string | null {
    const start = this.timings.get(id)?.startTime ?? Infinity;
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
    for (const sibling of this.batchSiblings.get(id) ?? []) {
      if (!durations.has(sibling)) {
        continue;
      }
      const end = this.timings.get(sibling)?.endTime ?? -Infinity;
      if (end <= start && end > bestEnd) {
        bestEnd = end;
        best = sibling;
      }
    }
    return best;
  }

  /**
   * The `--parallel` value, recovered from the thread-pool total reported to
   * startCommand: `total = discrete + continuousCount` (see getThreadPoolSize), so
   * subtracting the continuous count gives it back. Falls back to 1.
   */
  private resolveParallel(): number {
    const continuousCount = Object.values(this.taskGraph.tasks).filter(
      (t) => t.continuous
    ).length;
    return Math.max(1, (this.total ?? continuousCount + 1) - continuousCount);
  }

  /**
   * Lineage of the last-finishing task with each link's wait classified
   * (root/dep/slot/hashing/other). Diagnostic only, never displayed; the overhead
   * split is read from the occupancy timeline, not from here.
   */
  private computeFinishChain(
    durations: Map<string, number>,
    eligible: Map<string, number>,
    segments: Segment[],
    hashWindows: Array<[number, number]>,
    parallel: number
  ): ChainLink[] {
    const annotate = (id: string, idx: number): ChainLink => {
      const start = this.timings.get(id)?.startTime ?? 0;
      const ready = eligible.get(id) ?? start;
      const wait = Math.max(0, start - ready);
      let gate: GateKind;
      if (wait <= EPS) {
        gate = idx === 0 ? 'root' : 'dep';
      } else if (
        this.saturatedTime(segments, ready, start, parallel) >=
        wait / 2
      ) {
        gate = 'slot';
      } else {
        gate =
          overlap(ready, start, hashWindows) >= wait / 2 ? 'hashing' : 'other';
      }
      return { id, gate, wait };
    };
    return this.finishLineage(durations).map(annotate);
  }

  /**
   * Longest critical-path tasks that RAN (desc, capped at 3). Cache hits are excluded
   * (their duration is just restore time); no-status tasks (synthetic test runs) are
   * kept.
   */
  private computeCriticalPathTop(
    criticalPathTasks: string[],
    durations: Map<string, number>
  ): Array<{ id: string; duration: number }> {
    return criticalPathTasks
      .filter((id) => {
        const status = this.statuses.get(id);
        return !status || !CACHE_HIT_STATUSES.has(status);
      })
      .map((id) => ({ id, duration: durations.get(id) ?? 0 }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3);
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

  /** The structured performance summary, or `null` when no discrete task timings were recorded. */
  getSummary(): PerformanceSummary | null {
    const timed = this.timedTasks();
    if (timed.length === 0) {
      return null;
    }

    const { durations, totalWork, runStart, taskWindow } =
      computeRunWindow(timed);

    const eligible = new Map<string, number>();
    for (const { id } of timed) {
      eligible.set(id, this.earliestStart(id, runStart));
    }

    const { path: criticalPathTasks, duration: criticalPathDuration } =
      this.criticalPath(durations);

    const parallel = this.resolveParallel();
    const cores = detectCoreCount();

    const segments = this.buildSegments(timed, eligible, parallel);
    const hashWindows = this.hashWindows();
    const finishChain = this.computeFinishChain(
      durations,
      eligible,
      segments,
      hashWindows,
      parallel
    );

    // Pre-dispatch hashing is part of overhead but not the slot split.
    const runDuration =
      taskWindow + this.preDispatchHashTime(runStart, hashWindows);
    const overhead = Math.max(0, runDuration - criticalPathDuration);

    const {
      coordinatorOverhead,
      recoverableByMachines,
      recoverableByParallel,
    } = splitOverhead({
      segments,
      parallel,
      overhead,
      totalWork,
      cores,
      criticalPathDuration,
    });
    const schedulingOverhead = computeSchedulingOverhead(
      segments,
      parallel,
      hashWindows
    );

    const criticalPathTop = this.computeCriticalPathTop(
      criticalPathTasks,
      durations
    );

    const { cacheHits, cacheableCount } = this.computeCacheStats();
    const cacheSkipped = this.cacheSkipped();
    const remoteCacheEnabled = this.remoteCacheEnabled();

    // Coordinator-dominated: hashing/scheduling outweighs task work by >3x the
    // critical path, which keeps cold runs critical-path-bound.
    const coordinatorDominated =
      coordinatorOverhead >= MEANINGFUL_OVERHEAD &&
      coordinatorOverhead > 3 * criticalPathDuration;

    const isCI = this.isCI();
    const distributing = this.distributingTasks();
    const recommendations = buildRecommendation({
      recoverableByParallel,
      recoverableByMachines,
      coordinatorDominated,
      runDuration,
      parallel,
      cores,
      // Can only start distributing in CI when not already doing so.
      canDistribute: isCI && !distributing,
      distributing,
      criticalPathTop,
    });

    return {
      runDuration,
      criticalPathDuration,
      criticalPathTaskCount: criticalPathTasks.length,
      finishChain,
      criticalPathTop,
      overhead,
      recoverableByParallel,
      recoverableByMachines,
      coordinatorOverhead,
      schedulingOverhead,
      parallel,
      cores,
      isCI,
      recommendations,
      coordinatorDominated,
      cacheHits,
      cacheableCount,
      cacheSkipped,
      remoteCacheEnabled,
    };
  }
}

/** The most recently constructed performance lifecycle, read after the run. Cleared once consumed. */
let activePerformanceLifeCycle: PerformanceLifeCycle | null = null;

/**
 * Structured report for the TUI's exit-countdown popup, or null when nothing to
 * show. Clears the active lifecycle so the popup owns the report and a later terminal
 * flush can't re-print it. Best-effort: a throw degrades to null.
 */
export function getPerformanceSummaryPayload(): PerformanceSummaryPayload | null {
  const lifeCycle = activePerformanceLifeCycle;
  if (!lifeCycle) {
    return null;
  }
  try {
    const summary = lifeCycle.getSummary();
    if (!summary) {
      return null;
    }
    activePerformanceLifeCycle = null;
    return buildExitSummaryPayload(summary);
  } catch (e) {
    // Best-effort: the report must never break the run. Surface the cause only under
    // verbose logging so a missing report stays debuggable.
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }
    return null;
  }
}

/**
 * Print the performance report (if enabled) after the run summary. Called once the
 * terminal is restored, so it appears in every output mode including the TUI.
 */
export function flushPerformanceReport(): void {
  const lifeCycle = activePerformanceLifeCycle;
  activePerformanceLifeCycle = null;
  if (!lifeCycle) {
    return;
  }
  // Cosmetic report; a throw (e.g. EPIPE to a closed pipe) must never mask the
  // real task error or fail an otherwise successful run.
  try {
    const summary = lifeCycle.getSummary();
    if (!summary) {
      return;
    }
    // Post-TUI the terminal can still be in raw mode (no \n → \r\n translation),
    // which staircases plain "\n": use \r\n on a TTY, plain \n when piped. Don't add a
    // trailing newline — formatReport already ends with one (an extra broke exact-match
    // e2e snapshots).
    const eol = process.stdout.isTTY ? '\r\n' : '\n';
    process.stdout.write(formatReport(summary).split('\n').join(eol));
  } catch (e) {
    // Best-effort report; never let it affect the run's exit behavior. Surface the
    // cause only under verbose logging.
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }
  }
}

/** Absolute-epoch [start, end] hashing windows from nx's existing `hash*` perf measures; [] if the performance API is unavailable. */
// === Analysis helpers (module-level; no instance state) ===

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
function splitOverhead(args: {
  segments: Segment[];
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
  const {
    segments,
    parallel,
    overhead,
    totalWork,
    cores,
    criticalPathDuration,
  } = args;
  let slotContendedTime = 0;
  let monopolizedContendedTime = 0;
  for (const s of segments) {
    if (s.occ >= parallel && s.waiting > 0) {
      const dur = s.end - s.start;
      slotContendedTime += dur;
      if (s.monopoly > 0) {
        monopolizedContendedTime += dur;
      }
    }
  }
  const recoverableBySlots = Math.min(overhead, slotContendedTime);
  const monopolized = Math.min(recoverableBySlots, monopolizedContendedTime);
  const ordinaryBySlots = recoverableBySlots - monopolized;
  const machineBound =
    parallel < cores
      ? Math.max(0, totalWork / cores - criticalPathDuration)
      : Infinity;
  const ordinaryByMachines = Math.min(ordinaryBySlots, machineBound);
  return {
    coordinatorOverhead: overhead - recoverableBySlots,
    recoverableByMachines: monopolized + ordinaryByMachines,
    recoverableByParallel: ordinaryBySlots - ordinaryByMachines,
  };
}

/** Dispatch/scheduling latency: wall-clock with a free slot (occ < parallel) and a task eligible but unstarted, minus hashing in that window. Diagnostic only, never displayed. */
function computeSchedulingOverhead(
  segments: Segment[],
  parallel: number,
  hashWindows: Array<[number, number]>
): number {
  return segments.reduce((sum, s) => {
    if (s.occ >= parallel || s.waiting === 0) {
      return sum;
    }
    const stalled = s.end - s.start;
    return sum + Math.max(0, stalled - overlap(s.start, s.end, hashWindows));
  }, 0);
}
