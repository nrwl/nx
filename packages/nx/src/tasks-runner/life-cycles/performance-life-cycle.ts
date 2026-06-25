import type { BatchInfo, PerformanceSummaryPayload } from '../../native';
import { TaskGraph } from '../../config/task-graph';
import { buildExitSummaryPayload, formatReport } from './performance-report';
import { LifeCycle, TaskResult } from '../life-cycle';
import { isTuiEnabled } from '../is-tui-enabled';
import {
  PerformanceAnalysis,
  type PerformanceLifeCycleOptions,
  type PerformanceSummary,
  type TaskTiming,
} from './performance-analysis';

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
  /** taskId → other tasks in its batch (batches run sequentially). */
  private readonly batchSiblings = new Map<string, string[]>();
  /** Resolved `--parallel`, set by the runner via {@link startCommand}'s second arg once the thread pool is sized. */
  private parallel = 1;

  constructor(
    private readonly taskGraph: TaskGraph,
    private readonly options: PerformanceLifeCycleOptions = {}
  ) {
    activePerformanceLifeCycle = this;
  }

  // === Lifecycle hooks (called by the orchestrator as the run progresses) ===

  /**
   * The runner passes the resolved `--parallel` (getThreadPoolSize's `discrete`) as the
   * second arg; the first (thread count) is for the TUI and ignored here.
   */
  startCommand(_threadCount?: number, parallel?: number): void {
    if (parallel != null) {
      this.parallel = parallel;
    }
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

  /** Analyze the collected timings into a structured summary, or `null` when no discrete task timings were recorded. */
  getSummary(): PerformanceSummary | null {
    return new PerformanceAnalysis(
      this.timings,
      this.statuses,
      this.taskGraph,
      this.batchSiblings,
      this.parallel,
      this.options
    ).summary();
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
 * The performance report payload for `endCommand`'s TUI exit popup, or undefined when the
 * report should instead be flushed to the terminal — non-TUI runs, or a single task (the
 * complement of run-command's flush gate). Reading it consumes the report so the flush
 * won't reprint it.
 */
export function getPerformanceReport(
  taskCount: number
): PerformanceSummaryPayload | undefined {
  if (!isTuiEnabled() || taskCount <= 1) {
    return undefined;
  }
  return getPerformanceSummaryPayload() ?? undefined;
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
    // restore_terminal cooks the terminal back post-TUI, so console.log's plain \n
    // renders fine; it also supplies the single trailing newline formatReport omits.
    console.log(formatReport(summary));
  } catch (e) {
    // Best-effort report; never let it affect the run's exit behavior. Surface the
    // cause only under verbose logging.
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }
  }
}
