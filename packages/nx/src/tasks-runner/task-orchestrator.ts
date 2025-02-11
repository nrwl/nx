import { defaultMaxListeners } from 'events';
import { performance } from 'perf_hooks';
import { relative } from 'path';
import { writeFileSync } from 'fs';
import { TaskHasher } from '../hasher/task-hasher';
import {
  runCommands,
  normalizeOptions,
} from '../executors/run-commands/run-commands.impl';
import { ForkedProcessTaskRunner } from './forked-process-task-runner';
import { Cache, DbCache, getCache } from './cache';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { TaskStatus } from './tasks-runner';
import {
  calculateReverseDeps,
  getExecutorForTask,
  getPrintableCommandArgsForTask,
  getTargetConfigurationForTask,
  isCacheableTask,
  removeTasksFromTaskGraph,
  shouldStreamOutput,
} from './utils';
import { Batch, TasksSchedule } from './tasks-schedule';
import { TaskMetadata } from './life-cycle';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { DaemonClient } from '../daemon/client/client';
import { getTaskDetails, hashTask } from '../hasher/hash-task';
import {
  getEnvVariablesForBatchProcess,
  getEnvVariablesForTask,
  getTaskSpecificEnv,
} from './task-env';
import { workspaceRoot } from '../utils/workspace-root';
import { output } from '../utils/output';
import { combineOptionsForExecutor } from '../utils/params';
import { NxJsonConfiguration } from '../config/nx-json';
import type { TaskDetails } from '../native';
import { NoopChildProcess } from './running-tasks/noop-child-process';
import { RunningTask } from './running-tasks/running-task';
import { NxArgs } from '../utils/command-line-utils';

export class TaskOrchestrator {
  private taskDetails: TaskDetails | null = getTaskDetails();
  private cache: DbCache | Cache = getCache(this.options);
  private forkedProcessTaskRunner = new ForkedProcessTaskRunner(this.options);

  private tasksSchedule = new TasksSchedule(
    this.projectGraph,
    this.taskGraph,
    this.options
  );

  // region internal state
  private batchEnv = getEnvVariablesForBatchProcess(
    this.options.skipNxCache,
    this.options.captureStderr
  );
  private reverseTaskDeps = calculateReverseDeps(this.taskGraph);

  private processedTasks = new Map<string, Promise<NodeJS.ProcessEnv>>();
  private processedBatches = new Map<Batch, Promise<void>>();

  private completedTasks: {
    [id: string]: TaskStatus;
  } = {};
  private waitingForTasks: Function[] = [];

  private groups = [];

  private bailed = false;

  private runningContinuousTasks = new Map<string, RunningTask>();

  private cleaningUp = false;
  // endregion internal state

  constructor(
    private readonly hasher: TaskHasher,
    private readonly initiatingProject: string | undefined,
    private readonly projectGraph: ProjectGraph,
    private readonly taskGraph: TaskGraph,
    private readonly nxJson: NxJsonConfiguration,
    private readonly options: NxArgs & DefaultTasksRunnerOptions,
    private readonly bail: boolean,
    private readonly daemon: DaemonClient,
    private readonly outputStyle: string
  ) {}

  async run() {
    // Init the ForkedProcessTaskRunner, TasksSchedule, and Cache
    await Promise.all([
      this.forkedProcessTaskRunner.init(),
      this.tasksSchedule.init(),
      'init' in this.cache ? this.cache.init() : null,
    ]);

    // initial scheduling
    await this.tasksSchedule.scheduleNextTasks();

    performance.mark('task-execution:start');

    const threadCount =
      this.options.parallel +
      Object.values(this.taskGraph.tasks).filter((t) => t.continuous).length;

    const threads = [];

    process.stdout.setMaxListeners(threadCount + defaultMaxListeners);
    process.stderr.setMaxListeners(threadCount + defaultMaxListeners);

    // initial seeding of the queue
    for (let i = 0; i < threadCount; ++i) {
      threads.push(this.executeNextBatchOfTasksUsingTaskSchedule());
    }
    await Promise.all(threads);

    performance.mark('task-execution:end');
    performance.measure(
      'task-execution',
      'task-execution:start',
      'task-execution:end'
    );
    this.cache.removeOldCacheRecords();

    await this.cleanup();

    return this.completedTasks;
  }

  private async executeNextBatchOfTasksUsingTaskSchedule() {
    // completed all the tasks
    if (!this.tasksSchedule.hasTasks() || this.bailed) {
      return null;
    }

    const doNotSkipCache =
      this.options.skipNxCache === false ||
      this.options.skipNxCache === undefined;

    this.processAllScheduledTasks();
    const batch = this.tasksSchedule.nextBatch();
    if (batch) {
      const groupId = this.closeGroup();

      await this.applyFromCacheOrRunBatch(doNotSkipCache, batch, groupId);

      this.openGroup(groupId);

      return this.executeNextBatchOfTasksUsingTaskSchedule();
    }

    const task = this.tasksSchedule.nextTask();
    if (task) {
      const groupId = this.closeGroup();

      if (task.continuous) {
        await this.startContinuousTask(task, groupId);
      } else {
        await this.applyFromCacheOrRunTask(doNotSkipCache, task, groupId);
      }

      this.openGroup(groupId);

      return this.executeNextBatchOfTasksUsingTaskSchedule();
    }

    // block until some other task completes, then try again
    return new Promise((res) => this.waitingForTasks.push(res)).then(() =>
      this.executeNextBatchOfTasksUsingTaskSchedule()
    );
  }

  // region Processing Scheduled Tasks
  private async processScheduledTask(
    taskId: string
  ): Promise<NodeJS.ProcessEnv> {
    const task = this.taskGraph.tasks[taskId];
    const taskSpecificEnv = getTaskSpecificEnv(task);

    if (!task.hash) {
      await hashTask(
        this.hasher,
        this.projectGraph,
        this.taskGraph,
        task,
        taskSpecificEnv,
        this.taskDetails
      );
    }

    await this.options.lifeCycle.scheduleTask(task);

    return taskSpecificEnv;
  }

  private async processScheduledBatch(batch: Batch) {
    await Promise.all(
      Object.values(batch.taskGraph.tasks).map(async (task) => {
        if (!task.hash) {
          await hashTask(
            this.hasher,
            this.projectGraph,
            this.taskGraph,
            task,
            this.batchEnv,
            this.taskDetails
          );
        }
        await this.options.lifeCycle.scheduleTask(task);
      })
    );
  }

  private processAllScheduledTasks() {
    const { scheduledTasks, scheduledBatches } =
      this.tasksSchedule.getAllScheduledTasks();

    for (const batch of scheduledBatches) {
      this.processedBatches.set(batch, this.processScheduledBatch(batch));
    }
    for (const taskId of scheduledTasks) {
      // Task is already handled or being handled
      if (!this.processedTasks.has(taskId)) {
        this.processedTasks.set(taskId, this.processScheduledTask(taskId));
      }
    }
  }

  // endregion Processing Scheduled Tasks

  // region Applying Cache
  private async applyCachedResults(tasks: Task[]): Promise<
    {
      task: Task;
      status: 'local-cache' | 'local-cache-kept-existing' | 'remote-cache';
    }[]
  > {
    const cacheableTasks = tasks.filter((t) =>
      isCacheableTask(t, this.options)
    );
    const res = await Promise.all(
      cacheableTasks.map((t) => this.applyCachedResult(t))
    );
    return res.filter((r) => r !== null);
  }

  private async applyCachedResult(task: Task): Promise<{
    task: Task;
    status: 'local-cache' | 'local-cache-kept-existing' | 'remote-cache';
  }> {
    const cachedResult = await this.cache.get(task);
    if (!cachedResult || cachedResult.code !== 0) return null;

    const outputs = task.outputs;
    const shouldCopyOutputsFromCache =
      !!outputs.length &&
      (await this.shouldCopyOutputsFromCache(outputs, task.hash));
    if (shouldCopyOutputsFromCache) {
      await this.cache.copyFilesFromCache(task.hash, cachedResult, outputs);
    }
    const status = cachedResult.remote
      ? 'remote-cache'
      : shouldCopyOutputsFromCache
      ? 'local-cache'
      : 'local-cache-kept-existing';
    this.options.lifeCycle.printTaskTerminalOutput(
      task,
      status,
      cachedResult.terminalOutput
    );
    return {
      task,
      status,
    };
  }

  // endregion Applying Cache

  // region Batch
  private async applyFromCacheOrRunBatch(
    doNotSkipCache: boolean,
    batch: Batch,
    groupId: number
  ) {
    const taskEntries = Object.entries(batch.taskGraph.tasks);
    const tasks = taskEntries.map(([, task]) => task);

    // Wait for batch to be processed
    await this.processedBatches.get(batch);

    await this.preRunSteps(tasks, { groupId });

    let results: {
      task: Task;
      status: TaskStatus;
      terminalOutput?: string;
    }[] = doNotSkipCache ? await this.applyCachedResults(tasks) : [];

    // Run tasks that were not cached
    if (results.length !== taskEntries.length) {
      const unrunTaskGraph = removeTasksFromTaskGraph(
        batch.taskGraph,
        results.map(({ task }) => task.id)
      );

      const batchResults = await this.runBatch(
        {
          executorName: batch.executorName,
          taskGraph: unrunTaskGraph,
        },
        this.batchEnv
      );

      results.push(...batchResults);
    }

    await this.postRunSteps(tasks, results, doNotSkipCache, { groupId });

    const tasksCompleted = taskEntries.filter(
      ([taskId]) => this.completedTasks[taskId]
    );

    // Batch is still not done, run it again
    if (tasksCompleted.length !== taskEntries.length) {
      await this.applyFromCacheOrRunBatch(
        doNotSkipCache,
        {
          executorName: batch.executorName,
          taskGraph: removeTasksFromTaskGraph(
            batch.taskGraph,
            tasksCompleted.map(([taskId]) => taskId)
          ),
        },
        groupId
      );
    }
  }

  private async runBatch(batch: Batch, env: NodeJS.ProcessEnv) {
    try {
      const batchProcess =
        await this.forkedProcessTaskRunner.forkProcessForBatch(
          batch,
          this.taskGraph,
          env
        );
      const results = await batchProcess.getResults();
      const batchResultEntries = Object.entries(results);
      return batchResultEntries.map(([taskId, result]) => ({
        ...result,
        task: {
          ...this.taskGraph.tasks[taskId],
          startTime: result.startTime,
          endTime: result.endTime,
        },
        status: (result.success ? 'success' : 'failure') as TaskStatus,
        terminalOutput: result.terminalOutput,
      }));
    } catch (e) {
      return batch.taskGraph.roots.map((rootTaskId) => ({
        task: this.taskGraph.tasks[rootTaskId],
        status: 'failure' as TaskStatus,
      }));
    }
  }

  // endregion Batch

  // region Single Task
  private async applyFromCacheOrRunTask(
    doNotSkipCache: boolean,
    task: Task,
    groupId: number
  ) {
    // Wait for task to be processed
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

    let results: {
      task: Task;
      status: TaskStatus;
      terminalOutput?: string;
    }[] = doNotSkipCache ? await this.applyCachedResults([task]) : [];

    // the task wasn't cached
    if (results.length === 0) {
      const childProcess = await this.runTask(
        task,
        streamOutput,
        env,
        temporaryOutputPath,
        pipeOutput
      );

      const { code, terminalOutput } = await childProcess.getResults();
      results.push({
        task,
        status: code === 0 ? 'success' : 'failure',
        terminalOutput,
      });
    }
    await this.postRunSteps([task], results, doNotSkipCache, { groupId });
  }

  private async runTask(
    task: Task,
    streamOutput: boolean,
    env: { [p: string]: string | undefined; TZ?: string },
    temporaryOutputPath: string,
    pipeOutput: boolean
  ): Promise<RunningTask> {
    const shouldPrefix =
      streamOutput && process.env.NX_PREFIX_OUTPUT === 'true';
    const targetConfiguration = getTargetConfigurationForTask(
      task,
      this.projectGraph
    );
    if (
      process.env.NX_RUN_COMMANDS_DIRECTLY !== 'false' &&
      targetConfiguration.executor === 'nx:run-commands' &&
      !shouldPrefix
    ) {
      try {
        const { schema } = getExecutorForTask(task, this.projectGraph);
        const isRunOne = this.initiatingProject != null;
        const combinedOptions = combineOptionsForExecutor(
          task.overrides,
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
        let runCommandsOptions = {
          ...combinedOptions,
          env,
          usePty:
            isRunOne &&
            !this.tasksSchedule.hasTasks() &&
            this.runningContinuousTasks.size === 0,
          streamOutput,
        };
        const useTui = process.env.NX_TUI === 'true';
        if (useTui) {
          // Preprocess options on the JS side before sending to Rust
          runCommandsOptions = normalizeOptions(runCommandsOptions);
        }

        if (
          useTui &&
          typeof this.options.lifeCycle.__runCommandsForTask !== 'function'
        ) {
          throw new Error('Incorrect lifeCycle applied for NX_TUI');
        }

        const runningTask =
          // Run the command directly in Rust if the task is continuous and has a single command
          useTui && task.continuous && runCommandsOptions.commands?.length === 1
            ? await this.options.lifeCycle.__runCommandsForTask(
                task,
                runCommandsOptions
              )
            : // Currently always run in JS if there are multiple commands defined for a single task, or if not continuous
              await runCommands(runCommandsOptions, {
                root: workspaceRoot, // only root is needed in runCommands
              } as any);

        runningTask.onExit((code, terminalOutput) => {
          if (!streamOutput) {
            this.options.lifeCycle.printTaskTerminalOutput(
              task,
              code === 0 ? 'success' : 'failure',
              terminalOutput
            );
            writeFileSync(temporaryOutputPath, terminalOutput);
          }
        });

        return runningTask;
      } catch (e) {
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
          console.error(e);
        } else {
          console.error(e.message);
        }
        const terminalOutput = e.stack ?? e.message ?? '';
        writeFileSync(temporaryOutputPath, terminalOutput);
      }
    } else if (targetConfiguration.executor === 'nx:noop') {
      writeFileSync(temporaryOutputPath, '');
      return new NoopChildProcess({
        code: 0,
        terminalOutput: '',
      });
    } else {
      // cache prep
      return await this.runTaskInForkedProcess(
        task,
        env,
        pipeOutput,
        temporaryOutputPath,
        streamOutput
      );
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
      const disablePseudoTerminal = !this.initiatingProject || task.continuous;
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
        terminalOutput: undefined,
      });
    }
  }

  private async startContinuousTask(task: Task, groupId: number) {
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
    const childProcess = await this.runTask(
      task,
      streamOutput,
      env,
      temporaryOutputPath,
      pipeOutput
    );
    this.runningContinuousTasks.set(task.id, childProcess);

    childProcess.onExit((code) => {
      if (!this.cleaningUp) {
        console.error(
          `Task "${task.id}" is continuous but exited with code ${code}`
        );
        this.cleanup().then(() => {
          process.exit(1);
        });
      }
    });
    if (
      this.initiatingProject === task.target.project &&
      this.options.targets.length === 1 &&
      this.options.targets[0] === task.target.target
    ) {
      await childProcess.getResults();
    } else {
      await this.tasksSchedule.scheduleNextTasks();
      // release blocked threads
      this.waitingForTasks.forEach((f) => f(null));
      this.waitingForTasks.length = 0;
    }

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
    tasks: Task[],
    results: {
      task: Task;
      status: TaskStatus;
      terminalOutput?: string;
    }[],
    doNotSkipCache: boolean,
    { groupId }: { groupId: number }
  ) {
    const now = Date.now();
    for (const task of tasks) {
      task.endTime = now;
      await this.recordOutputsHash(task);
    }

    if (doNotSkipCache) {
      // cache the results
      performance.mark('cache-results-start');
      await Promise.all(
        results
          .filter(
            ({ status }) =>
              status !== 'local-cache' &&
              status !== 'local-cache-kept-existing' &&
              status !== 'remote-cache' &&
              status !== 'skipped'
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
    await this.options.lifeCycle.endTasks(
      results.map((result) => {
        const code =
          result.status === 'success' ||
          result.status === 'local-cache' ||
          result.status === 'local-cache-kept-existing' ||
          result.status === 'remote-cache'
            ? 0
            : 1;
        return {
          ...result,
          task: result.task,
          status: result.status,
          code,
        };
      }),
      { groupId }
    );

    this.complete(
      results.map(({ task, status }) => {
        return {
          taskId: task.id,
          status,
        };
      })
    );

    await this.tasksSchedule.scheduleNextTasks();

    // release blocked threads
    this.waitingForTasks.forEach((f) => f(null));
    this.waitingForTasks.length = 0;
  }

  private complete(
    taskResults: {
      taskId: string;
      status: TaskStatus;
    }[]
  ) {
    this.tasksSchedule.complete(taskResults.map(({ taskId }) => taskId));

    for (const { taskId, status } of taskResults) {
      if (this.completedTasks[taskId] === undefined) {
        this.completedTasks[taskId] = status;

        if (status === 'failure' || status === 'skipped') {
          if (this.bail) {
            // mark the execution as bailed which will stop all further execution
            // only the tasks that are currently running will finish
            this.bailed = true;
          } else {
            // only mark the packages that depend on the current task as skipped
            // other tasks will continue to execute
            this.complete(
              this.reverseTaskDeps[taskId].map((depTaskId) => ({
                taskId: depTaskId,
                status: 'skipped',
              }))
            );
          }
        }
      }
    }
  }

  //endregion Lifecycle

  // region utils

  private async pipeOutputCapture(task: Task) {
    try {
      if (process.env.NX_NATIVE_COMMAND_RUNNER !== 'false') {
        return true;
      }

      const { schema } = getExecutorForTask(task, this.projectGraph);

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

  private closeGroup() {
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

  private async shouldCopyOutputsFromCache(outputs: string[], hash: string) {
    if (this.daemon?.enabled()) {
      return !(await this.daemon.outputsHashesMatch(outputs, hash));
    } else {
      return true;
    }
  }

  private async recordOutputsHash(task: Task) {
    if (this.daemon?.enabled()) {
      return this.daemon.recordOutputsHash(task.outputs, task.hash);
    }
  }

  // endregion utils

  private async cleanup() {
    this.cleaningUp = true;
    await Promise.all(
      Array.from(this.runningContinuousTasks).map(async ([taskId, t]) => {
        try {
          return t.kill();
        } catch (e) {
          console.error(`Unable to terminate ${taskId}\nError:`, e);
        }
      })
    );
  }
}
