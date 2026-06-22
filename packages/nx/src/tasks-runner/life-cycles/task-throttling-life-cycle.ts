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
/** Docs guide on speeding up runs (parallelism, distribution, caching). */
const NX_PERFORMANCE_URL =
  'https://nx.dev/docs/concepts/ci-concepts/parallelization-distribution';
/** utm tag attributing all clicks from this report back to it. */
const UTM = '?utm=performance-report';
/**
 * The clickable *targets* for the report's docs links — same pages, utm-tagged so
 * we can attribute the traffic to this report. The recommendation strings embed
 * these tagged links (so the value is preserved even where they render as plain
 * text — the TUI popup and CI logs); on an OSC 8 terminal {@link linkify} swaps
 * the visible text back to the clean URL (or a label) while keeping the tagged href.
 */
const NX_PERFORMANCE_LINK = `${NX_PERFORMANCE_URL}${UTM}`;
const NX_AGENTS_LINK = `${NX_AGENTS_URL}${UTM}`;
const NX_REMOTE_CACHE_LINK = `${NX_REMOTE_CACHE_URL}${UTM}`;
/**
 * Visible text ⇄ tagged target pairs, for {@link linkify} (href = url + UTM).
 * The perf/agents pages show the clean URL; the remote-cache page shows a
 * descriptive label instead (its rec reads naturally as "→ Nx Cloud remote
 * cache" once the URL is hidden behind the OSC 8 link).
 */
const REPORT_LINKS: ReadonlyArray<{ visible: string; href: string }> = [
  { visible: NX_PERFORMANCE_URL, href: NX_PERFORMANCE_LINK },
  { visible: NX_AGENTS_URL, href: NX_AGENTS_LINK },
  { visible: 'Nx Cloud remote cache', href: NX_REMOTE_CACHE_LINK },
];
/**
 * At or below this hit rate the cache is barely helping; if remote cache is also
 * off, recommend it. Above it, caching is working — no recommendation.
 */
const LOW_CACHE_HIT_RATE = 0.1;
/** Task statuses that mean the result came from cache (didn't re-run). */
const CACHE_HIT_STATUSES = new Set([
  'local-cache',
  'local-cache-kept-existing',
  'remote-cache',
]);

/** Wait (ms) below which a task counts as starting on time. 0 = flag every wait. */
const EPS = 0;
/** A bucket below this (ms) isn't worth a recommendation — effectively noise. */
const MEANINGFUL_OVERHEAD = 1000;
/**
 * The --parallel lever is recommended when the slot time it would recover is at
 * least this fraction of the run (a relative bar that scales with run size).
 */
const PARALLEL_LEAD_FRACTION = 0.2;
/**
 * Gap (ms) that still counts as the same pre-dispatch hashing phase. Hash
 * measures back-to-back before the first task (and the scheduling gap before
 * dispatch) sit well under this; a larger gap means older, unrelated hashing in
 * the same process (e.g. a daemon's previous run) that we exclude.
 */
const PRE_DISPATCH_HASH_GAP = 1000;

interface TaskTiming {
  startTime?: number;
  endTime?: number;
  continuous: boolean;
}

/** How a task on the critical path was held up before it started. */
type GateKind = 'root' | 'dep' | 'slot' | 'hashing' | 'other';

interface ChainLink {
  id: string;
  gate: GateKind;
  /** How long this task waited after becoming eligible before it started. */
  wait: number;
}

export interface ThrottleSummary {
  runDuration: number;
  criticalPathDuration: number;
  /** Number of tasks on the critical path (the floor). */
  criticalPathTaskCount: number;
  /**
   * The lineage of the last task to finish (root → terminal), each link tagged
   * with how it was held up. Diagnostic only — the overhead split is read from
   * the occupancy timeline, not this chain. Not displayed.
   */
  finishChain: ChainLink[];
  /**
   * The longest critical-path tasks that actually ran (by duration, descending),
   * capped at a few. Cache hits are excluded (their duration is just restore
   * time). These are what the "speed up or split" recommendation names inline;
   * empty when the critical path was fully cached.
   */
  criticalPathTop: Array<{ id: string; duration: number }>;
  /** runDuration − criticalPathDuration: total overhead above the floor. */
  overhead: number;
  /**
   * The overhead split by recovering lever; these three sum to `overhead`:
   * `--parallel` (spare cores), more machines (at core count), and coordinator
   * overhead (hashing/scheduling — not recoverable by parallelism).
   */
  recoverableByParallel: number;
  recoverableByMachines: number;
  /** recoverableByParallel + recoverableByMachines — the slot-contention time. */
  recoverable: number;
  coordinatorOverhead: number;
  parallel: number;
  cores: number;
  isCI: boolean;
  /** One actionable recommendation per lever; rendered as a list when >1. */
  recommendations: string[];
  /**
   * Coordinator overhead (hashing/scheduling) outweighs the actual task work —
   * so the longest tasks aren't the lever and aren't shown. Typical of a cached
   * run, where tasks restore instantly and hashing dominates.
   */
  coordinatorDominated: boolean;
  /** Tasks whose result was read from cache (didn't re-run). */
  cacheHits: number;
  /** Tasks that had a cache outcome at all (hits + tasks that ran). */
  cacheableCount: number;
  /** The run bypassed the cache (`--skip-nx-cache`). */
  cacheSkipped: boolean;
  /** A remote (Nx Cloud) cache was active for this run. */
  remoteCacheEnabled: boolean;
}

/**
 * Measures how much wall-clock time a run loses to parallelism contention versus
 * the lower bound imposed by the task graph (its critical path), and prints a
 * report at the end of every run (see `constructLifeCycles`).
 *
 * Two headline quantities, both derived purely from task start/end times:
 *
 *   overhead = runDuration − criticalPathDuration
 *
 * the total wall-clock above the floor (the critical path is the fastest the run
 * could go with unlimited slots), and a split of that overhead by CAUSE — read
 * off the occupancy timeline: time tasks spent queued for a slot while every slot
 * was busy (recoverable by more parallelism or more machines) versus everything
 * else — hashing, scheduling, the chain root waiting on a continuous dependency,
 * plus any hashing before the first task — which parallelism can't fix.
 *
 * Scope: discrete tasks only. Continuous tasks (no end time) are excluded from
 * every duration calculation; a discrete task's wait for a continuous dependency
 * to start is treated as eligibility, not contention.
 */
export class TaskThrottlingLifeCycle implements LifeCycle {
  private readonly timings = new Map<string, TaskTiming>();
  /** taskId → its terminal status (cache hit vs ran), for the cache summary. */
  private readonly statuses = new Map<string, TaskResult['status']>();
  /** Thread pool size reported to startCommand (discrete + continuous). */
  private total: number | undefined;
  /** taskId → ids of the other tasks in its batch (batches run sequentially). */
  private readonly batchSiblings = new Map<string, string[]>();

  constructor(
    private readonly taskGraph: TaskGraph,
    /** The run's `--skip-nx-cache` flag (the env-var forms are checked too). */
    private readonly skipNxCacheOption = false
  ) {
    activeThrottleLifeCycle = this;
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
    // endTasks is called incrementally (per group/batch), not once at the end;
    // we accumulate into the map so the last call sees every timing.
    for (const { task, status } of taskResults) {
      const entry = this.entry(task.id);
      // Use `!= null` (not truthiness): a real epoch timestamp is never 0, but
      // synthetic/relative timelines can legitimately start at 0.
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

  endCommand(): void {
    // In TUI mode the report is rendered inside the exit-countdown popup rather
    // than printed to the terminal. The sink (set by run-command when the TUI is
    // active) pushes the formatted report into the live TUI here, while it's still
    // up; non-TUI runs leave the sink unset and print via flushThrottleReport.
    if (!exitSummarySink) {
      return;
    }
    // endCommand runs in the tasks-runner's `finally`, so a throw here would
    // replace the real task results. The report is cosmetic — degrade to no
    // report rather than ever crash the run (same stance as remoteCacheEnabled).
    try {
      const summary = this.getSummary();
      if (summary) {
        exitSummarySink(buildExitSummaryPayload(summary));
        // The popup now owns the report; drop the active lifecycle so a later
        // terminal flush (e.g. on the error path) can't re-print it.
        activeThrottleLifeCycle = null;
      }
    } catch {
      // best-effort report; never let it affect the run
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

  /**
   * Hashing windows used to attribute free-slot waits to hashing. Overridable in
   * tests (the real source is the process-global `performance` measures).
   */
  protected hashWindows(): Array<[number, number]> {
    return collectHashWindows();
  }

  /** Whether the cache was bypassed this run (`--skip-nx-cache`). Overridable in tests. */
  protected cacheSkipped(): boolean {
    return (
      this.skipNxCacheOption ||
      process.env.NX_SKIP_NX_CACHE === 'true' ||
      process.env.NX_DISABLE_NX_CACHE === 'true'
    );
  }

  /** Whether a remote (Nx Cloud) cache is active for this run. Overridable in tests. */
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

  /**
   * Whether this run is already distributing tasks across machines (Nx Agents /
   * DTE). When it is, recommending agents is pointless. Overridable in tests.
   */
  protected distributingTasks(): boolean {
    return !!process.env.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT;
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
   * Longest-duration chain through the dependency DAG — the floor on how fast
   * the run could go with unlimited slots. `finishEst[t] = duration[t] +
   * max(finishEst[p] for predecessors p)`.
   *
   * Predecessors are real dependencies *plus* earlier batch siblings: a batch
   * runs its tasks sequentially in one process, so that ordering is part of the
   * floor too (otherwise unavoidable batch-sequencing time would look like
   * recoverable overhead). On equal finish estimates we keep the longer-running
   * predecessor so the path matches the tasks that actually gate the finish.
   * An in-progress guard makes it terminate on a (malformed) cyclic graph.
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
      // Only a batch sibling that actually FINISHED before this task started was
      // a real sequencing predecessor. Batch executors may run tasks
      // concurrently and stamp merely-staggered starts; chaining those would
      // inflate the floor and hide real overhead. (Matches earliestStart's rule.)
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

    // Walk predecessors back to the root. Guard against a `pred` cycle: the
    // finishEst guard above keeps the recurrence finite, but on a malformed
    // cyclic graph `pred` can still form a loop, which would spin this walk.
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
   * The earliest this task could have started — the moment it became eligible,
   * independent of slots. The latest of: the run's start; its dependencies'
   * ends; the *start* of any continuous dependency (a discrete task can't run
   * until its `serve` is up, but that's an ordering constraint, not contention);
   * and any earlier batch sibling's end. Derived from start/end times only.
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
   * Occupancy timeline: contiguous segments over the run, each carrying how many
   * slots were busy (`occ`) and how many tasks were eligible-but-not-running
   * (`waiting`). A `parallelism: false` task occupies the whole pool. This is the
   * single source of truth for slot contention — it integrates over time rather
   * than sampling one instant, so it's robust to exactly *when* tasks hand off.
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
   * Coordinator hashing wall-clock that ran before the first task started — the
   * run window would otherwise miss it. We count the contiguous hashing phase
   * leading up to dispatch: union the hash windows into disjoint intervals, then
   * walk back from the first task start, summing each interval whose end reaches
   * within {@link PRE_DISPATCH_HASH_GAP} of the previous one, and stop at the
   * first larger gap (older, unrelated hashing in the same process). This counts
   * the full phase regardless of how fast the tasks then ran — a task-window
   * bound collapsed on a cached run, where hashing dominates but the tasks
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
   * The lineage of the LAST task to finish: walk back from the max-endTime task
   * through whatever it waited on (its latest-finishing dependency or batch
   * predecessor). This is "what determined the finish" — and unlike the critical
   * path (the longest-*duration* chain = the floor), it follows the task that
   * actually finished last, which in a slot-starved run may be an off-path task
   * that queued for a slot. Its waits are therefore what explain the overhead.
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
   * The predecessor (real dependency or earlier batch sibling) that finished
   * latest, and thus gated this task's start. Mirrors criticalPath's predecessor
   * set, but picks by end time (who held this one up) rather than finish
   * estimate (who makes the floor longest).
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
    const taskWindow = Math.max(0, runEnd - runStart);

    const eligible = new Map<string, number>();
    for (const { id } of timed) {
      eligible.set(id, this.earliestStart(id, runStart));
    }

    const { path: criticalPathTasks, duration: criticalPathDuration } =
      this.criticalPath(durations);

    // Discrete parallelism: startCommand is handed `total = discrete +
    // continuousCount` (see getThreadPoolSize), so subtracting the continuous
    // count recovers the `--parallel` value exactly.
    const continuousCount = Object.values(this.taskGraph.tasks).filter(
      (t) => t.continuous
    ).length;
    const parallel = Math.max(
      1,
      (this.total ?? continuousCount + 1) - continuousCount
    );
    // Use the cgroup-aware core count so a quota-capped CI container gets the
    // right lever (more machines, not a higher --parallel it can't use). Fall
    // back to cpus().length only when availableParallelism is unavailable.
    const cores =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;

    // Occupancy timeline + hashing windows, used to classify each chain link's
    // wait (slot vs coordinator) over its whole window, not at a single instant.
    const segments = this.buildSegments(timed, eligible, parallel);
    const hashWindows = this.hashWindows();

    // The chain that DETERMINED THE FINISH: the last-finishing task's lineage,
    // with each link's wait classified (slot vs hashing vs dep). Surfaced in the
    // summary for diagnostics — e.g. to explain why an off-path task that queued
    // for a slot ended up finishing last. The overhead split itself is read from
    // the occupancy timeline below, not from this chain.
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

    // Coordinator hashing that ran BEFORE the first task started — the task
    // window would otherwise miss it. Added to both the overhead and the
    // coordinator bucket below, so it surfaces without touching the slot split.
    const preDispatchHash = this.preDispatchHashTime(runStart, hashWindows);
    const runDuration = taskWindow + preDispatchHash;
    const overhead = Math.max(0, runDuration - criticalPathDuration);

    // Split the overhead by CAUSE off the occupancy timeline: slot contention is
    // wall-clock where every slot was busy AND tasks were queued (occ ≥ parallel
    // with a backlog) — exactly what more slots would remove. Everything else
    // (hashing, scheduling gaps, waiting on a continuous dep) is coordinator time.
    // Capped by the overhead so the two always sum to it.
    const slotContendedTime = segments.reduce(
      (sum, s) =>
        s.occ >= parallel && s.waiting > 0 ? sum + (s.end - s.start) : sum,
      0
    );
    const recoverableBySlots = Math.min(overhead, slotContendedTime);
    const coordinatorOverhead = overhead - recoverableBySlots;
    // Of the slot-recoverable part, raising --parallel helps while the machine
    // has spare cores; the volume even cores-way parallelism can't absorb
    // (max(0, totalWork/cores − floor)) needs more machines. At parallel ≥ cores
    // there is no --parallel headroom, so it's all machine-bound.
    const machineBound =
      parallel < cores
        ? Math.max(0, totalWork / cores - criticalPathDuration)
        : Infinity;
    const recoverableByMachines = Math.min(recoverableBySlots, machineBound);
    const recoverableByParallel = recoverableBySlots - recoverableByMachines;
    // The slot-contention total. Computed once here so the payload and the
    // terminal report read one number instead of re-summing the two halves.
    const recoverable = recoverableByParallel + recoverableByMachines;

    // The longest critical-path tasks that actually RAN — the real lever for going
    // faster when no parallelism lever applies. Cache hits are excluded: their
    // duration is just restore time, so "speed these up" wouldn't apply. Tasks
    // with no recorded status (e.g. synthetic test runs) are kept.
    const criticalPathTop = criticalPathTasks
      .filter((id) => {
        const status = this.statuses.get(id);
        return !status || !CACHE_HIT_STATUSES.has(status);
      })
      .map((id) => ({ id, duration: durations.get(id) ?? 0 }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3);

    // Cache outcome: how many tasks were restored from cache vs ran. Tasks with
    // no recorded status (e.g. synthetic test runs) don't count toward either.
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

    // Coordinator-dominated: hashing/scheduling clearly outweighs the task work
    // (>3x the critical path) — e.g. a heavily-cached run. The >3x bar keeps cold
    // runs with real work critical-path-bound even when hashing edges past them.
    const coordinatorDominated =
      coordinatorOverhead >= MEANINGFUL_OVERHEAD &&
      coordinatorOverhead > 3 * criticalPathDuration;

    const isCI = this.isCI();
    const distributing = this.distributingTasks();
    // We can only recommend STARTING to distribute in CI when not already doing so.
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

/**
 * The most recently constructed throttle lifecycle, so `flushThrottleReport` can
 * print after the TUI tears down (the TUI no-ops `console` during the run, so the
 * report can't come from `endCommand`). Cleared on flush.
 */
let activeThrottleLifeCycle: TaskThrottlingLifeCycle | null = null;

/**
 * When set, the throttle report is handed to this sink at `endCommand` (while the
 * TUI is still up) instead of being printed to the terminal. run-command wires
 * this to the TUI's exit-countdown popup for local runs; non-TUI runs leave it
 * unset and the report is printed via {@link flushThrottleReport}.
 */
let exitSummarySink: ((payload: ThrottleExitSummaryPayload) => void) | null =
  null;

export function setThrottleExitSummarySink(
  sink: ((payload: ThrottleExitSummaryPayload) => void) | null
): void {
  exitSummarySink = sink;
}

/**
 * Print the throttle report (if enabled) after the run summary. Called from
 * run-command once the terminal has been restored, so it appears in every output
 * mode — including the TUI, which no-ops `console` during the run.
 */
export function flushThrottleReport(): void {
  const lifeCycle = activeThrottleLifeCycle;
  activeThrottleLifeCycle = null;
  if (!lifeCycle) {
    return;
  }
  // The report is cosmetic; a throw here (e.g. EPIPE writing to a closed pipe)
  // must never mask the real task error on the failure path or fail an otherwise
  // successful run. Degrade to no report.
  try {
    const summary = lifeCycle.getSummary();
    if (!summary) {
      return;
    }
    // After the TUI tears down, the terminal can still be in raw mode (no
    // \n → \r\n translation), which staircases plain "\n" output. Use \r\n on a
    // TTY; keep plain \n when piped so logs/files don't get stray carriage returns.
    const eol = process.stdout.isTTY ? '\r\n' : '\n';
    process.stdout.write(formatReport(summary).split('\n').join(eol) + eol);
  } catch {
    // best-effort report; never let it affect the run's exit behavior
  }
}

/**
 * Absolute-epoch [start, end] windows during which the coordinator was hashing,
 * read from nx's existing `hashSingleTask` / `hashMultipleTasks` perf measures.
 * Returns [] if the performance API is unavailable.
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
 * The actionable levers to go faster, one recommendation per lever. The header
 * stats already diagnose the run, so these are pure advice — they don't restate
 * those numbers. Most cases have one lever; the critical-path case has two
 * (shorten the chain, and distribute the rest). `canDistribute` is false outside
 * CI and when the run is already distributing, so agents advice is omitted then.
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
    // Already on agents: more agents (not local --parallel) is the parallelism
    // lever, sized by the total recoverable slot-contention time. The local
    // cores / machine-bound framing below doesn't apply to a distributed run.
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
    // Slot-bound: raising --parallel would recover a meaningful share, and there
    // are still spare cores — so the lever is local parallelism, not agents.
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
    // Machine-bound: at the core count and still queuing. Agents are the lever for
    // CPU-bound work; otherwise only the I/O-bound --parallel tip applies.
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
    // Coordinator-dominated (tasks fast or cached): the machine is about maxed
    // out. In CI, agents are the only lever; locally there's nothing actionable,
    // so make no recommendation — the header stats already say it all.
    if (coordinatorDominated) {
      return canDistribute
        ? [
            `This run was about as fast as this machine can do it. Distribute the work across multiple machines with Nx Agents to make it faster → ${NX_AGENTS_LINK}.`,
          ]
        : [];
    }
  }
  // Critical-path-bound: shorten the chain's longest tasks (named inline, since
  // they ARE the lever), and distribute the rest to free cores for the chain. If
  // nothing ran on the critical path (a fully-cached run), there's nothing to
  // speed up — make no recommendation.
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

/**
 * Render the longest critical-path tasks as aligned columns: task (left),
 * duration (right). Column widths are sized to the rows so it reads as a table.
 * Lightly indented (2 spaces) — these rows nest inside a recommendation bullet,
 * which adds its own continuation indent.
 */
function formatTopTaskRows(
  tasks: Array<{ id: string; duration: number }>
): string[] {
  // The only caller (buildRecommendation's speed-up lever) returns early when
  // criticalPathTop is empty, so `tasks` is always non-empty here.
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
 * The recommendations in display order, cheapest action first: the "recover up to
 * X" parallelism lever (raise --parallel, or add agents when distributing) →
 * remote-cache rec → other levers → "speed up / split the longest tasks" LAST
 * (deepest manual work; the only multi-line rec). Shared by the terminal report
 * and the TUI payload so both order identically.
 */
function orderedRecommendations(s: ThrottleSummary): string[] {
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
 * Structured payload handed to the TUI's exit-countdown popup. The popup builds
 * the visual natively in Rust from these numbers (so it can style the columns
 * and recommendations); the terminal path uses {@link formatReport} instead.
 * Field names map to the napi object's camelCase (see `ThrottleExitSummary`).
 */
export interface ThrottleExitSummaryPayload {
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
}

function buildExitSummaryPayload(
  s: ThrottleSummary
): ThrottleExitSummaryPayload {
  const hasCache = s.cacheableCount > 0;
  return {
    runDurationMs: s.runDuration,
    criticalPathMs: s.criticalPathDuration,
    criticalPathTaskCount: s.criticalPathTaskCount,
    recoverableMs: s.recoverable,
    cacheHits: hasCache ? s.cacheHits : undefined,
    cacheableCount: hasCache ? s.cacheableCount : undefined,
    cacheSkipped: s.cacheSkipped,
    recommendations: orderedRecommendations(s),
  };
}

/**
 * Make the report's docs links clickable on terminals that support OSC 8, while
 * leaving the plain (utm-tagged) URL everywhere else. The recommendation strings
 * embed the tagged target; here we swap it for an OSC 8 hyperlink whose visible
 * text is the clean URL and whose target keeps the tag. When OSC 8 isn't
 * supported (CI, pipes) the text is returned untouched — the tagged URL prints
 * verbatim and GitHub etc. auto-link it. Terminal-only: never run this over the
 * strings handed to the TUI popup (ratatui's cell grid strips the escape bytes).
 */
function linkify(text: string): string {
  if (!supportsHyperlinks()) {
    return text;
  }
  let out = text;
  for (const { visible, href } of REPORT_LINKS) {
    out = out.split(href).join(terminalLink(visible, href));
  }
  return out;
}

export function formatReport(s: ThrottleSummary): string {
  const fmt = formatDuration;
  // The report shows two of run duration's three parts — the critical path
  // (longest dependent chain) and recoverable time (slot contention); the third,
  // coordinator/non-recoverable overhead, is computed but no longer displayed, so
  // the two shown stats don't sum to run duration. It's "critical path", not
  // "floor" — the durations shift with --parallel, so it's not a fixed minimum.
  const recoverable = s.recoverable;
  const recoverablePct =
    s.runDuration > 0 ? Math.round((recoverable / s.runDuration) * 100) : 0;
  const stat = (label: string, value: string) =>
    `  ${`${label}:`.padEnd(25)}  ${value}`;
  // No leading blank line: nx's run summary (`output.success`) already prints
  // trailing blank lines before this report, so adding our own just stacks up.
  // Cache sits right under run duration (same section) — the report is short
  // enough that giving cache its own section just looked stranded.
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
  // A recommendation may be multi-line (the critical-path one embeds a task
  // list); indent continuation lines so they sit under the bullet's text.
  const renderRec = (r: string): string[] => {
    const [first, ...rest] = r.split('\n');
    return [`    - ${first}`, ...rest.map((l) => `      ${l}`)];
  };
  // Nothing actionable (e.g. a fully-cached run that's maxed for this machine) →
  // no recommendation section; the header stats stand on their own.
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
  // Footer: a guide on improving run performance, always carrying the utm tag.
  // `linkify` keeps the visible text the CLEAN URL and hides the utm in the OSC 8
  // target where supported; without OSC 8 (CI, pipes — GitHub Actions doesn't
  // render it, it auto-links plain URLs) the tagged URL prints verbatim and is
  // auto-linked. Either way no escape bytes reach a non-capable log.
  lines.push(
    '',
    linkify(
      `  Learn how to improve your run's performance → ${NX_PERFORMANCE_LINK}`
    )
  );
  lines.push('');
  return lines.join('\n');
}

/**
 * The top-of-report cache stat (grouped with parallelism): the local+remote hit
 * rate, or a skip marker. Returns null when there's no cache outcome to show.
 */
function cacheStat(s: ThrottleSummary): string | null {
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
 * Bottom-of-report cache advice — only when there's a lever to pull: a skipped
 * cache (drop the flag) or a barely-used cache with no remote (set up Nx Cloud).
 * The hit rate itself is already shown up top by {@link cacheStat}.
 */
function buildCacheAdvice(s: ThrottleSummary): string | null {
  if (s.cacheSkipped) {
    return `Cache: drop --skip-nx-cache to restore unchanged tasks instantly.`;
  }
  if (s.cacheableCount === 0) {
    return null;
  }
  // Only recommend Nx Cloud when local caching is barely helping AND remote
  // cache is off — a high hit rate means caching is already working.
  const hitRate = s.cacheHits / s.cacheableCount;
  if (!s.remoteCacheEnabled && hitRate <= LOW_CACHE_HIT_RATE) {
    return `Drastically reduce your run duration by sharing a cache across your team and CI with ${NX_REMOTE_CACHE_LINK}.`;
  }
  return null;
}

/** Format a millisecond duration as e.g. "3m 30s", "13.4s", or "470ms". */
export function formatDuration(ms: number): string {
  // Below a second, show whole milliseconds (precise for small waits). From 1s
  // up, one decimal (so big numbers keep sub-second detail). At a minute, m/s.
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
