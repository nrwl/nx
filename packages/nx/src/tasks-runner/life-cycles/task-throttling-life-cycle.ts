import * as os from 'node:os';
import { performance } from 'node:perf_hooks';
import type { BatchInfo } from '../../native';
import { TaskGraph } from '../../config/task-graph';
import { LifeCycle, TaskResult } from '../life-cycle';

const NX_AGENTS_URL = 'https://nx.dev/ci/features/distribute-task-execution';

/** ms tolerance for "this task started right when it became eligible". */
const EPS = 50;
/** A bucket below this (ms) isn't worth a recommendation — effectively noise. */
const MEANINGFUL_OVERHEAD = 1000;

interface TaskTiming {
  startTime?: number;
  endTime?: number;
  continuous: boolean;
}

/** How a task on the critical path was held up before it started. */
type GateKind = 'root' | 'dep' | 'slot' | 'hashing' | 'other';

export interface ChainLink {
  id: string;
  duration: number;
  gate: GateKind;
  /** How long this task waited after becoming eligible before it started. */
  wait: number;
}

export interface ThrottleSummary {
  runDuration: number;
  criticalPathDuration: number;
  /** The critical path (the floor), each link annotated with how it was held up. */
  criticalPathChain: ChainLink[];
  totalWork: number;
  /** runDuration − criticalPathDuration: total overhead above the floor. */
  overhead: number;
  overheadPct: number;
  /**
   * The overhead split by which lever recovers it. The three sum to `overhead`:
   *   - recoverableByParallel: time tasks spent queued for a slot while the
   *     machine still had spare cores — raising `--parallel` recovers it.
   *   - recoverableByMachines: queued-for-slot time when the machine was already
   *     at its core count — only more machines (Nx Cloud Agents) recover it.
   *   - coordinatorOverhead: everything else above the floor (hashing, task
   *     spawning, scheduling) — parallelism does not recover it.
   */
  recoverableByParallel: number;
  recoverableByMachines: number;
  coordinatorOverhead: number;
  parallel: number;
  cores: number;
  isCI: boolean;
  recommendation: string;
}

/**
 * Measures how much wall-clock time a run loses to parallelism contention versus
 * the lower bound imposed by the task graph (its critical path), and prints a
 * report at the end of the run. Gated behind `NX_THROTTLE_REPORT` (see
 * `constructLifeCycles`) while we validate the numbers.
 *
 * Two headline quantities, both derived purely from task start/end times:
 *
 *   overhead = runDuration − criticalPathDuration
 *
 * the total wall-clock above the floor (the critical path is the fastest the run
 * could go with unlimited slots), and a split of that overhead into the time
 * tasks spent *queued for a slot while work was waiting* (recoverable by more
 * parallelism, measured from the run's occupancy timeline) versus everything
 * else (coordinator/scheduling overhead, which parallelism can't fix).
 *
 * Scope: discrete tasks only. Continuous tasks (no end time) are excluded from
 * every duration calculation; a discrete task's wait for a continuous dependency
 * to start is treated as eligibility, not contention.
 */
export class TaskThrottlingLifeCycle implements LifeCycle {
  private readonly timings = new Map<string, TaskTiming>();
  /** Thread pool size reported to startCommand (discrete + continuous). */
  private total: number | undefined;
  /** taskId → ids of the other tasks in its batch (batches run sequentially). */
  private readonly batchSiblings = new Map<string, string[]>();

  constructor(private readonly taskGraph: TaskGraph) {
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

  /**
   * Hashing windows used to attribute free-slot waits to hashing. Overridable in
   * tests (the real source is the process-global `performance` measures).
   */
  protected hashWindows(): Array<[number, number]> {
    return collectHashWindows();
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

    const eligible = new Map<string, number>();
    for (const { id } of timed) {
      eligible.set(id, this.earliestStart(id, runStart));
    }

    const { path: criticalPathTasks, duration: criticalPathDuration } =
      this.criticalPath(durations);
    const overhead = Math.max(0, runDuration - criticalPathDuration);

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

    // Slot contention straight off the occupancy timeline: time the machine was
    // saturated AND something was waiting to run. Split by whether the machine
    // had spare cores (raise --parallel) or was already at the core count (more
    // machines). Independent of any single chain or instant.
    const segments = this.buildSegments(timed, eligible, parallel);
    let throttled = 0;
    for (const s of segments) {
      if (s.occ >= parallel && s.waiting > 0) {
        throttled += s.end - s.start;
      }
    }
    // Can't recover below the critical-path floor.
    const recoverableBySlots = Math.min(throttled, overhead);
    // Split by lever from WORK INVARIANTS, not observed occupancy. Observed occ
    // is capped at `parallel`, so an `occ >= cores` test would report 0
    // machine-recoverable time whenever parallel < cores (the default) — hiding
    // the real machine-bound residue. Instead: with spare cores, raising
    // --parallel is the lever; the part even cores-way parallelism can't absorb
    // — the volume that exceeds one machine, max(0, totalWork/cores − CP) —
    // needs more machines. At parallel ≥ cores there's no --parallel headroom,
    // so all of it is machine-bound.
    const machineBound =
      parallel < cores
        ? Math.max(0, totalWork / cores - criticalPathDuration)
        : Infinity;
    const recoverableByMachines = Math.min(recoverableBySlots, machineBound);
    const recoverableByParallel = recoverableBySlots - recoverableByMachines;
    const coordinatorOverhead = overhead - recoverableBySlots;

    // Annotate the critical path for display (gate per link from the same
    // occupancy timeline, not a single-instant sample).
    const hashWindows = this.hashWindows();
    const criticalPathChain: ChainLink[] = criticalPathTasks.map((id, idx) => {
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
      return { id, duration: durations.get(id) ?? 0, gate, wait };
    });

    const dominant = criticalPathChain.reduce<{
      id: string;
      duration: number;
    } | null>(
      (acc, c) =>
        !acc || c.duration > acc.duration
          ? { id: c.id, duration: c.duration }
          : acc,
      null
    );

    const isCI = !!process.env.CI;
    const overheadPct = runDuration > 0 ? (overhead / runDuration) * 100 : 0;
    const recommendation = buildRecommendation({
      recoverableByParallel,
      recoverableByMachines,
      coordinatorOverhead,
      overhead,
      criticalPathDuration,
      parallel,
      cores,
      isCI,
      dominant,
    });

    return {
      runDuration,
      criticalPathDuration,
      criticalPathChain,
      totalWork,
      overhead,
      overheadPct,
      recoverableByParallel,
      recoverableByMachines,
      coordinatorOverhead,
      parallel,
      cores,
      isCI,
      recommendation,
    };
  }
}

/**
 * The most recently constructed throttle lifecycle. `flushThrottleReport` reads
 * this to print after the terminal/TUI has been torn down — the TUI patches
 * `console` to a no-op during the run, so the report can't be printed from
 * `endCommand`. Cleared on flush. (Single-process CLI runs construct one at a
 * time; a concurrent in-process embedding would see only the last run's report.)
 */
let activeThrottleLifeCycle: TaskThrottlingLifeCycle | null = null;

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
 * Point at whichever lever recovers the most overhead, chosen by magnitude (not
 * a fixed order): raising --parallel, distributing across machines, or — when no
 * lever clears the bar — speeding up the critical path itself. The "at the floor"
 * message fires only when the overhead is genuinely small, so a slot-bound run is
 * never told parallelism won't help.
 */
function buildRecommendation(args: {
  recoverableByParallel: number;
  recoverableByMachines: number;
  coordinatorOverhead: number;
  overhead: number;
  criticalPathDuration: number;
  parallel: number;
  cores: number;
  isCI: boolean;
  dominant: { id: string; duration: number } | null;
}): string {
  const {
    recoverableByParallel,
    recoverableByMachines,
    coordinatorOverhead,
    overhead,
    criticalPathDuration,
    parallel,
    cores,
    isCI,
    dominant,
  } = args;

  const dom = dominant
    ? ` — ${dominant.id} dominates at ${formatDuration(dominant.duration)}`
    : '';
  const floorMessage = () => {
    const base = `This run is essentially at its critical-path floor (${formatDuration(
      criticalPathDuration
    )}); more parallelism won't shorten it. Speed up or split the critical path${dom}.`;
    return isCI
      ? `${base} A faster CI runner also helps if those tasks are CPU-bound.`
      : base;
  };

  // Negligible overhead → already at the floor, regardless of how it splits.
  if (overhead < MEANINGFUL_OVERHEAD) {
    return floorMessage();
  }

  const buckets = [
    { kind: 'parallel' as const, amount: recoverableByParallel },
    { kind: 'machines' as const, amount: recoverableByMachines },
    { kind: 'coordinator' as const, amount: coordinatorOverhead },
  ];
  const top = buckets.reduce((a, b) => (b.amount > a.amount ? b : a));
  if (top.amount < MEANINGFUL_OVERHEAD) {
    return floorMessage();
  }

  if (top.kind === 'parallel') {
    return `Tasks are queuing for slots with cores to spare. Raise --parallel toward ${cores} (currently ${parallel}) to recover up to ~${formatDuration(
      recoverableByParallel
    )} (the exact amount depends on how many tasks are ready at once).`;
  }
  if (top.kind === 'machines') {
    return `Tasks are queuing for slots even at --parallel=${parallel} (machine has ${cores} ${pluralizeCores(
      cores
    )}). If they're CPU-bound, distribute across machines with Nx Cloud Agents to recover up to ~${formatDuration(
      recoverableByMachines
    )} → ${NX_AGENTS_URL}; if they're I/O-bound, a higher --parallel on this machine may help instead.`;
  }
  const base = `Most overhead (~${formatDuration(
    coordinatorOverhead
  )}) is coordinator work (hashing, task spawning, scheduling), which more parallelism won't fix. Speed up or split the critical path${dom}.`;
  return isCI
    ? `${base} A faster CI runner also helps if that work is CPU-bound.`
    : base;
}

/** Suffix describing how a chain link was held up, including how long it waited. */
function gateLabel(link: ChainLink): string {
  const waited = formatDuration(link.wait);
  switch (link.gate) {
    case 'slot':
      return `  ← waited ${waited} for a free slot`;
    case 'hashing':
      return `  ← waited ${waited} on hashing`;
    case 'other':
      return `  ← waited ${waited} (scheduling/startup)`;
    default:
      return '';
  }
}

/** A "    label   value" line for the overhead breakdown, value column-aligned. */
function bucketLine(label: string, ms: number): string {
  return `    ${label.padEnd(43)}${formatDuration(ms)}`;
}

function pluralizeCores(cores: number): string {
  return cores === 1 ? 'core' : 'cores';
}

export function formatReport(s: ThrottleSummary): string {
  const fmt = formatDuration;
  return [
    '',
    'Throttle report (NX_THROTTLE_REPORT):',
    `  Run duration:            ${fmt(s.runDuration)}`,
    `  Critical-path floor:     ${fmt(s.criticalPathDuration)}   (${
      s.criticalPathChain.length
    } tasks)`,
    `  Total work:              ${fmt(s.totalWork)}`,
    `  Parallelism:             ${s.parallel} slots  (machine has ${
      s.cores
    } ${pluralizeCores(s.cores)})`,
    `  Environment:             ${s.isCI ? 'CI' : 'local'}`,
    '',
    `  Run overhead:            +${fmt(s.overhead)}   (${s.overheadPct.toFixed(
      1
    )}% above the floor)`,
    bucketLine(
      `recoverable by --parallel (→${s.cores})`,
      s.recoverableByParallel
    ),
    bucketLine('recoverable by more machines', s.recoverableByMachines),
    bucketLine(
      'coordinator overhead (hashing/scheduling)',
      s.coordinatorOverhead
    ),
    '',
    '  Critical path (speed these up to lower the floor):',
    ...s.criticalPathChain.map(
      (c) => `    ${c.id}  —  ${fmt(c.duration)}${gateLabel(c)}`
    ),
    '',
    `  Recommendation: ${s.recommendation}`,
    '',
  ].join('\n');
}

/** Format a millisecond duration as e.g. "3m 30s", "18s", or "0.4s". */
export function formatDuration(ms: number): string {
  if (ms >= 10_000) {
    // Round to whole seconds first, then carry into minutes — so 59_500 reads
    // "1m 0s", never "60s", and 119_500 reads "2m 0s", never "1m 60s".
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds >= 60) {
      return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
    }
    return `${totalSeconds}s`;
  }
  // Sub-10s: one decimal, but roll up to the whole-seconds form if it would
  // round to 10.0 (keeps the column consistent with the >= 10s branch).
  const tenths = Math.round(ms / 100) / 10;
  if (tenths >= 10) {
    return `${Math.round(ms / 1000)}s`;
  }
  return `${tenths.toFixed(1)}s`;
}
