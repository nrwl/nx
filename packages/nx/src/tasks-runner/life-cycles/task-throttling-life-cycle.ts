import * as os from 'node:os';
import { Task, TaskGraph } from '../../config/task-graph';
import { LifeCycle, TaskResult } from '../life-cycle';

const NX_AGENTS_URL = 'https://nx.dev/ci/features/distribute-task-execution';

interface TaskTiming {
  startTime?: number;
  endTime?: number;
  readyTime?: number;
  continuous: boolean;
}

export interface ThrottleSummary {
  runDuration: number;
  criticalPathDuration: number;
  criticalPathTasks: string[];
  criticalPathLongest: { id: string; duration: number } | null;
  totalWork: number;
  /** Sum of `startTime − readyTime` over discrete tasks (the original ask). */
  aggregateWait: number;
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

  constructor(private readonly taskGraph: TaskGraph) {
    activeThrottleLifeCycle = this;
  }

  startCommand(parallel?: number): void {
    this.total = parallel;
  }

  setTaskReadyTime(taskId: string, readyTime: number): void {
    this.entry(taskId).readyTime ??= readyTime;
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
    let aggregateWait = 0;
    for (const { id, start, end } of timed) {
      const duration = Math.max(0, end - start);
      durations.set(id, duration);
      totalWork += duration;
      runStart = Math.min(runStart, start);
      runEnd = Math.max(runEnd, end);
      const readyTime = this.timings.get(id)?.readyTime;
      if (readyTime != null) {
        aggregateWait += Math.max(0, start - readyTime);
      }
    }

    const runDuration = Math.max(0, runEnd - runStart);
    const { path, duration: criticalPathDuration } =
      this.criticalPath(durations);
    const slotContentionCost = Math.max(0, runDuration - criticalPathDuration);

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
    const recommendation = slotBound
      ? slotBoundRecommendation(parallel, cores)
      : isCI
        ? 'Consider a faster CI runner if critical-path tasks are CPU-bound.'
        : "Raising --parallel won't shorten this run.";

    return {
      runDuration,
      criticalPathDuration,
      criticalPathTasks: path,
      criticalPathLongest,
      totalWork,
      aggregateWait,
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
  if (summary) {
    process.stdout.write(formatReport(summary) + '\n');
  }
}

function slotBoundRecommendation(parallel: number, cores: number): string {
  if (parallel >= cores) {
    return `Distribute across machines with Nx Cloud Agents → ${NX_AGENTS_URL}`;
  }
  return `Consider --parallel=${cores} (currently ${parallel}, machine has ${cores} cores).`;
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
    `  Parallelism bottleneck:  +${fmt(
      s.slotContentionCost
    )}   (${s.slotContentionPct.toFixed(1)}% of run)`,
    `  Aggregate task wait:     ${fmt(
      s.aggregateWait
    )}   (sum of time tasks were ready but unscheduled)`,
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
