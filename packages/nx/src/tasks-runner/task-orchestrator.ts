import { defaultMaxListeners } from 'events';
import { writeFileSync } from 'fs';
import { relative } from 'path';
import { performance } from 'perf_hooks';
import * as pc from 'picocolors';
import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { DaemonClient } from '../daemon/client/client';
import { runCommands } from '../executors/run-commands/run-commands.impl';
import { getTaskDetails, hashTask, hashTasks } from '../hasher/hash-task';
import { walkTaskGraph } from './task-graph-utils';
import { getInputs, TaskHasher } from '../hasher/task-hasher';
import {
  BatchStatus,
  IS_WASM,
  TaskStatus as NativeTaskStatus,
  parseTaskStatus,
  RunningTasksService,
  TaskDetails,
  TaskInvocationTracker,
} from '../native';
import { NxArgs } from '../utils/command-line-utils';
import { getLocalDbConnection } from '../utils/db-connection';
import {
  EXPECTED_TERMINATION_SIGNALS,
  signalToCode,
} from '../utils/exit-codes';
import { output } from '../utils/output';
import { combineOptionsForExecutor, Options } from '../utils/params';
import { workspaceRoot } from '../utils/workspace-root';
import {
  Cache,
  CachedResult,
  DbCache,
  dbCacheEnabled,
  getCache,
} from './cache';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { ForkedProcessTaskRunner } from './forked-process-task-runner';
import { isTuiEnabled } from './is-tui-enabled';
import { TaskMetadata, TaskResult } from './life-cycle';
import { PseudoTtyProcess } from './pseudo-terminal';
import { NoopChildProcess } from './running-tasks/noop-child-process';
import { getColor, writePrefixedLines } from './running-tasks/output-prefix';
import { RunningTask } from './running-tasks/running-task';
import { SharedRunningTask } from './running-tasks/shared-running-task';
import {
  getEnvVariablesForBatchProcess,
  getEnvVariablesForTask,
  getTaskSpecificEnv,
} from './task-env';
import { TaskStatus } from './tasks-runner';
import { Batch, TasksSchedule } from './tasks-schedule';
import {
  calculateReverseDeps,
  expandInitiatingTasksThroughNoop,
  getExecutorForTask,
  getPrintableCommandArgsForTask,
  getTargetConfigurationForTask,
  isCacheableTask,
  removeTasksFromTaskGraph,
  shouldStreamOutput,
} from './utils';

type CacheHit = {
  task: Task;
  cachedResult: CachedResult & { remote: boolean };
};

/**
 * Resolve a batch executor's per-task result to a TaskStatus. Prefers an
 * explicit `status` from the executor; falls back to the `success` boolean
 * for executors that pre-date the `status` field.
 */
function resolveBatchTaskStatus(result: {
  success: boolean;
  status?: TaskStatus;
}): TaskStatus {
  return result.status ?? (result.success ? 'success' : 'failure');
}

export class TaskOrchestrator {
  private taskDetails: TaskDetails | null = getTaskDetails();
  private cache: DbCache | Cache = getCache(this.options);
  private readonly tuiEnabled = isTuiEnabled();
  // Derived from projectGraph once — passed to getExecutorForTask /
  // getCustomHasher so they don't have to re-walk the graph per call.
  private readonly projects = readProjectsConfigurationFromProjectGraph(
    this.projectGraph
  ).projects;
  private forkedProcessTaskRunner = new ForkedProcessTaskRunner(
    this.options,
    this.tuiEnabled
  );

  private runningTasksService = !IS_WASM
    ? new RunningTasksService(getLocalDbConnection())
    : null;
  private taskInvocationTracker = !IS_WASM
    ? new TaskInvocationTracker(
        getLocalDbConnection(),
        Number(process.env.NX_INVOCATION_ROOT_PID ?? process.pid)
      )
    : null;
  // Tracks tasks registered by THIS process so that recursive code paths
  // (e.g. applyFromCacheOrRunBatch looping on incomplete batches) don't
  // re-register and trip the DB uniqueness constraint.
  private registeredInvocations = new Set<string>();
  private tasksSchedule = new TasksSchedule(
    this.projectGraph,
    this.projects,
    this.taskGraph,
    this.options
  );

  // region internal state
  private batchEnv = getEnvVariablesForBatchProcess(
    this.options.skipNxCache,
    this.options.captureStderr
  );
  private reverseTaskDeps = calculateReverseDeps(this.taskGraph);

  // `nx:noop` initiating tasks exit instantly via the fast-path in
  // `spawnProcess`. If we treat the noop itself as the keep-alive anchor for
  // its continuous dependencies, `cleanUpUnneededContinuousTasks` kills those
  // children the moment the noop finishes. Expand through noops so the
  // underlying real tasks become the anchors.
  private initializingTaskIds = expandInitiatingTasksThroughNoop(
    this.initiatingTasks,
    this.taskGraph,
    this.projectGraph
  );

  private processedTasks = new Map<string, Promise<NodeJS.ProcessEnv>>();

  private completedTasks = new Map<string, TaskStatus>();
  private waitingForTasks: Function[] = [];
  private pendingDiscreteWorkers = new Set<Promise<TaskResult | void>>();

  private groups: boolean[] = [];
  private continuousTasksStarted = 0;

  private bailed = false;
  private resolveStopPromise: (() => void) | null = null;
  private stopRequested = false;

  private runningContinuousTasks = new Map<
    string,
    {
      runningTask: RunningTask;
      groupId: number;
      ownsRunningTasksService: boolean;
      stoppingReason?: 'interrupted' | 'fulfilled';
    }
  >();
  private runningRunCommandsTasks = new Map<string, RunningTask>();
  private runningDiscreteTasks = new Map<
    string,
    { runningTask: RunningTask; stopping: boolean }
  >();
  private discreteTaskExitHandled = new Map<string, Promise<void>>();
  private continuousTaskExitHandled = new Map<string, Promise<void>>();
  private cleanupPromise: Promise<void> | null = null;
  // endregion internal state

  constructor(
    private readonly hasher: TaskHasher,
    private readonly initiatingProject: string | undefined,
    private readonly initiatingTasks: Task[],
    private readonly projectGraph: ProjectGraph,
    private readonly taskGraph: TaskGraph,
    private readonly nxJson: NxJsonConfiguration,
    private readonly options: NxArgs & DefaultTasksRunnerOptions,
    private readonly bail: boolean,
    private readonly daemon: DaemonClient,
    private readonly outputStyle: string,
    private readonly taskGraphForHashing: TaskGraph = taskGraph
  ) {}

  async init() {
    this.setupSignalHandlers();
    this.taskInvocationTracker?.cleanupStale();

    // Init the ForkedProcessTaskRunner, TasksSchedule, and Cache
    await Promise.all([
      this.forkedProcessTaskRunner.init(),
      this.tasksSchedule.init().then(() => {
        return this.tasksSchedule.scheduleNextTasks();
      }),
      'init' in this.cache ? this.cache.init() : null,
    ]);

    // Pass estimated timings to TUI after TasksSchedule is initialized
    if (this.tuiEnabled) {
      const estimatedTimings = this.tasksSchedule.getEstimatedTaskTimings();
      this.options.lifeCycle.setEstimatedTaskTimings(estimatedTimings);
    }
  }

  async run() {
    await this.init();

    performance.mark('task-execution:start');

    const { discrete, continuous, total } = getThreadPoolSize(
      this.options,
      this.taskGraph
    );

    process.stdout.setMaxListeners(total + defaultMaxListeners);
    process.stderr.setMaxListeners(total + defaultMaxListeners);
    process.setMaxListeners(total + defaultMaxListeners);

    const doNotSkipCache =
      this.options.skipNxCache === false ||
      this.options.skipNxCache === undefined;

    // Start continuous task loops (these run independently)
    const continuousLoops = [];
    for (let i = 0; i < continuous; ++i) {
      continuousLoops.push(this.executeContinuousTaskLoop(continuous));
    }

    // Set up forced shutdown handler
    const shutdownPromise = this.tuiEnabled
      ? new Promise((resolve) => {
          this.options.lifeCycle.registerForcedShutdownCallback(() => {
            this.stopRequested = true;
            resolve(undefined);
          });
        })
      : new Promise<void>((resolve) => {
          this.resolveStopPromise = resolve;
        });

    const coordinatorLoop = this.executeCoordinatorLoop(
      doNotSkipCache,
      discrete
    );

    await Promise.race([
      Promise.all([coordinatorLoop, ...continuousLoops]),
      shutdownPromise,
    ]);

    performance.mark('task-execution:end');
    performance.measure(
      'task-execution',
      'task-execution:start',
      'task-execution:end'
    );
    if (!this.stopRequested) {
      this.cache.removeOldCacheRecords();
    }
    await this.cleanup();

    // Public API (defaultTasksRunner) returns a plain object keyed by
    // task id. Internal state is a Map for faster lookup.
    return Object.fromEntries(this.completedTasks);
  }

  public nextBatch() {
    return this.tasksSchedule.nextBatch();
  }

  /**
   * Coordinator loop. All batch operations (hashing, cache resolution)
   * happen on this single thread — no races. Cache misses are dispatched
   * as fire-and-forget workers. Workers signal completion via
   * scheduleNextTasksAndReleaseThreads which wakes all waiting loops.
   *
   * Safety: the dispatch phase (step 5) is fully synchronous — no
   * worker can run during it. So all tasks picked up by nextTask()
   * are guaranteed to be in processedTasks from step 1.
   */
  private async executeCoordinatorLoop(
    doNotSkipCache: boolean,
    parallelism: number
  ) {
    while (true) {
      if (this.bailed || this.stopRequested) break;

      // 1. Hash BEFORE processAll so processTask sees hashes set, and so
      //    resolveCachedTasksBulk can look them up in the cache. Each task
      //    is hashed with its own task-specific env (project/target .env
      //    files, custom hasher env reads) — the shared batchEnv would
      //    compute a different cache key than the single-task path and
      //    risk stale cache reuse after env changes.
      {
        const { scheduledTasks } = this.tasksSchedule.getAllScheduledTasks();
        const unhashed = scheduledTasks
          .map((id) => this.taskGraph.tasks[id])
          .filter(
            (t) =>
              !t.hash &&
              this.taskGraph.dependencies[t.id].every((depId) =>
                this.completedTasks.has(depId)
              )
          );
        if (unhashed.length > 0) {
          const perTaskEnvs: Record<string, NodeJS.ProcessEnv> = {};
          for (const task of unhashed) {
            perTaskEnvs[task.id] = getTaskSpecificEnv(task, this.projectGraph);
          }
          await hashTasks(
            this.hasher,
            this.projectGraph,
            this.taskGraphForHashing,
            perTaskEnvs,
            this.taskDetails,
            unhashed
          );
        }
      }

      // 2. Bulk-resolve cache hits before processTask — avoids N
      //    lifecycle calls for tasks that will be resolved from cache.
      if (doNotSkipCache) {
        const resolved = await this.resolveCachedTasksBulk();
        if (resolved) continue;
      }

      // 3. Process remaining scheduled tasks (cache misses + non-cacheable).
      this.processAllScheduledTasks();

      // 4. Handle batch executors
      const batch = this.nextBatch();
      if (batch) {
        const groupId = this.closeGroup();
        await this.applyFromCacheOrRunBatch(doNotSkipCache, batch, groupId);
        this.openGroup(groupId);
        continue;
      }

      // 5. Dispatch cache misses as individual workers
      while (this.pendingDiscreteWorkers.size < parallelism) {
        const task = this.tasksSchedule.nextTask((t) => !t.continuous);
        if (!task) break;
        const groupId = this.closeGroup();
        this.dispatchDiscreteWorker(doNotSkipCache, task, groupId);
      }

      // 6. Nothing left to dispatch and nothing in flight — done.
      if (
        !this.tasksSchedule.hasTasks() &&
        this.pendingDiscreteWorkers.size === 0
      ) {
        break;
      }

      // 7. Wait for a worker to finish (woken by scheduleNextTasksAndReleaseThreads)
      await new Promise((res) => this.waitingForTasks.push(res));
    }
  }

  private async executeContinuousTaskLoop(continuousTaskCount: number) {
    while (true) {
      // completed all the tasks
      if (!this.tasksSchedule.hasTasks() || this.bailed || this.stopRequested) {
        return null;
      }

      this.processAllScheduledTasks();

      const task = this.tasksSchedule.nextTask((t) => t.continuous);
      if (task) {
        // Use a separate groupId space (parallel..parallel+N) so continuous tasks
        // don't consume discrete group slots
        const groupId = this.options.parallel + this.continuousTasksStarted++;
        const runningTask = await this.startContinuousTask(task, groupId);

        if (this.initializingTaskIds.has(task.id)) {
          await this.continuousTaskExitHandled.get(task.id);
        }

        // all continuous tasks have been started, thread can exit
        if (this.continuousTasksStarted >= continuousTaskCount) {
          return null;
        }
        continue;
      }

      // all continuous tasks have been started, thread can exit
      if (this.continuousTasksStarted >= continuousTaskCount) {
        return null;
      }

      // block until some other task completes, then try again
      await new Promise((res) => this.waitingForTasks.push(res));
    }
  }

  // region Processing Scheduled Tasks
  private async processTask(taskId: string): Promise<NodeJS.ProcessEnv> {
    const task = this.taskGraph.tasks[taskId];
    const taskSpecificEnv = getTaskSpecificEnv(task, this.projectGraph);

    if (!task.hash) {
      await hashTask(
        this.hasher,
        this.projectGraph,
        this.taskGraphForHashing,
        task,
        taskSpecificEnv,
        this.taskDetails
      );
    }

    await this.options.lifeCycle.scheduleTask(task);

    return taskSpecificEnv;
  }

  public processAllScheduledTasks() {
    const { scheduledTasks } = this.tasksSchedule.getAllScheduledTasks();
    for (const taskId of scheduledTasks) {
      // Task is already handled or being handled
      if (!this.processedTasks.has(taskId)) {
        this.processedTasks.set(taskId, this.processTask(taskId));
      }
    }
  }

  /**
   * Registers a task invocation and checks for loops across nested Nx processes.
   * Uses the task_invocations DB table keyed by root PID. registerTask() throws
   * on unique constraint violation when a parent Nx process already registered
   * this task — indicating an infinite loop.
   */
  private detectTaskInvocationLoop(task: Task): void {
    if (!this.taskInvocationTracker) return;
    if (this.registeredInvocations.has(task.id)) return;
    try {
      this.taskInvocationTracker.registerTask(process.pid, task.id);
      this.registeredInvocations.add(task.id);
    } catch {
      // Unique constraint violation — task already invoked by an ancestor Nx process
      const chain = this.taskInvocationTracker.getInvocationChain();
      const chainDisplay = chain.map((r) => r.taskId).join(' -> ');

      output.error({
        title: 'Recursive task invocation detected',
        bodyLines: [
          `Nx detected a recursive loop of task invocations:`,
          ``,
          `  ${chainDisplay} -> ${task.id}`,
          ``,
          `Task "${task.id}" was already invoked by a parent Nx process in this chain.`,
          `This typically happens when a task's command (e.g., "nx ${task.target.target} ${task.target.project}")`,
          `triggers a chain of tasks that eventually re-invokes itself.`,
          ``,
          `To fix this, review the command configuration for the tasks in the chain above.`,
        ],
      });
      process.exit(1);
    }
  }

  // endregion Processing Scheduled Tasks

  // region Applying Cache

  private async applyCachedResults(tasks: Task[]): Promise<TaskResult[]> {
    const cacheableTasks = tasks.filter((t) =>
      isCacheableTask(t, this.options)
    );
    if (cacheableTasks.length === 0) return [];

    const cacheHits = await this.fetchCacheHits(cacheableTasks);
    if (cacheHits.length === 0) return [];

    return this.finalizeCacheHits(cacheHits);
  }

  /**
   * Batch cache lookup + filter to successful entries. Handles both
   * local (one rarray SQL call) and remote (parallel HTTP retrievals)
   * inside DbCache.getBatch.
   */
  private async fetchCacheHits(tasks: Task[]): Promise<CacheHit[]> {
    const batchResults = await this.cache.getBatch(tasks);
    const cacheHits: CacheHit[] = [];
    for (const task of tasks) {
      const cachedResult = batchResults.get(task.hash);
      if (cachedResult && cachedResult.code === 0) {
        cacheHits.push({ task, cachedResult });
      }
    }
    return cacheHits;
  }

  /**
   * For each confirmed cache hit: decide whether to copy outputs from
   * the cache (skipping if the on-disk outputs already match the
   * recorded hash), copy in parallel, derive the task status, print
   * terminal output, and return the assembled results.
   */
  private async finalizeCacheHits(
    cacheHits: CacheHit[]
  ): Promise<TaskResult[]> {
    // Batch-check which tasks need outputs copied from cache. Remote
    // cache entries come pre-restored to their output dirs when the
    // db cache is on, so we only check ones that aren't.
    const usingDbCache = dbCacheEnabled();
    const tasksNeedingOutputCheck = cacheHits.filter(
      ({ task, cachedResult }) =>
        task.outputs.length > 0 && (!cachedResult.remote || !usingDbCache)
    );
    const shouldCopyMap = await this.shouldCopyOutputsFromCacheBatch(
      tasksNeedingOutputCheck.map(({ task }) => ({
        outputs: task.outputs,
        hash: task.hash,
      }))
    );

    // Copy outputs in parallel for tasks that need it.
    await Promise.all(
      cacheHits.map(async ({ task, cachedResult }) => {
        if (shouldCopyMap.get(task.hash)) {
          await this.cache.copyFilesFromCache(
            task.hash,
            cachedResult,
            task.outputs
          );
        }
      })
    );

    // Derive status, print terminal output, build results.
    const results: TaskResult[] = [];
    for (const { task, cachedResult } of cacheHits) {
      const shouldCopy = shouldCopyMap.get(task.hash) ?? false;
      const status: TaskStatus = cachedResult.remote
        ? 'remote-cache'
        : shouldCopy
          ? 'local-cache'
          : 'local-cache-kept-existing';

      this.options.lifeCycle.printTaskTerminalOutput(
        task,
        status,
        cachedResult.terminalOutput
      );

      results.push({
        task,
        code: cachedResult.code,
        status,
        terminalOutput: cachedResult.terminalOutput,
      });
    }

    return results;
  }

  /**
   * Coordinator wrapper around {@link resolveCachedTasks}: peeks at
   * scheduledTasks (without removing anything from the schedule),
   * filters to cacheable hashed discrete candidates, and delegates the
   * cache fetch + lifecycle to the public method. Returns true if any
   * tasks were resolved.
   *
   * The coordinator relies on this running unconditionally (when cache
   * is enabled): tasks dispatched in step 5 via runTaskDirectly skip
   * their own cache lookup on the assumption that this has already
   * confirmed them as misses. Don't add length-based bails.
   */
  private async resolveCachedTasksBulk(): Promise<boolean> {
    const { scheduledTasks } = this.tasksSchedule.getAllScheduledTasks();

    const candidates: Task[] = [];
    for (const id of scheduledTasks) {
      const task = this.taskGraph.tasks[id];
      if (
        task.hash &&
        !task.continuous &&
        isCacheableTask(task, this.options)
      ) {
        candidates.push(task);
      }
    }
    if (candidates.length === 0) return false;

    // postRunSteps → complete() → tasksSchedule.complete() will filter
    // resolved hits out of scheduledTasks before we return, so there's
    // no need to mutate the schedule here.
    const groupId = this.closeGroup();
    try {
      const results = await this.resolveCachedTasks(true, candidates, groupId);
      return results.length > 0;
    } finally {
      this.openGroup(groupId);
    }
  }

  // endregion Applying Cache

  // region Batch
  /**
   * Hash all batch tasks and resolve cache hits topologically.
   *
   * Walks the task graph level by level. Every task gets a preliminary hash
   * (so startTasks always has a valid hash for Cloud). Tasks with depsOutputs
   * whose deps weren't cached are ineligible for cache lookup but still
   * receive a preliminary hash — they'll be re-hashed after execution.
   */
  private async applyBatchCachedResults(
    batch: Batch,
    doNotSkipCache: boolean,
    groupId: number
  ): Promise<{
    cachedResults: TaskResult[];
    needsRehashAfterExecution: Set<string>;
  }> {
    const cachedResults: TaskResult[] = [];
    const needsRehashAfterExecution = new Set<string>();
    const tasks = Object.values(batch.taskGraph.tasks);

    if (!doNotSkipCache) {
      // Cache skipped — just hash so startTasks has valid hashes
      await this.hashBatchTasks(tasks);
      return { cachedResults, needsRehashAfterExecution };
    }

    const nonCachedTaskIds = new Set<string>();

    await walkTaskGraph(batch.taskGraph, async (rootTaskIds) => {
      const rootTasks = rootTaskIds.map((id) => batch.taskGraph.tasks[id]);

      await this.hashBatchTasks(rootTasks);

      const eligible: Task[] = [];
      for (const task of rootTasks) {
        const depIds = batch.taskGraph.dependencies[task.id];
        const hasNonCachedDep = depIds.some((id) => nonCachedTaskIds.has(id));

        if (
          hasNonCachedDep &&
          getInputs(task, this.projectGraph, this.nxJson).depsOutputs.length > 0
        ) {
          nonCachedTaskIds.add(task.id);
          needsRehashAfterExecution.add(task.id);
        } else {
          eligible.push(task);
        }
      }

      if (eligible.length > 0) {
        const cacheResults = await this.applyCachedResults(eligible);
        const cachedIds = new Set(cacheResults.map((r) => r.task.id));
        cachedResults.push(...cacheResults);

        if (cacheResults.length > 0) {
          const cachedTasks = cacheResults.map((r) => r.task);
          await Promise.all(
            cachedTasks.map((task) => this.options.lifeCycle.scheduleTask(task))
          );
          await this.preRunSteps(cachedTasks, { groupId });
          await this.postRunSteps(cacheResults, doNotSkipCache, { groupId });
        }

        for (const task of eligible) {
          if (!cachedIds.has(task.id)) {
            nonCachedTaskIds.add(task.id);
          }
        }
      }
    });

    return { cachedResults, needsRehashAfterExecution };
  }

  private async hashBatchTasks(tasks: Task[]): Promise<void> {
    // Batch executors run every task in the same forked process, but
    // each task still has its own .env files / custom-hasher env — use
    // task-specific env for hashing so the cache key matches the
    // single-task path.
    const perTaskEnvs: Record<string, NodeJS.ProcessEnv> = {};
    for (const task of tasks) {
      perTaskEnvs[task.id] = getTaskSpecificEnv(task, this.projectGraph);
    }
    await hashTasks(
      this.hasher,
      this.projectGraph,
      this.taskGraphForHashing,
      perTaskEnvs,
      this.taskDetails,
      tasks
    );
  }

  public async applyFromCacheOrRunBatch(
    doNotSkipCache: boolean,
    batch: Batch,
    groupId: number
  ): Promise<TaskResult[]> {
    const applyFromCacheOrRunBatchStart = performance.mark(
      'TaskOrchestrator-apply-from-cache-or-run-batch:start'
    );
    const taskEntries = Object.entries(batch.taskGraph.tasks);
    const tasks = taskEntries.map(([, task]) => task);

    this.options.lifeCycle.registerRunningBatch?.(batch.id, {
      executorName: batch.executorName,
      taskIds: Object.keys(batch.taskGraph.tasks),
    });

    const { cachedResults, needsRehashAfterExecution } =
      await this.applyBatchCachedResults(batch, doNotSkipCache, groupId);

    // Schedule and start non-cached tasks (cached tasks were already
    // started and completed inside applyBatchCachedResults)
    const cachedTaskIds = new Set(cachedResults.map((r) => r.task.id));
    const nonCachedTasks = tasks.filter((t) => !cachedTaskIds.has(t.id));
    if (nonCachedTasks.length > 0) {
      await Promise.all(
        nonCachedTasks.map((task) => this.options.lifeCycle.scheduleTask(task))
      );
      await this.preRunSteps(nonCachedTasks, { groupId });
    }

    // Phase 2: Run non-cached tasks, then re-hash depsOutputs tasks
    const taskIdsToSkip = cachedResults.map((r) => r.task.id);
    let batchResults: TaskResult[] = [];

    if (taskIdsToSkip.length < tasks.length) {
      const runGraph = removeTasksFromTaskGraph(batch.taskGraph, taskIdsToSkip);

      for (const task of Object.values(runGraph.tasks)) {
        this.detectTaskInvocationLoop(task);
      }

      batchResults = await this.runBatch(
        {
          id: batch.id,
          executorName: batch.executorName,
          taskGraph: runGraph,
        },
        this.batchEnv,
        groupId
      );

      // Re-hash depsOutputs tasks — their dep outputs are now on disk
      const tasksToRehash = batchResults
        .filter(
          (r) =>
            needsRehashAfterExecution.has(r.task.id) &&
            (r.status === 'success' || r.status === 'failure')
        )
        .map((r) => r.task);
      if (tasksToRehash.length > 0) {
        await this.hashBatchTasks(tasksToRehash);
      }
    }

    if (batchResults.length > 0) {
      await this.postRunSteps(batchResults, doNotSkipCache, { groupId });
    }

    // Update batch status based on all task results
    const hasFailures = taskEntries.some(([taskId]) => {
      const status = this.completedTasks.get(taskId);
      return status === 'failure' || status === 'skipped';
    });
    this.options.lifeCycle.setBatchStatus?.(
      batch.id,
      hasFailures ? BatchStatus.Failure : BatchStatus.Success
    );

    this.forkedProcessTaskRunner.cleanUpBatchProcesses();

    const tasksCompleted = taskEntries.filter(([taskId]) =>
      this.completedTasks.has(taskId)
    );

    // Batch is still not done, run it again
    if (tasksCompleted.length !== taskEntries.length) {
      await this.applyFromCacheOrRunBatch(
        doNotSkipCache,
        {
          id: batch.id,
          executorName: batch.executorName,
          taskGraph: removeTasksFromTaskGraph(
            batch.taskGraph,
            tasksCompleted.map(([taskId]) => taskId)
          ),
        },
        groupId
      );
    }
    // Batch is done, mark it as completed
    const applyFromCacheOrRunBatchEnd = performance.mark(
      'TaskOrchestrator-apply-from-cache-or-run-batch:end'
    );
    performance.measure(
      'TaskOrchestrator-apply-from-cache-or-run-batch',
      applyFromCacheOrRunBatchStart.name,
      applyFromCacheOrRunBatchEnd.name
    );
    return [...cachedResults, ...batchResults];
  }

  private async runBatch(
    batch: Batch,
    env: NodeJS.ProcessEnv,
    groupId: number
  ): Promise<TaskResult[]> {
    const runBatchStart = performance.mark('TaskOrchestrator-run-batch:start');
    try {
      const batchProcess =
        await this.forkedProcessTaskRunner.forkProcessForBatch(
          batch,
          this.projectGraph,
          this.taskGraph,
          env
        );

      // Stream output from batch process to the batch
      batchProcess.onOutput((output) => {
        this.options.lifeCycle.appendBatchOutput?.(batch.id, output);
      });

      // Stream task results as they complete
      // Heavy operations (caching, scheduling, complete) happen at batch-end in postRunSteps
      batchProcess.onTaskResults((taskId, result) => {
        const task = this.taskGraph.tasks[taskId];
        const status = resolveBatchTaskStatus(result);

        // Append before print so printTaskTerminalOutput finds the PTY already
        // populated and no-ops; reversing the order writes terminalOutput twice.
        if (result.terminalOutput) {
          this.options.lifeCycle.appendTaskOutput(
            taskId,
            result.terminalOutput,
            false
          );
        }

        // Skipped tasks didn't run, so they have no terminal output and don't
        // need a per-task PTY — calling printTaskTerminalOutput would otherwise
        // allocate one just to write a cursor-hide escape.
        if (status !== 'skipped') {
          this.options.lifeCycle.printTaskTerminalOutput(
            task,
            status,
            result.terminalOutput ?? ''
          );
        }

        task.startTime = result.startTime;
        task.endTime = result.endTime;

        if (result.startTime && result.endTime) {
          this.options.lifeCycle.setTaskTiming?.(
            taskId,
            result.startTime,
            result.endTime
          );
        }
        this.options.lifeCycle.setTaskStatus(taskId, parseTaskStatus(status));
      });

      const results = await batchProcess.getResults();
      const batchResultEntries = Object.entries(results);

      return batchResultEntries.map(([taskId, result]) => {
        const task = this.taskGraph.tasks[taskId];
        task.startTime = result.startTime;
        task.endTime = result.endTime;
        const status = resolveBatchTaskStatus(result);
        return {
          code: status === 'success' ? 0 : 1,
          task,
          status,
          terminalOutput: result.terminalOutput,
        };
      });
    } catch (e) {
      const isBatchStopping = this.stopRequested;

      return Object.keys(batch.taskGraph.tasks).map((taskId) => {
        const task = this.taskGraph.tasks[taskId];
        if (isBatchStopping) {
          task.endTime = Date.now();
        }
        return {
          task,
          code: 1,
          status: (isBatchStopping ? 'stopped' : 'failure') as TaskStatus,
          terminalOutput: isBatchStopping ? '' : (e.stack ?? e.message ?? ''),
        };
      });
    } finally {
      const runBatchEnd = performance.mark('TaskOrchestrator-run-batch:end');
      performance.measure(
        'TaskOrchestrator-run-batch',
        runBatchStart.name,
        runBatchEnd.name
      );
    }
  }

  // endregion Batch

  // region Single Task

  /**
   * Bulk-resolve cache hits for a set of tasks: fetch cached entries,
   * copy outputs as needed, fire lifecycle, and return the TaskResults
   * for the hits. Tasks that aren't in the cache (or aren't cacheable)
   * are silently omitted from the return value — callers are responsible
   * for running those via {@link runTaskDirectly}.
   *
   * Fires scheduleTask lifecycle for hits that haven't been through
   * processAllScheduledTasks yet. That's a coordinator gap-filler and
   * a no-op for callers that pre-process the schedule.
   *
   * The caller provides `groupId` — cache hits share one slot since they
   * don't actually compete for parallelism.
   */
  async resolveCachedTasks(
    doNotSkipCache: boolean,
    tasks: Task[],
    groupId: number
  ): Promise<TaskResult[]> {
    if (!doNotSkipCache || tasks.length === 0) return [];

    const cacheableTasks = tasks.filter((t) =>
      isCacheableTask(t, this.options)
    );
    if (cacheableTasks.length === 0) return [];

    // Wait for any queued processTask promises to settle so task.hash is
    // populated before cache.getBatch maps it into a Rust String.
    await Promise.all(cacheableTasks.map((t) => this.processedTasks.get(t.id)));

    const cacheHits = await this.fetchCacheHits(cacheableTasks);
    if (cacheHits.length === 0) return [];

    // scheduleTask lifecycle for hits the coordinator resolved before
    // processAllScheduledTasks could fire it. No-op for callers that
    // already ran processAllScheduledTasks (every hit is in processedTasks).
    await Promise.all(
      cacheHits
        .filter(({ task }) => !this.processedTasks.has(task.id))
        .map(({ task }) => this.options.lifeCycle.scheduleTask(task))
    );

    const hitTasks = cacheHits.map((h) => h.task);
    await this.preRunSteps(hitTasks, { groupId });
    const results = await this.finalizeCacheHits(cacheHits);
    await this.postRunSteps(results, doNotSkipCache, { groupId });
    return results;
  }

  /**
   * Fire a discrete-task worker and track it in pendingDiscreteWorkers until
   * it settles. Uses runTaskDirectly (not applyFromCacheOrRun*) because
   * resolveCachedTasksBulk already confirmed this task is a cache miss —
   * another lookup would re-query the DB and (for Nx Cloud users) repeat
   * the remote HTTP retrieval.
   */
  private dispatchDiscreteWorker(
    doNotSkipCache: boolean,
    task: Task,
    groupId: number
  ): void {
    const worker = this.runTaskDirectly(doNotSkipCache, task, groupId)
      .catch((e) =>
        this.handleDiscreteWorkerFailure(doNotSkipCache, task, groupId, e)
      )
      .finally(() => {
        this.openGroup(groupId);
        this.pendingDiscreteWorkers.delete(worker);
        // Wake coordinator — the delete above may satisfy the exit condition
        // (pendingDiscreteWorkers.size === 0) that was missed when
        // scheduleNextTasksAndReleaseThreads fired earlier.
        this.waitingForTasks.forEach((f) => f(null));
        this.waitingForTasks.length = 0;
      });
    this.pendingDiscreteWorkers.add(worker);
  }

  /**
   * Route a worker rejection (e.g. remote cache errors) through the normal
   * failure path instead of letting it become an unhandled promise. Guard
   * against double-finalize: completeTasks() populates `completedTasks`,
   * so a rejection arriving after postRunSteps has already finalized the
   * task must not run postRunSteps again.
   */
  private async handleDiscreteWorkerFailure(
    doNotSkipCache: boolean,
    task: Task,
    groupId: number,
    e: any
  ): Promise<void> {
    if (this.completedTasks.has(task.id)) return;
    const terminalOutput = e?.message ?? '';
    this.options.lifeCycle.printTaskTerminalOutput(
      task,
      'failure',
      terminalOutput
    );
    await this.postRunSteps(
      [{ task, status: 'failure', terminalOutput }],
      doNotSkipCache,
      { groupId }
    );
  }

  /**
   * Spawn and wait on a task's child process, unconditionally — no cache
   * lookup. Callers must have already confirmed the task is a cache miss
   * (or disabled caching entirely).
   */
  async runTaskDirectly(
    doNotSkipCache: boolean,
    task: Task,
    groupId: number
  ): Promise<TaskResult> {
    // Wait for task to be processed
    const taskSpecificEnv = await this.processedTasks.get(task.id);

    await this.preRunSteps([task], { groupId });

    const pipeOutput = await this.pipeOutputCapture(task);
    const temporaryOutputPath = this.cache.temporaryOutputPath(task);
    const streamOutput =
      this.outputStyle === 'static'
        ? false
        : shouldStreamOutput(task, this.initiatingProject);

    const env = pipeOutput
      ? getEnvVariablesForTask(
          task,
          taskSpecificEnv,
          process.env.FORCE_COLOR === undefined
            ? 'true'
            : process.env.FORCE_COLOR,
          this.options.skipNxCache,
          this.options.captureStderr,
          null,
          null
        )
      : getEnvVariablesForTask(
          task,
          taskSpecificEnv,
          undefined,
          this.options.skipNxCache,
          this.options.captureStderr,
          temporaryOutputPath,
          streamOutput
        );

    let resolveDiscreteExit: () => void;
    const discreteExitHandled = new Promise<void>(
      (r) => (resolveDiscreteExit = r)
    );
    this.discreteTaskExitHandled.set(task.id, discreteExitHandled);

    this.detectTaskInvocationLoop(task);

    const childProcess = await this.runTask(
      task,
      streamOutput,
      env,
      temporaryOutputPath,
      pipeOutput
    );
    this.runningDiscreteTasks.set(task.id, {
      runningTask: childProcess,
      stopping: false,
    });

    const { code, terminalOutput } = await childProcess.getResults();
    const isStopping =
      this.runningDiscreteTasks.get(task.id)?.stopping ?? false;
    this.runningDiscreteTasks.delete(task.id);

    const result: TaskResult = {
      task,
      code,
      status: isStopping ? 'stopped' : code === 0 ? 'success' : 'failure',
      terminalOutput,
    };

    try {
      await this.postRunSteps([result], doNotSkipCache, { groupId });
    } finally {
      this.discreteTaskExitHandled.delete(task.id);
      resolveDiscreteExit!();
    }
    return result;
  }

  private async runTask(
    task: Task,
    streamOutput: boolean,
    env: { [p: string]: string | undefined; TZ?: string },
    temporaryOutputPath: string,
    pipeOutput: boolean
  ): Promise<RunningTask> {
    const shouldPrefix =
      streamOutput &&
      process.env.NX_PREFIX_OUTPUT === 'true' &&
      !this.tuiEnabled;
    const targetConfiguration = getTargetConfigurationForTask(
      task,
      this.projectGraph
    );
    if (
      process.env.NX_RUN_COMMANDS_DIRECTLY !== 'false' &&
      targetConfiguration.executor === 'nx:run-commands'
    ) {
      try {
        const { schema } = getExecutorForTask(task, this.projects);
        const combinedOptions = combineOptionsForExecutor(
          task.overrides as Options,
          task.target.configuration ?? targetConfiguration.defaultConfiguration,
          targetConfiguration,
          schema,
          task.target.project,
          relative(task.projectRoot ?? workspaceRoot, process.cwd()),
          process.env.NX_VERBOSE_LOGGING === 'true'
        );
        if (combinedOptions.env) {
          env = {
            ...env,
            ...combinedOptions.env,
          };
        }
        if (streamOutput) {
          const args = getPrintableCommandArgsForTask(task);
          output.logCommand(args.join(' '));
        }
        const runCommandsOptions = {
          ...combinedOptions,
          env,
          usePty:
            this.tuiEnabled ||
            (!this.tasksSchedule.hasTasks() &&
              this.runningContinuousTasks.size === 0),
          streamOutput: streamOutput && !shouldPrefix,
        };

        const runningTask = await runCommands(
          runCommandsOptions,
          {
            root: workspaceRoot, // only root is needed in runCommands
          } as any,
          task.id
        );

        this.runningRunCommandsTasks.set(task.id, runningTask);
        runningTask.onExit(() => {
          this.runningRunCommandsTasks.delete(task.id);
        });

        if (shouldPrefix) {
          const color = getColor(task.target.project);
          const formattedPrefix = pc.bold(color(`${task.target.project}:`));
          runningTask.onOutput((chunk) => {
            writePrefixedLines(chunk, formattedPrefix);
          });
        } else if (this.tuiEnabled) {
          if (runningTask instanceof PseudoTtyProcess) {
            // This is an external of a the pseudo terminal where a task is running and can be passed to the TUI
            this.options.lifeCycle.registerRunningTask(
              task.id,
              runningTask.getParserAndWriter()
            );
            runningTask.onOutput((output) => {
              this.options.lifeCycle.appendTaskOutput(task.id, output, true);
            });
          } else {
            this.options.lifeCycle.registerRunningTaskWithEmptyParser(task.id);
            runningTask.onOutput((output) => {
              this.options.lifeCycle.appendTaskOutput(task.id, output, false);
            });
          }
        }

        if (!streamOutput && !shouldPrefix) {
          // TODO: shouldn't this be checking if the task is continuous before writing anything to disk or calling printTaskTerminalOutput?
          runningTask.onExit((code, terminalOutput) => {
            this.options.lifeCycle.printTaskTerminalOutput(
              task,
              code === 0 ? 'success' : 'failure',
              terminalOutput
            );
            writeFileSync(temporaryOutputPath, terminalOutput);
          });
        }

        return runningTask;
      } catch (e) {
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
          console.error(e);
        } else {
          console.error(e.message);
        }
        const terminalOutput = e.stack ?? e.message ?? '';
        writeFileSync(temporaryOutputPath, terminalOutput);
        return new NoopChildProcess({
          code: 1,
          terminalOutput,
        });
      }
    } else if (targetConfiguration.executor === 'nx:noop') {
      writeFileSync(temporaryOutputPath, '');
      return new NoopChildProcess({
        code: 0,
        terminalOutput: '',
      });
    } else {
      // cache prep
      const runningTask = await this.runTaskInForkedProcess(
        task,
        env,
        pipeOutput,
        temporaryOutputPath,
        streamOutput
      );
      if (this.tuiEnabled) {
        if (runningTask instanceof PseudoTtyProcess) {
          // This is an external of a the pseudo terminal where a task is running and can be passed to the TUI
          this.options.lifeCycle.registerRunningTask(
            task.id,
            runningTask.getParserAndWriter()
          );
          runningTask.onOutput((output) => {
            this.options.lifeCycle.appendTaskOutput(task.id, output, true);
          });
        } else if (
          'onOutput' in runningTask &&
          typeof runningTask.onOutput === 'function'
        ) {
          // Register task that can provide progressive output but isn't interactive (e.g., NodeChildProcessWithNonDirectOutput)
          this.options.lifeCycle.registerRunningTaskWithEmptyParser(task.id);
          runningTask.onOutput((output) => {
            this.options.lifeCycle.appendTaskOutput(task.id, output, false);
          });
        } else {
          // Fallback for tasks that don't support progressive output
          this.options.lifeCycle.registerRunningTaskWithEmptyParser(task.id);
        }
      }

      return runningTask;
    }
  }

  private async runTaskInForkedProcess(
    task: Task,
    env: NodeJS.ProcessEnv,
    pipeOutput: boolean,
    temporaryOutputPath: string,
    streamOutput: boolean
  ) {
    try {
      const usePtyFork = process.env.NX_NATIVE_COMMAND_RUNNER !== 'false';

      // Disable the pseudo terminal if this is a run-many or when running a continuous task as part of a run-one
      const disablePseudoTerminal =
        !this.tuiEnabled && (!this.initiatingProject || task.continuous);
      // execution
      const childProcess = usePtyFork
        ? await this.forkedProcessTaskRunner.forkProcess(task, {
            temporaryOutputPath,
            streamOutput,
            pipeOutput,
            taskGraph: this.taskGraph,
            env,
            disablePseudoTerminal,
          })
        : await this.forkedProcessTaskRunner.forkProcessLegacy(task, {
            temporaryOutputPath,
            streamOutput,
            pipeOutput,
            taskGraph: this.taskGraph,
            env,
          });

      return childProcess;
    } catch (e) {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.error(e);
      }
      return new NoopChildProcess({
        code: 1,
        terminalOutput: e.stack ?? e.message ?? '',
      });
    }
  }

  async startContinuousTask(task: Task, groupId: number) {
    if (
      this.runningTasksService &&
      this.runningTasksService.getRunningTasks([task.id]).length
    ) {
      await this.preRunSteps([task], { groupId });

      if (this.tuiEnabled) {
        this.options.lifeCycle.setTaskStatus(task.id, NativeTaskStatus.Shared);
      }

      const runningTask = new SharedRunningTask(
        this.runningTasksService,
        task.id
      );

      this.runningContinuousTasks.set(task.id, {
        runningTask,
        groupId,
        ownsRunningTasksService: false,
      });
      this.continuousTaskExitHandled.set(
        task.id,
        new Promise<void>((resolve) => {
          runningTask.onExit(async (code) => {
            await this.handleContinuousTaskExit(code, task, groupId, false);
            resolve();
          });
        })
      );

      // task is already running by another process, we schedule the next tasks
      // and release the threads
      await this.scheduleNextTasksAndReleaseThreads();
      return runningTask;
    }

    const taskSpecificEnv = await this.processedTasks.get(task.id);
    await this.preRunSteps([task], { groupId });

    const pipeOutput = await this.pipeOutputCapture(task);
    // obtain metadata
    const temporaryOutputPath = this.cache.temporaryOutputPath(task);
    const streamOutput =
      this.outputStyle === 'static'
        ? false
        : shouldStreamOutput(task, this.initiatingProject);

    let env = pipeOutput
      ? getEnvVariablesForTask(
          task,
          taskSpecificEnv,
          process.env.FORCE_COLOR === undefined
            ? 'true'
            : process.env.FORCE_COLOR,
          this.options.skipNxCache,
          this.options.captureStderr,
          null,
          null
        )
      : getEnvVariablesForTask(
          task,
          taskSpecificEnv,
          undefined,
          this.options.skipNxCache,
          this.options.captureStderr,
          temporaryOutputPath,
          streamOutput
        );
    this.detectTaskInvocationLoop(task);
    const childProcess = await this.runTask(
      task,
      streamOutput,
      env,
      temporaryOutputPath,
      pipeOutput
    );
    this.runningTasksService?.addRunningTask(task.id);
    this.runningContinuousTasks.set(task.id, {
      runningTask: childProcess,
      groupId,
      ownsRunningTasksService: true,
    });
    this.continuousTaskExitHandled.set(
      task.id,
      new Promise<void>((resolve) => {
        childProcess.onExit(async (code) => {
          await this.handleContinuousTaskExit(code, task, groupId, true);
          resolve();
        });
      })
    );
    await this.scheduleNextTasksAndReleaseThreads();

    return childProcess;
  }

  // endregion Single Task

  // region Lifecycle
  private async preRunSteps(tasks: Task[], metadata: TaskMetadata) {
    const now = Date.now();
    for (const task of tasks) {
      task.startTime = now;
    }
    await this.options.lifeCycle.startTasks(tasks, metadata);
  }

  private async postRunSteps(
    results: {
      task: Task;
      status: TaskStatus;
      terminalOutput?: string;
    }[],
    doNotSkipCache: boolean,
    { groupId }: { groupId: number }
  ) {
    const now = Date.now();
    const tasksToRecord: { outputs: string[]; hash: string }[] = [];
    for (const { task, status } of results) {
      // Only set endTime as fallback (batch provides timing via result.task)
      task.endTime ??= now;
      // Skip recording for tasks whose outputs already match the cache —
      // the daemon already has the correct hash recorded.
      if (
        !this.stopRequested &&
        task.outputs.length > 0 &&
        status !== 'local-cache-kept-existing'
      ) {
        tasksToRecord.push({ outputs: task.outputs, hash: task.hash });
      }
    }
    if (tasksToRecord.length > 0) {
      await this.recordOutputsHashBatch(tasksToRecord);
    }

    if (doNotSkipCache && !this.stopRequested) {
      // cache the results
      performance.mark('cache-results-start');
      await Promise.all(
        results
          .filter(
            ({ status }) =>
              status !== 'local-cache' &&
              status !== 'local-cache-kept-existing' &&
              status !== 'remote-cache' &&
              status !== 'skipped' &&
              status !== 'stopped'
          )
          .map((result) => ({
            ...result,
            code:
              result.status === 'local-cache' ||
              result.status === 'local-cache-kept-existing' ||
              result.status === 'remote-cache' ||
              result.status === 'success'
                ? 0
                : 1,
            outputs: result.task.outputs,
          }))
          .filter(({ task, code }) => this.shouldCacheTaskResult(task, code))
          .filter(({ terminalOutput, outputs }) => terminalOutput || outputs)
          .map(async ({ task, code, terminalOutput, outputs }) =>
            this.cache.put(task, terminalOutput, outputs, code)
          )
      );
      performance.mark('cache-results-end');
      performance.measure(
        'cache-results',
        'cache-results-start',
        'cache-results-end'
      );
    }

    await this.complete(results, groupId);
    await this.scheduleNextTasksAndReleaseThreads();
  }

  private async scheduleNextTasksAndReleaseThreads() {
    if (this.stopRequested) {
      this.waitingForTasks.forEach((f) => f(null));
      this.waitingForTasks.length = 0;
      return;
    }

    await this.tasksSchedule.scheduleNextTasks();

    // release blocked threads
    this.waitingForTasks.forEach((f) => f(null));
    this.waitingForTasks.length = 0;
  }

  private async complete(
    results: {
      task: Task;
      status: TaskStatus;
      terminalOutput?: string;
      displayStatus?: NativeTaskStatus;
    }[],
    groupId: number
  ): Promise<void> {
    await this.completeTasks(results, groupId);
    this.cleanUpUnneededContinuousTasks();
  }

  /**
   * Unified task completion handler for a set of tasks.
   * - Calls endTasks() lifecycle hook (non-skipped only)
   * - Marks complete in scheduler
   * - Sets completedTasks
   * - Updates TUI status
   * - Skip dependent tasks
   */
  private async completeTasks(
    results: {
      task: Task;
      status: TaskStatus;
      terminalOutput?: string;
      displayStatus?: NativeTaskStatus;
    }[],
    groupId: number
  ): Promise<void> {
    // 1. endTasks FIRST (non-skipped only)
    const tasksToReport: TaskResult[] = [];
    const taskIds: string[] = [];
    for (const { task, status, terminalOutput } of results) {
      taskIds.push(task.id);

      if (!this.completedTasks.has(task.id) && status !== 'skipped') {
        tasksToReport.push({
          task,
          status,
          terminalOutput,
          code:
            status === 'success' ||
            status === 'local-cache' ||
            status === 'local-cache-kept-existing' ||
            status === 'remote-cache'
              ? 0
              : 1,
        });
      }
    }

    if (tasksToReport.length > 0) {
      await this.options.lifeCycle.endTasks(tasksToReport, { groupId });
    }

    // 2. Mark complete in scheduler
    this.tasksSchedule.complete(taskIds);

    // 3. Set completedTasks + update TUI + collect dependent tasks to skip
    const dependentTasksToSkip: { task: Task; status: TaskStatus }[] = [];
    for (const { task, status, displayStatus } of results) {
      if (this.completedTasks.has(task.id)) continue;

      this.completedTasks.set(task.id, status);
      this.taskInvocationTracker?.unregisterTask(task.id);
      this.registeredInvocations.delete(task.id);

      if (this.tuiEnabled) {
        this.options.lifeCycle.setTaskStatus(
          task.id,
          displayStatus ?? parseTaskStatus(status)
        );
      }

      if (
        status === 'failure' ||
        status === 'skipped' ||
        status === 'stopped'
      ) {
        if (this.bail) {
          // mark the execution as bailed which will stop all further execution
          // only the tasks that are currently running will finish
          this.bailed = true;
        } else {
          // Collect reverse deps to skip
          for (const depTaskId of this.reverseTaskDeps[task.id]) {
            const depTask = this.taskGraph.tasks[depTaskId];
            if (depTask) {
              // Don't skip tasks that are still running/stopping — their own
              // exit handler will set the correct terminal status
              if (
                this.runningDiscreteTasks.has(depTaskId) ||
                this.runningContinuousTasks.has(depTaskId)
              ) {
                continue;
              }
              dependentTasksToSkip.push({ task: depTask, status: 'skipped' });
            }
          }
        }
      }
    }

    // 4. Skip dependent tasks
    if (dependentTasksToSkip.length > 0) {
      await this.completeTasks(dependentTasksToSkip, groupId);
    }
  }

  //endregion Lifecycle

  // region utils

  private async pipeOutputCapture(task: Task) {
    try {
      if (process.env.NX_NATIVE_COMMAND_RUNNER !== 'false') {
        return true;
      }

      // When TUI is enabled, we need to use pipe output capture to support
      // progressive output streaming via the onOutput callback
      if (this.tuiEnabled) {
        return true;
      }

      const { schema } = getExecutorForTask(task, this.projects);

      return (
        schema.outputCapture === 'pipe' ||
        process.env.NX_STREAM_OUTPUT === 'true'
      );
    } catch (e) {
      return false;
    }
  }

  private shouldCacheTaskResult(task: Task, code: number) {
    return (
      isCacheableTask(task, this.options) &&
      (process.env.NX_CACHE_FAILURES == 'true' ? true : code === 0)
    );
  }

  private closeGroup(): number {
    for (let i = 0; i < this.options.parallel; i++) {
      if (!this.groups[i]) {
        this.groups[i] = true;
        return i;
      }
    }
  }

  private openGroup(id: number) {
    this.groups[id] = false;
  }

  private async shouldCopyOutputsFromCacheBatch(
    tasks: { outputs: string[]; hash: string }[]
  ): Promise<Map<string, boolean>> {
    const resultMap = new Map<string, boolean>();
    if (tasks.length === 0) return resultMap;

    if (this.daemon?.enabled()) {
      const matches = await this.daemon.outputsHashesMatchBatch(tasks);
      for (let i = 0; i < tasks.length; i++) {
        resultMap.set(tasks[i].hash, !matches[i]);
      }
    } else {
      // No daemon → can't verify on-disk outputs, always copy.
      for (const task of tasks) {
        resultMap.set(task.hash, true);
      }
    }
    return resultMap;
  }

  private async recordOutputsHashBatch(
    entries: { outputs: string[]; hash: string }[]
  ) {
    if (this.daemon?.enabled()) {
      return this.daemon.recordOutputsHashBatch(entries);
    }
  }

  // endregion utils

  private async handleContinuousTaskExit(
    code: number,
    task: Task,
    groupId: number,
    ownsRunningTasksService: boolean
  ) {
    // If cleanup already completed this task, nothing left to do
    if (this.completedTasks.has(task.id)) {
      return;
    }

    const stoppingReason = this.runningContinuousTasks.get(
      task.id
    )?.stoppingReason;
    if (stoppingReason || EXPECTED_TERMINATION_SIGNALS.has(code)) {
      const reason =
        stoppingReason === 'fulfilled' ? 'fulfilled' : 'interrupted';
      await this.completeContinuousTask(
        task,
        groupId,
        ownsRunningTasksService,
        reason
      );
    } else {
      console.error(
        `Task "${task.id}" is continuous but exited with code ${code}`
      );
      await this.completeContinuousTask(
        task,
        groupId,
        ownsRunningTasksService,
        'crashed'
      );
    }
  }

  private async completeContinuousTask(
    task: Task,
    groupId: number,
    ownsRunningTasksService: boolean,
    reason: 'fulfilled' | 'interrupted' | 'crashed'
  ) {
    if (this.completedTasks.has(task.id)) return;

    this.runningContinuousTasks.delete(task.id);
    if (ownsRunningTasksService) {
      this.runningTasksService?.removeRunningTask(task.id);
    }

    task.endTime = Date.now();
    if (reason === 'fulfilled') {
      await this.complete(
        [
          {
            task,
            status: 'success',
            displayStatus: NativeTaskStatus.Stopped,
          },
        ],
        groupId
      );
    } else if (reason === 'crashed') {
      await this.complete([{ task, status: 'failure' }], groupId);
    } else {
      await this.complete([{ task, status: 'stopped' }], groupId);
    }
  }

  private async cleanup() {
    if (this.cleanupPromise) {
      return this.cleanupPromise;
    }
    this.cleanupPromise = this.performCleanup();
    return this.cleanupPromise;
  }

  private async performCleanup() {
    // Mark all running tasks for intentional stop
    const reason = this.stopRequested ? 'interrupted' : 'fulfilled';
    for (const entry of this.runningContinuousTasks.values()) {
      entry.stoppingReason = reason;
    }
    for (const entry of this.runningDiscreteTasks.values()) {
      entry.stopping = true;
    }

    // Snapshot continuous tasks before clearing the map.
    // We clear first because complete() -> cleanUpUnneededContinuousTasks()
    // iterates runningContinuousTasks and would re-kill already-stopping tasks.
    const continuousSnapshot = Array.from(
      this.runningContinuousTasks.entries()
    );
    this.runningContinuousTasks.clear();

    // Complete continuous tasks directly — don't rely on onExit which may hang
    // when grandchild processes keep the pty slave fd open.
    for (const [
      taskId,
      { groupId, ownsRunningTasksService },
    ] of continuousSnapshot) {
      const task = this.taskGraph.tasks[taskId];
      if (!task) continue;
      await this.completeContinuousTask(
        task,
        groupId,
        ownsRunningTasksService,
        reason
      );
    }

    // Kill all processes
    this.forkedProcessTaskRunner.cleanup();
    await Promise.all([
      ...continuousSnapshot.map(async ([taskId, { runningTask }]) => {
        try {
          await runningTask.kill();
        } catch (e) {
          console.error(`Unable to terminate ${taskId}\nError:`, e);
        }
      }),
      ...Array.from(this.runningDiscreteTasks).map(
        async ([taskId, { runningTask }]) => {
          try {
            await runningTask.kill();
          } catch (e) {
            console.error(`Unable to terminate ${taskId}\nError:`, e);
          }
        }
      ),
      ...Array.from(this.runningRunCommandsTasks).map(async ([taskId, t]) => {
        try {
          await t.kill();
        } catch (e) {
          console.error(`Unable to terminate ${taskId}\nError:`, e);
        }
      }),
    ]);

    // Discrete exit promises resolve promptly (process kill → getResults →
    // postRunSteps → resolve). Await them so lifecycle endTasks() completes
    // before run() returns and endCommand() is called.
    await Promise.all(this.discreteTaskExitHandled.values());
  }

  private setupSignalHandlers() {
    process.once('SIGINT', () => {
      this.stopRequested = true;
      if (!this.tuiEnabled) {
        // Synchronously remove DB entries before async cleanup to prevent
        // new nx processes from seeing stale "Waiting for ..." messages.
        // This replicates the cleanup that process.exit() + Rust Drop
        // previously provided.
        for (const [taskId, { ownsRunningTasksService }] of this
          .runningContinuousTasks) {
          if (ownsRunningTasksService) {
            this.runningTasksService?.removeRunningTask(taskId);
          }
        }
        // Silence output — pnpm (and similar wrappers) may exit before nx
        // finishes cleanup, returning the shell prompt. Any output after
        // that point would appear after the prompt.
        const noop = (_chunk, _encoding, callback) => {
          if (callback) callback();
          return true;
        };
        process.stdout.write = noop as any;
        process.stderr.write = noop as any;
      }
      this.cleanup().finally(() => {
        if (this.resolveStopPromise) {
          this.resolveStopPromise();
        } else {
          process.exit(signalToCode('SIGINT'));
        }
      });
    });
    process.once('SIGTERM', () => {
      this.stopRequested = true;
      this.cleanup().finally(() => {
        if (this.resolveStopPromise) {
          this.resolveStopPromise();
        }
      });
    });
    process.once('SIGHUP', () => {
      this.stopRequested = true;
      this.cleanup().finally(() => {
        if (this.resolveStopPromise) {
          this.resolveStopPromise();
        }
      });
    });
  }

  private cleanUpUnneededContinuousTasks() {
    const incompleteTasks = this.tasksSchedule.getIncompleteTasks();
    const neededContinuousTasks = new Set<string>();
    for (const task of incompleteTasks) {
      // Keep initiating tasks that are still incomplete
      if (task.continuous && this.initializingTaskIds.has(task.id)) {
        neededContinuousTasks.add(task.id);
      }

      const continuousDependencies =
        this.taskGraph.continuousDependencies[task.id];
      for (const continuousDependency of continuousDependencies) {
        neededContinuousTasks.add(continuousDependency);
      }
    }

    for (const [taskId, entry] of this.runningContinuousTasks) {
      if (!neededContinuousTasks.has(taskId)) {
        // Mark as intentional kill before calling kill()
        // onExit will see this and use success/Stopped
        entry.stoppingReason = 'fulfilled';
        entry.runningTask.kill();
      }
    }
  }
}

export function getThreadPoolSize(
  options: NxArgs & DefaultTasksRunnerOptions,
  taskGraph: TaskGraph
): { discrete: number; continuous: number; total: number } {
  if (
    (options as any)['parallel'] === 'false' ||
    (options as any)['parallel'] === false
  ) {
    (options as any)['parallel'] = 1;
  } else if (
    (options as any)['parallel'] === 'true' ||
    (options as any)['parallel'] === true ||
    (options as any)['parallel'] === undefined ||
    (options as any)['parallel'] === ''
  ) {
    (options as any)['parallel'] = Number((options as any)['maxParallel'] || 3);
  }

  const continuousCount = Object.values(taskGraph.tasks).filter(
    (t) => t.continuous
  ).length;

  const discrete = options['parallel'];
  const continuous = continuousCount;
  const total = discrete + continuous;

  return { discrete, continuous, total };
}
