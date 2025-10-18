import { defaultMaxListeners } from 'events';
import { writeFileSync } from 'fs';
import { relative } from 'path';
import { performance } from 'perf_hooks';
import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { DaemonClient } from '../daemon/client/client';
import { runCommands } from '../executors/run-commands/run-commands.impl';
import { getTaskDetails, hashTask } from '../hasher/hash-task';
import { TaskHasher } from '../hasher/task-hasher';
import {
  IS_WASM,
  parseTaskStatus,
  RunningTasksService,
  TaskDetails,
  TaskStatus as NativeTaskStatus,
} from '../native';
import { NxArgs } from '../utils/command-line-utils';
import { getDbConnection } from '../utils/db-connection';
import { output } from '../utils/output';
import { combineOptionsForExecutor } from '../utils/params';
import { workspaceRoot } from '../utils/workspace-root';
import { Cache, DbCache, dbCacheEnabled, getCache } from './cache';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { ForkedProcessTaskRunner } from './forked-process-task-runner';
import { isTuiEnabled } from './is-tui-enabled';
import { TaskMetadata, TaskResult } from './life-cycle';
import { PseudoTtyProcess } from './pseudo-terminal';
import { NoopChildProcess } from './running-tasks/noop-child-process';
import { RunningTask } from './running-tasks/running-task';
import {
  getEnvVariablesForBatchProcess,
  getEnvVariablesForTask,
  getTaskSpecificEnv,
} from './task-env';
import { TaskStatus } from './tasks-runner';
import { Batch, TasksSchedule } from './tasks-schedule';
import {
  calculateReverseDeps,
  getExecutorForTask,
  getPrintableCommandArgsForTask,
  getTargetConfigurationForTask,
  isCacheableTask,
  removeTasksFromTaskGraph,
  shouldStreamOutput,
} from './utils';
import { SharedRunningTask } from './running-tasks/shared-running-task';

export class TaskOrchestrator {
  private taskDetails: TaskDetails | null = getTaskDetails();
  private cache: DbCache | Cache = getCache(this.options);
  private readonly tuiEnabled = isTuiEnabled();
  private forkedProcessTaskRunner = new ForkedProcessTaskRunner(
    this.options,
    this.tuiEnabled
  );

  private runningTasksService = !IS_WASM
    ? new RunningTasksService(getDbConnection())
    : null;
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

  private initializingTaskIds = new Set(this.initiatingTasks.map((t) => t.id));

  private processedTasks = new Map<string, Promise<NodeJS.ProcessEnv>>();
  private processedBatches = new Map<Batch, Promise<void>>();

  private completedTasks: {
    [id: string]: TaskStatus;
  } = {};
  private waitingForTasks: Function[] = [];

  private groups = [];

  private bailed = false;

  private runningContinuousTasks = new Map<string, RunningTask>();
  private runningRunCommandsTasks = new Map<string, RunningTask>();

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

    const threadCount = getThreadCount(this.options, this.taskGraph);

    const threads = [];

    process.stdout.setMaxListeners(threadCount + defaultMaxListeners);
    process.stderr.setMaxListeners(threadCount + defaultMaxListeners);

    // initial seeding of the queue
    for (let i = 0; i < threadCount; ++i) {
      threads.push(this.executeNextBatchOfTasksUsingTaskSchedule());
    }

    await Promise.race([
      Promise.all(threads),
      ...(this.tuiEnabled
        ? [
            new Promise((resolve) => {
              this.options.lifeCycle.registerForcedShutdownCallback(() => {
                // The user force quit the TUI with ctrl+c, so proceed onto cleanup
                resolve(undefined);
              });
            }),
          ]
        : []),
    ]);

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

  public nextBatch() {
    return this.tasksSchedule.nextBatch();
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
    const batch = this.nextBatch();
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

  private processTasks(taskIds: string[]) {
    for (const taskId of taskIds) {
      // Task is already handled or being handled
      if (!this.processedTasks.has(taskId)) {
        this.processedTasks.set(taskId, this.processTask(taskId));
      }
    }
  }

  // region Processing Scheduled Tasks
  private async processTask(taskId: string): Promise<NodeJS.ProcessEnv> {
    const task = this.taskGraph.tasks[taskId];
    const taskSpecificEnv = getTaskSpecificEnv(task);

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

  private async processScheduledBatch(batch: Batch) {
    await Promise.all(
      Object.values(batch.taskGraph.tasks).map(async (task) => {
        if (!task.hash) {
          await hashTask(
            this.hasher,
            this.projectGraph,
            this.taskGraphForHashing,
            task,
            this.batchEnv,
            this.taskDetails
          );
        }
        await this.options.lifeCycle.scheduleTask(task);
      })
    );
  }

  public processAllScheduledTasks() {
    const { scheduledTasks, scheduledBatches } =
      this.tasksSchedule.getAllScheduledTasks();

    for (const batch of scheduledBatches) {
      this.processedBatches.set(batch, this.processScheduledBatch(batch));
    }
    this.processTasks(scheduledTasks);
  }

  // endregion Processing Scheduled Tasks

  // region Applying Cache
  private async applyCachedResults(tasks: Task[]): Promise<TaskResult[]> {
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
    code: number;
    status: 'local-cache' | 'local-cache-kept-existing' | 'remote-cache';
  }> {
    const cachedResult = await this.cache.get(task);
    if (!cachedResult || cachedResult.code !== 0) return null;

    const outputs = task.outputs;
    const shouldCopyOutputsFromCache =
      // No output files to restore
      !!outputs.length &&
      // Remote caches are restored to output dirs when applied and using db cache
      (!cachedResult.remote || !dbCacheEnabled()) &&
      // Output files have not been touched since last run
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
      code: cachedResult.code,
      task,
      status,
    };
  }

  // endregion Applying Cache

  // region Batch
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

    // Wait for batch to be processed
    await this.processedBatches.get(batch);

    await this.preRunSteps(tasks, { groupId });

    let results: TaskResult[] = doNotSkipCache
      ? await this.applyCachedResults(tasks)
      : [];

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
    this.forkedProcessTaskRunner.cleanUpBatchProcesses();

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
    // Batch is done, mark it as completed
    const applyFromCacheOrRunBatchEnd = performance.mark(
      'TaskOrchestrator-apply-from-cache-or-run-batch:end'
    );
    performance.measure(
      'TaskOrchestrator-apply-from-cache-or-run-batch',
      applyFromCacheOrRunBatchStart.name,
      applyFromCacheOrRunBatchEnd.name
    );
    return results;
  }

  private async runBatch(
    batch: Batch,
    env: NodeJS.ProcessEnv
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
      const results = await batchProcess.getResults();
      const batchResultEntries = Object.entries(results);
      return batchResultEntries.map(([taskId, result]) => ({
        ...result,
        code: result.success ? 0 : 1,
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
        code: 1,
        status: 'failure' as TaskStatus,
      }));
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
  async applyFromCacheOrRunTask(
    doNotSkipCache: boolean,
    task: Task,
    groupId: number
  ): Promise<TaskResult> {
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
      code: number;
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
        code,
        status: code === 0 ? 'success' : 'failure',
        terminalOutput,
      });
    }
    await this.postRunSteps([task], results, doNotSkipCache, { groupId });
    return results[0];
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
        const runCommandsOptions = {
          ...combinedOptions,
          env,
          usePty:
            this.tuiEnabled ||
            (!this.tasksSchedule.hasTasks() &&
              this.runningContinuousTasks.size === 0),
          streamOutput,
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
          } else {
            this.options.lifeCycle.registerRunningTaskWithEmptyParser(task.id);
            runningTask.onOutput((output) => {
              this.options.lifeCycle.appendTaskOutput(task.id, output, false);
            });
          }
        }

        if (!streamOutput) {
          if (runningTask instanceof PseudoTtyProcess) {
            // TODO: shouldn't this be checking if the task is continuous before writing anything to disk or calling printTaskTerminalOutput?
            let terminalOutput = '';
            runningTask.onOutput((data) => {
              terminalOutput += data;
            });
            runningTask.onExit((code) => {
              this.options.lifeCycle.printTaskTerminalOutput(
                task,
                code === 0 ? 'success' : 'failure',
                terminalOutput
              );
              writeFileSync(temporaryOutputPath, terminalOutput);
            });
          } else {
            runningTask.onExit((code, terminalOutput) => {
              this.options.lifeCycle.printTaskTerminalOutput(
                task,
                code === 0 ? 'success' : 'failure',
                terminalOutput
              );
              writeFileSync(temporaryOutputPath, terminalOutput);
            });
          }
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
        terminalOutput: undefined,
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

      this.runningContinuousTasks.set(task.id, runningTask);
      runningTask.onExit(() => {
        if (this.tuiEnabled) {
          this.options.lifeCycle.setTaskStatus(
            task.id,
            NativeTaskStatus.Stopped
          );
        }
        this.runningContinuousTasks.delete(task.id);
      });

      // task is already running by another process, we schedule the next tasks
      // and release the threads
      await this.scheduleNextTasksAndReleaseThreads();
      if (this.initializingTaskIds.has(task.id)) {
        await new Promise<void>((res) => {
          runningTask.onExit((code) => {
            if (!this.tuiEnabled) {
              if (code > 128) {
                process.exit(code);
              }
            }
            res();
          });
        });
      }
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
    const childProcess = await this.runTask(
      task,
      streamOutput,
      env,
      temporaryOutputPath,
      pipeOutput
    );
    this.runningTasksService.addRunningTask(task.id);
    this.runningContinuousTasks.set(task.id, childProcess);

    childProcess.onExit(() => {
      if (this.tuiEnabled) {
        this.options.lifeCycle.setTaskStatus(task.id, NativeTaskStatus.Stopped);
      }
      if (this.runningContinuousTasks.delete(task.id)) {
        this.runningTasksService.removeRunningTask(task.id);
      }
    });
    await this.scheduleNextTasksAndReleaseThreads();
    if (this.initializingTaskIds.has(task.id)) {
      await new Promise<void>((res) => {
        childProcess.onExit((code) => {
          if (!this.tuiEnabled) {
            if (code > 128) {
              process.exit(code);
            }
          }
          res();
        });
      });
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

    await this.scheduleNextTasksAndReleaseThreads();
  }

  private async scheduleNextTasksAndReleaseThreads() {
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

    this.cleanUpUnneededContinuousTasks();

    for (const { taskId, status } of taskResults) {
      if (this.completedTasks[taskId] === undefined) {
        this.completedTasks[taskId] = status;

        if (this.tuiEnabled) {
          this.options.lifeCycle.setTaskStatus(taskId, parseTaskStatus(status));
        }

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
    this.forkedProcessTaskRunner.cleanup();
    await Promise.all([
      ...Array.from(this.runningContinuousTasks).map(async ([taskId, t]) => {
        try {
          await t.kill();
          this.options.lifeCycle.setTaskStatus?.(
            taskId,
            NativeTaskStatus.Stopped
          );
        } catch (e) {
          console.error(`Unable to terminate ${taskId}\nError:`, e);
        } finally {
          if (this.runningContinuousTasks.delete(taskId)) {
            this.runningTasksService.removeRunningTask(taskId);
          }
        }
      }),
      ...Array.from(this.runningRunCommandsTasks).map(async ([taskId, t]) => {
        try {
          await t.kill();
        } catch (e) {
          console.error(`Unable to terminate ${taskId}\nError:`, e);
        }
      }),
    ]);
  }

  private cleanUpUnneededContinuousTasks() {
    const incompleteTasks = this.tasksSchedule.getIncompleteTasks();
    const neededContinuousTasks = new Set(this.initializingTaskIds);
    for (const task of incompleteTasks) {
      const continuousDependencies =
        this.taskGraph.continuousDependencies[task.id];
      for (const continuousDependency of continuousDependencies) {
        neededContinuousTasks.add(continuousDependency);
      }
    }

    for (const taskId of this.runningContinuousTasks.keys()) {
      if (!neededContinuousTasks.has(taskId)) {
        const runningTask = this.runningContinuousTasks.get(taskId);
        if (runningTask) {
          runningTask.kill();
          this.options.lifeCycle.setTaskStatus?.(
            taskId,
            NativeTaskStatus.Stopped
          );
        }
      }
    }
  }
}

export function getThreadCount(
  options: NxArgs & DefaultTasksRunnerOptions,
  taskGraph: TaskGraph
) {
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

  const maxParallel =
    options['parallel'] +
    Object.values(taskGraph.tasks).filter((t) => t.continuous).length;
  const totalTasks = Object.keys(taskGraph.tasks).length;
  return Math.min(maxParallel, totalTasks);
}
