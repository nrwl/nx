import { appendFileSync } from 'node:fs';
import type { BatchInfo, PerformanceSummaryPayload } from '../../native';
import { Task, TaskGraph } from '../../config/task-graph';
import {
  buildExitSummaryPayload,
  formatReport,
  formatReportMarkdown,
  type FailedTask,
} from './performance-report';
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
  /** taskId → wall-clock start captured in {@link startTasks}, a fallback for runners that don't stamp `task.startTime` (the Nx Cloud coordinator). */
  private readonly startTimings = new Map<string, number>();

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

  /**
   * Capture each task's wall-clock start — a fallback the local orchestrator's
   * `task.startTime` shadows. The Nx Cloud coordinator drives the lifecycle hooks without
   * stamping the task objects, so this (with the `Date.now()` end fallback in
   * {@link endTasks}) is the only timing it provides — the same fallback
   * `task-history-life-cycle` keeps.
   */
  startTasks(tasks: Task[]): void {
    for (const task of tasks) {
      if (!this.startTimings.has(task.id)) {
        this.startTimings.set(task.id, Date.now());
      }
    }
  }

  endTasks(taskResults: TaskResult[]): void {
    // Called incrementally (per group/batch); accumulate so the last call sees every timing.
    for (const { task, status } of taskResults) {
      const entry = this.entry(task.id);
      // Prefer the runner-stamped times; fall back to the startTasks start and a "now" end
      // when the runner leaves them unset (the Nx Cloud coordinator reports results without
      // stamping task.startTime/endTime). `!= null`, not truthiness: a synthetic timeline
      // can legitimately start at 0.
      const startTime = task.startTime ?? this.startTimings.get(task.id);
      if (startTime != null) {
        entry.startTime = startTime;
      }
      if (task.endTime != null) {
        entry.endTime = task.endTime;
      } else if (task.startTime == null && !entry.continuous) {
        // The Nx Cloud coordinator stamps neither time; pair the startTasks start with a
        // "now" end. A locally-killed task (has a start, no end) stays window-less and
        // excluded, as before.
        entry.endTime = Date.now();
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

  /**
   * The tasks that failed during the run, slowest first, for the GitHub Actions summary's
   * failed-tasks table. Continuous tasks and tasks without a complete window are excluded
   * (a failed task ran to a non-zero exit, so it has both timestamps).
   */
  getFailedTasks(): FailedTask[] {
    const rows: FailedTask[] = [];
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
    return rows.sort((a, b) => b.duration - a.duration);
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
    // In GitHub Actions, also append the report (plus a per-task table) to the job
    // summary page. Independent of the console.log above so neither masks the other.
    writePerformanceReportToGitHubActions(lifeCycle, summary);
  } catch (e) {
    // Best-effort report; never let it affect the run's exit behavior. Surface the
    // cause only under verbose logging.
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }
  }
}

/**
 * Append the performance report to the GitHub Actions job summary page when running in
 * Actions (`$GITHUB_STEP_SUMMARY` is set there and nowhere else). No-op otherwise. The
 * per-task table is computed lazily so non-CI runs don't pay for it. Best-effort: a
 * write failure must never affect the run.
 *
 * Skipped for a nested run (one nx command invoked by another nx task's command), so only
 * the outermost run writes to the summary. Nx sets `NX_TASK_TARGET_PROJECT` on every task's
 * environment, which a nested nx inherits; its absence marks the top-level invocation (the
 * same "NX is already running" signal `nx exec` uses).
 */
function writePerformanceReportToGitHubActions(
  lifeCycle: PerformanceLifeCycle,
  summary: PerformanceSummary
): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (
    process.env.GITHUB_ACTIONS !== 'true' ||
    !summaryPath ||
    process.env.NX_TASK_TARGET_PROJECT
  ) {
    return;
  }
  try {
    const report = formatReportMarkdown(
      summary,
      lifeCycle.getFailedTasks(),
      currentNxCommand()
    );
    appendFileSync(summaryPath, `${report}\n`);
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }
  }
}

/**
 * The nx command as typed — everything after the nx bin (`process.argv[0]` is node,
 * `[1]` is the bin). Only read on the CLI flush path, where argv is always the real nx
 * invocation, so it identifies the run in the summary heading.
 */
function currentNxCommand(): string {
  return process.argv.slice(2).join(' ').trim();
}
