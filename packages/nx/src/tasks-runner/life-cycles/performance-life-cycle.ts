import * as os from 'node:os';
import { performance } from 'node:perf_hooks';
import type { BatchInfo } from '../../native';
import { TaskGraph } from '../../config/task-graph';
import { readNxJson } from '../../config/nx-json';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { supportsHyperlinks, terminalLink } from '../../utils/terminal-link';
import { LifeCycle, TaskResult } from '../life-cycle';

const NX_AGENTS_URL = 'https://nx.dev/ci/features/distribute-task-execution';
const NX_REMOTE_CACHE_URL = 'https://nx.dev/ci/features/remote-cache';
const NX_PERFORMANCE_URL =
  'https://nx.dev/docs/concepts/ci-concepts/parallelization-distribution';
/** utm tag attributing report clicks back to it. */
const UTM = '?utm=performance-report';
const NX_PERFORMANCE_LINK = `${NX_PERFORMANCE_URL}${UTM}`;
const NX_AGENTS_LINK = `${NX_AGENTS_URL}${UTM}`;
const NX_REMOTE_CACHE_LINK = `${NX_REMOTE_CACHE_URL}${UTM}`;
/** Visible label for the footer docs link; the href is {@link NX_PERFORMANCE_LINK}. */
const NX_PERFORMANCE_LABEL = `Learn how to improve your run's performance`;
/** Visible URL ⇄ tagged target pairs for {@link linkify}. */
const REPORT_LINKS: ReadonlyArray<{ visible: string; href: string }> = [
  { visible: NX_PERFORMANCE_URL, href: NX_PERFORMANCE_LINK },
  { visible: NX_AGENTS_URL, href: NX_AGENTS_LINK },
];
/**
 * Whole-phrase CTA: the whole sentence is the link. {@link linkify} hyperlinks it
 * on a terminal; the TUI popup hyperlinks it from the phrase + href carried in the
 * exit payload's `links`, so the Rust side keeps no copy of this string.
 */
const NX_REMOTE_CACHE_CTA =
  'Drastically reduce your run duration by sharing a cache across your team and CI';
const PHRASE_LINKS: ReadonlyArray<{ phrase: string; href: string }> = [
  { phrase: NX_REMOTE_CACHE_CTA, href: NX_REMOTE_CACHE_LINK },
];
/** At/below this hit rate, recommend remote cache (if off); above it caching works. */
const LOW_CACHE_HIT_RATE = 0.1;
const CACHE_HIT_STATUSES = new Set([
  'local-cache',
  'local-cache-kept-existing',
  'remote-cache',
]);

/** Wait (ms) below which a task counts as starting on time. 0 = flag every wait. */
const EPS = 0;
/** Below this (ms) overhead is noise, not worth a recommendation. */
const MEANINGFUL_OVERHEAD = 1000;
/** Recommend --parallel when recoverable slot time is at least this fraction of the run. */
const PARALLEL_LEAD_FRACTION = 0.2;
/**
 * Gap (ms) still counted as the same pre-dispatch hashing phase. A larger gap means
 * older, unrelated hashing in the same process (e.g. a daemon's previous run) — excluded.
 */
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

export interface PerformanceSummary {
  runDuration: number;
  criticalPathDuration: number;
  criticalPathTaskCount: number;
  /** Diagnostic only, not displayed; the overhead split comes from the occupancy timeline. */
  finishChain: ChainLink[];
  /**
   * Longest critical-path tasks that ran (desc, capped at a few), cache hits excluded.
   * Named inline by the "speed up or split" rec; empty when the path was fully cached.
   */
  criticalPathTop: Array<{ id: string; duration: number }>;
  /** runDuration − criticalPathDuration. */
  overhead: number;
  /** Overhead split by lever; these + coordinatorOverhead sum to `overhead`. */
  recoverableByParallel: number;
  recoverableByMachines: number;
  /** recoverableByParallel + recoverableByMachines — the slot-contention time. */
  recoverable: number;
  coordinatorOverhead: number;
  /**
   * Diagnostic: dispatch/scheduling latency — time a task was eligible with a free
   * slot but not yet started (hashing excluded). A measured slice of the
   * coordinator residual; never displayed in the report.
   */
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
 * Measures how much wall-clock a run loses to parallelism contention versus its
 * critical-path floor, and prints a report at the end of every run (see
 * `constructLifeCycles`). overhead = runDuration − criticalPathDuration, split by
 * CAUSE off the occupancy timeline: slot-queued time (recoverable by parallelism /
 * machines) versus coordinator time (hashing, scheduling, continuous-dep waits).
 *
 * Scope: discrete tasks only. Continuous tasks (no end time) are excluded from
 * every duration calculation; a discrete task's wait for a continuous dependency
 * to start is treated as eligibility, not contention.
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
    private readonly skipNxCacheOption = false
  ) {
    activePerformanceLifeCycle = this;
  }

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

  /** Hashing windows used to attribute waits to hashing. Overridable in tests. */
  protected hashWindows(): Array<[number, number]> {
    return collectHashWindows();
  }

  /** Whether the cache was bypassed this run. Overridable in tests. */
  protected cacheSkipped(): boolean {
    return (
      this.skipNxCacheOption ||
      process.env.NX_SKIP_NX_CACHE === 'true' ||
      process.env.NX_DISABLE_NX_CACHE === 'true'
    );
  }

  /** Whether a remote (Nx Cloud) cache is active. Overridable in tests. */
  protected remoteCacheEnabled(): boolean {
    try {
      return isNxCloudUsed(readNxJson());
    } catch {
      return false;
    }
  }

  /** Whether the run is in CI. Overridable in tests. */
  protected isCI(): boolean {
    return !!process.env.CI;
  }

  /** Whether the run is already distributing across machines (Agents/DTE). Overridable in tests. */
  protected distributingTasks(): boolean {
    return !!process.env.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT;
  }

  /** Discrete tasks that ran and have a start + end timestamp. */
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
   *
   * Predecessors are real dependencies *plus* earlier batch siblings: a batch runs
   * sequentially in one process, so that ordering is part of the floor too (else
   * unavoidable batch-sequencing time would look recoverable). On equal finish
   * estimates keep the longer-running predecessor. An in-progress guard terminates
   * on a malformed cyclic graph.
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
      // sequencing predecessor; batch executors may run concurrently with staggered
      // starts, and chaining those would inflate the floor. (Matches earliestStart.)
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

    // Walk predecessors back to the root; onPath guards a `pred` cycle on a
    // malformed graph (the finishEst guard alone doesn't keep `pred` acyclic).
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
   * Occupancy timeline: contiguous segments, each carrying slots busy (`occ`) and
   * tasks eligible-but-not-running (`waiting`). A `parallelism: false` task occupies
   * the whole pool. Single source of truth for slot contention; integrates over time
   * rather than sampling one instant, so it's robust to when tasks hand off.
   */
  private buildSegments(
    timed: Array<{ id: string; start: number; end: number }>,
    eligible: Map<string, number>,
    parallel: number
  ): Array<{ start: number; end: number; occ: number; waiting: number }> {
    const occDelta = new Map<number, number>();
    const waitDelta = new Map<number, number>();
    const bump = (m: Map<number, number>, t: number, d: number) =>
      m.set(t, (m.get(t) ?? 0) + d);

    for (const { id, start, end } of timed) {
      const weight =
        this.taskGraph.tasks[id]?.parallelism === false ? parallel : 1;
      bump(occDelta, start, weight);
      bump(occDelta, end, -weight);
      const elig = eligible.get(id) ?? start;
      if (elig < start) {
        bump(waitDelta, elig, 1);
        bump(waitDelta, start, -1);
      }
    }

    const times = Array.from(
      new Set([...occDelta.keys(), ...waitDelta.keys()])
    ).sort((a, b) => a - b);

    const segments: Array<{
      start: number;
      end: number;
      occ: number;
      waiting: number;
    }> = [];
    let occ = 0;
    let waiting = 0;
    for (let i = 0; i < times.length; i++) {
      occ += occDelta.get(times[i]) ?? 0;
      waiting += waitDelta.get(times[i]) ?? 0;
      const next = times[i + 1];
      if (next != null && next > times[i]) {
        segments.push({ start: times[i], end: next, occ, waiting });
      }
    }
    return segments;
  }

  /** Time within [a, b] during which all slots were busy (occ ≥ parallel). */
  private saturatedTime(
    segments: Array<{ start: number; end: number; occ: number }>,
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
   * would otherwise miss it). Union the hash windows, walk back from the first task
   * start, summing each interval within {@link PRE_DISPATCH_HASH_GAP} of the previous,
   * and stop at the first larger gap (older, unrelated hashing). Counts the full
   * phase regardless of how fast tasks then ran — matters on a cached run where
   * hashing dominates but tasks restore in milliseconds.
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
   * Lineage of the LAST task to finish: walk back from max-endTime through whatever
   * it waited on. Unlike the critical path (longest-duration chain), this follows
   * the task that finished last — in a slot-starved run an off-path task that queued
   * for a slot — so its waits explain the overhead.
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
   * The predecessor (dependency or earlier batch sibling) that finished latest, and
   * thus gated this task's start. Mirrors criticalPath's predecessor set, but picks
   * by end time (who held this up) not finish estimate (who makes the floor longest).
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

  /** The structured performance summary, or `null` when no discrete task timings were recorded. */
  getSummary(): PerformanceSummary | null {
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
    const taskWindow = Math.max(0, runEnd - runStart);

    const eligible = new Map<string, number>();
    for (const { id } of timed) {
      eligible.set(id, this.earliestStart(id, runStart));
    }

    const { path: criticalPathTasks, duration: criticalPathDuration } =
      this.criticalPath(durations);

    // startCommand gets `total = discrete + continuousCount` (see getThreadPoolSize),
    // so subtracting the continuous count recovers the `--parallel` value exactly.
    const continuousCount = Object.values(this.taskGraph.tasks).filter(
      (t) => t.continuous
    ).length;
    const parallel = Math.max(
      1,
      (this.total ?? continuousCount + 1) - continuousCount
    );
    // cgroup-aware core count so a quota-capped CI container gets the right lever
    // (more machines, not a --parallel it can't use). cpus() only as fallback.
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;

    const segments = this.buildSegments(timed, eligible, parallel);
    const hashWindows = this.hashWindows();

    // Last-finishing task's lineage, each link's wait classified (slot/hashing/dep).
    // Diagnostic only; the overhead split is read from the occupancy timeline below.
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
    const finishLineageTasks = this.finishLineage(durations);
    const finishChain: ChainLink[] = finishLineageTasks.map(annotate);

    // Pre-dispatch hashing, added to overhead and the coordinator bucket (not the slot split).
    const preDispatchHash = this.preDispatchHashTime(runStart, hashWindows);
    const runDuration = taskWindow + preDispatchHash;
    const overhead = Math.max(0, runDuration - criticalPathDuration);

    // Split overhead by CAUSE off the occupancy timeline: slot contention = wall-clock
    // where every slot was busy AND tasks were queued (occ ≥ parallel with a backlog);
    // everything else is coordinator time. Capped by overhead so the two sum to it.
    const slotContendedTime = segments.reduce(
      (sum, s) =>
        s.occ >= parallel && s.waiting > 0 ? sum + (s.end - s.start) : sum,
      0
    );
    const recoverableBySlots = Math.min(overhead, slotContendedTime);
    const coordinatorOverhead = overhead - recoverableBySlots;
    // Of the slot-recoverable part, --parallel helps while there are spare cores;
    // the volume cores-way parallelism can't absorb (max(0, totalWork/cores − floor))
    // needs more machines. At parallel ≥ cores there's no --parallel headroom.
    const machineBound =
      parallel < cores
        ? Math.max(0, totalWork / cores - criticalPathDuration)
        : Infinity;
    const recoverableByMachines = Math.min(recoverableBySlots, machineBound);
    const recoverableByParallel = recoverableBySlots - recoverableByMachines;
    // Slot-contention total, computed once so payload and report read one number.
    const recoverable = recoverableByParallel + recoverableByMachines;

    // Dispatch/scheduling latency: wall-clock where a slot was free (occ < parallel)
    // AND a task was eligible but unstarted (waiting > 0), minus any hashing in that
    // window — ready work that simply wasn't dispatched yet. A measured view into the
    // coordinator residual; tracked for diagnostics, never displayed.
    const schedulingOverhead = segments.reduce((sum, s) => {
      if (s.occ >= parallel || s.waiting === 0) {
        return sum;
      }
      const stalled = s.end - s.start;
      return sum + Math.max(0, stalled - overlap(s.start, s.end, hashWindows));
    }, 0);

    // Longest critical-path tasks that RAN — the lever when no parallelism lever
    // applies. Cache hits excluded (their duration is just restore time); tasks with
    // no recorded status (e.g. synthetic test runs) are kept.
    const criticalPathTop = criticalPathTasks
      .filter((id) => {
        const status = this.statuses.get(id);
        return !status || !CACHE_HIT_STATUSES.has(status);
      })
      .map((id) => ({ id, duration: durations.get(id) ?? 0 }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3);

    // Cache outcome: restored vs ran. No-status tasks (synthetic test runs) count for neither.
    let cacheHits = 0;
    let cacheRan = 0;
    for (const status of this.statuses.values()) {
      if (CACHE_HIT_STATUSES.has(status)) {
        cacheHits++;
      } else if (status === 'success') {
        cacheRan++;
      }
    }
    const cacheableCount = cacheHits + cacheRan;
    const cacheSkipped = this.cacheSkipped();
    const remoteCacheEnabled = this.remoteCacheEnabled();

    // Coordinator-dominated when hashing/scheduling outweighs task work >3x the
    // critical path. The >3x bar keeps cold runs critical-path-bound when hashing
    // merely edges past them.
    const coordinatorDominated =
      coordinatorOverhead >= MEANINGFUL_OVERHEAD &&
      coordinatorOverhead > 3 * criticalPathDuration;

    const isCI = this.isCI();
    const distributing = this.distributingTasks();
    // Can only recommend starting to distribute in CI when not already doing so.
    const canDistribute = isCI && !distributing;
    const recommendations = buildRecommendation({
      recoverableByParallel,
      recoverableByMachines,
      coordinatorDominated,
      runDuration,
      cores,
      canDistribute,
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
      recoverable,
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
 * show. Clears the active lifecycle so the popup owns the report and a later
 * terminal flush can't re-print it. Best-effort: a throw degrades to null.
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
  } catch {
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
    // which staircases plain "\n". Use \r\n on a TTY; plain \n when piped.
    const eol = process.stdout.isTTY ? '\r\n' : '\n';
    process.stdout.write(formatReport(summary).split('\n').join(eol) + eol);
  } catch {
    // best-effort report; never let it affect the run's exit behavior
  }
}

/**
 * Absolute-epoch [start, end] hashing windows, read from nx's existing `hash*` perf
 * measures. Returns [] if the performance API is unavailable.
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
 * Actionable levers to go faster, one rec per lever (pure advice; the header stats
 * already diagnose the run). The critical-path case has two (shorten the chain,
 * distribute the rest). Agents advice is omitted unless `canDistribute`.
 */
function buildRecommendation(args: {
  recoverableByParallel: number;
  recoverableByMachines: number;
  coordinatorDominated: boolean;
  runDuration: number;
  cores: number;
  canDistribute: boolean;
  distributing: boolean;
  criticalPathTop: Array<{ id: string; duration: number }>;
}): string[] {
  const {
    recoverableByParallel,
    recoverableByMachines,
    coordinatorDominated,
    runDuration,
    cores,
    canDistribute,
    distributing,
    criticalPathTop,
  } = args;

  if (distributing) {
    // Already on agents: more agents (not local --parallel) is the parallelism lever,
    // sized by total recoverable slot-contention. The cores/machine framing below
    // doesn't apply to a distributed run.
    const recoverable = recoverableByParallel + recoverableByMachines;
    if (
      runDuration > 0 &&
      recoverable >= PARALLEL_LEAD_FRACTION * runDuration
    ) {
      return [
        `Add more Nx Agents to recover up to ${formatDuration(recoverable)}.`,
      ];
    }
  } else {
    // Slot-bound with spare cores: the lever is local --parallel, not agents.
    if (
      runDuration > 0 &&
      recoverableByParallel >= PARALLEL_LEAD_FRACTION * runDuration &&
      recoverableByParallel >= recoverableByMachines
    ) {
      return [
        `Increase parallelism to recover up to ${formatDuration(
          recoverableByParallel
        )}.`,
      ];
    }
    // Machine-bound: at the core count and still queuing. Agents for CPU-bound work;
    // otherwise only the I/O-bound --parallel tip applies.
    if (recoverableByMachines >= MEANINGFUL_OVERHEAD) {
      const base = `You're at this machine's ${cores} ${pluralizeCores(
        cores
      )} and tasks are still queuing for a slot.`;
      return [
        canDistribute
          ? `${base} If they're CPU-bound, distribute across machines with Nx Agents → ${NX_AGENTS_LINK}; if they're I/O-bound, a higher --parallel may help instead.`
          : `${base} If they're I/O-bound, a higher --parallel may help.`,
      ];
    }
    // Coordinator-dominated (tasks fast or cached), machine ~maxed: in CI agents are
    // the only lever; locally nothing actionable, so no recommendation.
    if (coordinatorDominated) {
      return canDistribute
        ? [
            `This run was about as fast as this machine can do it. Distribute the work across multiple machines with Nx Agents to make it faster → ${NX_AGENTS_LINK}.`,
          ]
        : [];
    }
  }
  // Critical-path-bound: shorten the chain's longest tasks (named inline, they ARE
  // the lever) and distribute the rest. Nothing ran (fully cached) → no rec.
  if (criticalPathTop.length === 0) {
    return [];
  }
  const speedUp = [
    `Speed up or split the longest tasks on the critical path:`,
    ...formatTopTaskRows(criticalPathTop),
  ].join('\n');
  const recommendations = [speedUp];
  if (canDistribute) {
    recommendations.push(
      `Distribute tasks across multiple machines with Nx Agents to increase parallelism without overwhelming resource usage → ${NX_AGENTS_LINK}.`
    );
  }
  return recommendations;
}

/** Render the longest critical-path tasks as aligned columns: task (left), duration (right). */
function formatTopTaskRows(
  tasks: Array<{ id: string; duration: number }>
): string[] {
  // The only caller returns early when empty, so `tasks` is non-empty here.
  const idWidth = Math.max(...tasks.map((t) => t.id.length));
  const durations = tasks.map((t) => formatDuration(t.duration));
  const durWidth = Math.max(...durations.map((d) => d.length));
  return tasks.map((t, i) => {
    const id = t.id.padEnd(idWidth);
    const dur = durations[i].padStart(durWidth);
    return `  ${id}    ${dur}`;
  });
}

function pluralizeCores(cores: number): string {
  return cores === 1 ? 'core' : 'cores';
}

/**
 * Recommendations in display order, cheapest first: "recover up to X" parallelism
 * lever → remote-cache rec → other levers → "speed up / split" LAST (deepest manual
 * work, the only multi-line rec). Shared by the report and TUI payload.
 */
function orderedRecommendations(s: PerformanceSummary): string[] {
  const levers = [...s.recommendations];
  const cacheAdvice = buildCacheAdvice(s);
  const isRecoverLever = (r: string) => r.includes('recover up to');
  const isLongestTasks = (r: string) => r.includes('\n');
  return [
    ...levers.filter(isRecoverLever),
    ...(cacheAdvice ? [cacheAdvice] : []),
    ...levers.filter((r) => !isRecoverLever(r) && !isLongestTasks(r)),
    ...levers.filter(isLongestTasks),
  ];
}

/**
 * Structured payload for the TUI's exit-countdown popup, which builds the visual
 * natively in Rust (the terminal path uses {@link formatReport}). Field names map
 * to the napi object's camelCase (see `PerformanceSummaryPayload`).
 */
export interface PerformanceSummaryPayload {
  runDurationMs: number;
  criticalPathMs: number;
  criticalPathTaskCount: number;
  recoverableMs: number;
  /** Omitted when there's no cache outcome to show. */
  cacheHits?: number;
  cacheableCount?: number;
  cacheSkipped: boolean;
  /** Already in display order; a multi-line entry embeds the task list. */
  recommendations: string[];
  /** The docs footer link the popup renders and hyperlinks (label + tagged href). */
  footer: { text: string; href: string };
  /**
   * Recommendation phrases the popup should hyperlink in place (currently just the
   * remote-cache CTA). The popup links the text it was given to the href — no
   * hardcoded URLs or byte-identical label constants on the Rust side. Empty when
   * none apply.
   */
  links: Array<{ text: string; href: string }>;
}

function buildExitSummaryPayload(
  s: PerformanceSummary
): PerformanceSummaryPayload {
  const hasCache = s.cacheableCount > 0;
  const recommendations = orderedRecommendations(s);
  return {
    runDurationMs: s.runDuration,
    criticalPathMs: s.criticalPathDuration,
    criticalPathTaskCount: s.criticalPathTaskCount,
    recoverableMs: s.recoverable,
    cacheHits: hasCache ? s.cacheHits : undefined,
    cacheableCount: hasCache ? s.cacheableCount : undefined,
    cacheSkipped: s.cacheSkipped,
    recommendations,
    footer: { text: NX_PERFORMANCE_LABEL, href: NX_PERFORMANCE_LINK },
    // The remote-cache CTA is a whole-phrase link; surface it for the popup only
    // when that rec is actually shown (matches the terminal report).
    links: recommendations.some((r) => r.includes(NX_REMOTE_CACHE_CTA))
      ? [{ text: NX_REMOTE_CACHE_CTA, href: NX_REMOTE_CACHE_LINK }]
      : [],
  };
}

/**
 * Make the report's docs links clickable on OSC 8 terminals (URL-links → clean-URL
 * hyperlink; phrase-links → whole sentence hyperlinks). Without OSC 8 (CI, pipes)
 * URLs print verbatim and phrase-links get the URL appended. Terminal-only: never
 * run this over the TUI popup strings — ratatui strips the escape bytes, so the
 * popup re-creates the links natively.
 */
function linkify(text: string): string {
  let out = text;
  if (!supportsHyperlinks()) {
    // No clickable target: surface each phrase-link's URL inline.
    for (const { phrase, href } of PHRASE_LINKS) {
      out = out.split(phrase).join(`${phrase} → ${href}`);
    }
    return out;
  }
  for (const { visible, href } of REPORT_LINKS) {
    out = out.split(href).join(terminalLink(visible, href));
  }
  for (const { phrase, href } of PHRASE_LINKS) {
    out = out.split(phrase).join(terminalLink(phrase, href));
  }
  return out;
}

export function formatReport(s: PerformanceSummary): string {
  const fmt = formatDuration;
  // Shows two of run duration's three parts (critical path + recoverable); the third,
  // coordinator overhead, is computed but not displayed, so the two don't sum to run
  // duration. "Critical path", not "floor" — durations shift with --parallel.
  const recoverable = s.recoverable;
  const recoverablePct =
    s.runDuration > 0 ? Math.round((recoverable / s.runDuration) * 100) : 0;
  const stat = (label: string, value: string) =>
    `  ${`${label}:`.padEnd(25)}  ${value}`;
  // No leading blank line: nx's run summary already prints trailing blanks before this.
  const cache = cacheStat(s);
  const lines = [
    stat('Run duration', fmt(s.runDuration)),
    ...(cache ? [stat('Cache', cache)] : []),
    stat(
      'Critical path',
      `${fmt(s.criticalPathDuration)}   (${s.criticalPathTaskCount} tasks)`
    ),
    stat(
      'Recoverable time',
      recoverable > 0
        ? `${fmt(recoverable)}   (${recoverablePct}% of the run)`
        : fmt(recoverable)
    ),
  ];
  const recommendations = orderedRecommendations(s);
  // A rec may be multi-line (the critical-path one embeds a task list); indent
  // continuation lines under the bullet.
  const renderRec = (r: string): string[] => {
    const [first, ...rest] = r.split('\n');
    return [`    - ${first}`, ...rest.map((l) => `      ${l}`)];
  };
  // Nothing actionable → no recommendation section.
  if (recommendations.length > 0) {
    const onlySingleLine =
      recommendations.length === 1 && !recommendations[0].includes('\n');
    if (onlySingleLine) {
      lines.push('', `  Recommendation: ${linkify(recommendations[0])}`);
    } else {
      lines.push(
        '',
        '  Recommendations:',
        ...recommendations.flatMap((r) => renderRec(linkify(r)))
      );
    }
  }
  // Footer guide, utm-tagged. linkify shows the clean URL and hides the utm in the
  // OSC 8 target; without OSC 8 the tagged URL prints verbatim (auto-linked).
  lines.push('', linkify(`  ${NX_PERFORMANCE_LABEL} → ${NX_PERFORMANCE_LINK}`));
  lines.push('');
  return lines.join('\n');
}

/** Top-of-report cache stat: hit rate or skip marker. Null when there's no cache outcome. */
function cacheStat(s: PerformanceSummary): string | null {
  if (s.cacheSkipped) {
    return 'Skipped (--skip-nx-cache)';
  }
  if (s.cacheableCount === 0) {
    return null;
  }
  const pct = Math.round((s.cacheHits / s.cacheableCount) * 100);
  return `${s.cacheHits}/${s.cacheableCount} hit (${pct}%)`;
}

/**
 * Bottom-of-report cache advice, only when there's a lever: a skipped cache (drop
 * the flag) or a barely-used cache with no remote (set up Nx Cloud).
 */
function buildCacheAdvice(s: PerformanceSummary): string | null {
  if (s.cacheSkipped) {
    return `Cache: drop --skip-nx-cache to restore unchanged tasks instantly.`;
  }
  if (s.cacheableCount === 0) {
    return null;
  }
  // Recommend Nx Cloud only when local caching is barely helping AND remote is off.
  const hitRate = s.cacheHits / s.cacheableCount;
  if (!s.remoteCacheEnabled && hitRate <= LOW_CACHE_HIT_RATE) {
    // Whole sentence is the link (see PHRASE_LINKS / linkify).
    return `${NX_REMOTE_CACHE_CTA}.`;
  }
  return null;
}

/** Format a millisecond duration as e.g. "3m 30s", "13.4s", or "470ms". */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = Math.round(ms / 100) / 10; // seconds, rounded to 0.1
  if (seconds >= 60) {
    const totalSeconds = Math.round(ms / 1000);
    return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
  }
  return `${seconds.toFixed(1)}s`;
}
