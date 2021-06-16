import { Workspaces } from '@nrwl/tao/src/shared/workspace';
import { writeFileSync } from 'fs';
import type { ProjectGraph } from '@nrwl/devkit';
import { output, TaskCacheStatus } from '../utilities/output';
import { Cache, TaskWithCachedResult } from './cache';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { AffectedEventType, Task } from './tasks-runner';
import { getCommandArgsForTask, getExecutorForTask, getOutputs } from './utils';
import { performance } from 'perf_hooks';
import { TaskGraph } from './task-graph-creator';
import { Hasher } from '../core/hasher/hasher';
import { ForkedProcessTaskRunner } from './forked-process-task-runner';
import { appRootPath } from '../utilities/app-root';

export class TaskOrchestrator {
  cache = new Cache(this.options);
  timings: { [target: string]: { start: number; end: number } } = {};
  completedTasks: {
    [id: string]: 'success' | 'failure' | 'skipped' | 'cache';
  } = {};
  inProgressTasks: {
    [id: string]: boolean;
  } = {};
  scheduledTasks: string[] = [];
  waitingForTasks: Function[] = [];
  reverseTaskDeps: Record<string, string[]> = {};

  private workspace = new Workspaces(appRootPath);
  private forkedProcessTaskRunner = new ForkedProcessTaskRunner(this.options);

  constructor(
    private readonly hasher: Hasher,
    private readonly initiatingProject: string | undefined,
    private readonly projectGraph: ProjectGraph,
    private readonly taskGraph: TaskGraph,
    private readonly options: DefaultTasksRunnerOptions,
    private readonly hideCachedOutput: boolean
  ) {}

  async run() {
    this.calculateReverseDeps();
    for (let root of this.taskGraph.roots) {
      await this.scheduleTask(root);
    }
    performance.mark('task-execution-begins');
    const res = await this.runTasks();
    performance.mark('task-execution-ends');
    performance.measure(
      'command-execution',
      'task-execution-begins',
      'task-execution-ends'
    );
    this.cache.removeOldCacheRecords();
    return res;
  }

  private calculateReverseDeps() {
    Object.keys(this.taskGraph.tasks).forEach((t) => {
      this.reverseTaskDeps[t] = [];
    });

    Object.keys(this.taskGraph.dependencies).forEach((taskId) => {
      this.taskGraph.dependencies[taskId].forEach((d) => {
        this.reverseTaskDeps[d].push(taskId);
      });
    });
  }

  private nextTask() {
    if (this.scheduledTasks.length > 0) {
      return this.taskGraph.tasks[this.scheduledTasks.pop()];
    } else {
      return null;
    }
  }

  private async complete(
    taskId: string,
    status: 'success' | 'failure' | 'skipped' | 'cache'
  ) {
    if (this.completedTasks[taskId] === undefined) {
      this.completedTasks[taskId] = status;
      const everyTaskDependingOnTaskId = this.reverseTaskDeps[taskId];
      for (let t of everyTaskDependingOnTaskId) {
        if (this.allDepsAreSuccessful(t)) {
          await this.scheduleTask(t);
        } else if (this.allDepsAreCompleted(t)) {
          await this.complete(t, 'skipped');
        }
      }
    }
    // release blocked threads
    this.waitingForTasks.forEach((f) => f(null));
    this.waitingForTasks.length = 0;
  }

  private async scheduleTask(taskId: string) {
    if (!this.inProgressTasks[taskId]) {
      this.inProgressTasks[taskId] = true;
      const task = this.taskGraph.tasks[taskId];
      const { value, details } = await this.hashTask(task);
      task.hash = value;
      task.hashDetails = details;

      this.scheduledTasks.push(taskId);
      // TODO vsavkin: remove the if statement after Nx 14 is out
      if (this.options.lifeCycle.scheduleTask) {
        this.options.lifeCycle.scheduleTask(task);
      }
    }
  }

  private allDepsAreSuccessful(taskId: string) {
    for (let t of this.taskGraph.dependencies[taskId]) {
      if (
        this.completedTasks[t] !== 'success' &&
        this.completedTasks[t] !== 'cache'
      )
        return false;
    }
    return true;
  }

  private allDepsAreCompleted(taskId: string) {
    for (let t of this.taskGraph.dependencies[taskId]) {
      if (this.completedTasks[t] === undefined) return false;
    }
    return true;
  }

  private async hashTask(task: Task) {
    const hasher = this.customHasher(task);
    if (hasher) {
      return hasher(task, this.taskGraph, this.hasher);
    } else {
      return this.hasher.hashTaskWithDepsAndContext(task);
    }
  }

  private async runTasks() {
    const that = this;

    async function takeFromQueue() {
      // completed all the tasks
      if (
        Object.keys(that.completedTasks).length ===
        Object.keys(that.taskGraph.tasks).length
      ) {
        return null;
      }

      const task = that.nextTask();
      if (!task) {
        // block until some other task completes, then try again
        return new Promise((res) => that.waitingForTasks.push(res)).then(
          takeFromQueue
        );
      }

      const doNotSkipCache =
        that.options.skipNxCache === false ||
        that.options.skipNxCache === undefined;

      if (doNotSkipCache && that.isCacheableTask(task)) {
        const cachedResult = await that.cache.get(task);
        if (cachedResult && cachedResult.code === 0) {
          await that.applyCachedResult({ task, cachedResult });
          return takeFromQueue();
        }
      }
      await that.runTaskInForkedProcess(task);
      return takeFromQueue();
    }

    const wait = [];
    // // initial seeding
    const maxParallel = this.options.parallel
      ? this.options.maxParallel || 3
      : 1;
    for (let i = 0; i < maxParallel; ++i) {
      wait.push(takeFromQueue());
    }

    await Promise.all(wait);

    return Object.keys(this.completedTasks).map((taskId) => {
      if (this.completedTasks[taskId] === 'cache') {
        return {
          task: this.taskGraph.tasks[taskId],
          type: AffectedEventType.TaskCacheRead,
          success: true,
        };
      } else if (this.completedTasks[taskId] === 'success') {
        return {
          task: this.taskGraph.tasks[taskId],
          type: AffectedEventType.TaskComplete,
          success: true,
        };
      } else if (this.completedTasks[taskId] === 'failure') {
        return {
          task: this.taskGraph.tasks[taskId],
          type: AffectedEventType.TaskComplete,
          success: false,
        };
      } else if (this.completedTasks[taskId] === 'skipped') {
        return {
          task: this.taskGraph.tasks[taskId],
          type: AffectedEventType.TaskDependencyFailed,
          success: false,
        };
      }
    });
  }

  private async runTaskInForkedProcess(task: Task) {
    try {
      this.storeStartTime(task);
      this.options.lifeCycle.startTask(task);
      const taskOutputs = getOutputs(this.projectGraph.nodes, task);
      const outputPath = this.cache.temporaryOutputPath(task);
      const forwardOutput = this.shouldForwardOutput(task);
      this.cache.removeRecordedOutputsHashes(taskOutputs);
      const pipeOutput = this.pipeOutputCapture(task);
      const { code, terminalOutput } = pipeOutput
        ? await this.forkedProcessTaskRunner.forkProcessPipeOutputCapture(
            task,
            {
              forwardOutput,
            }
          )
        : await this.forkedProcessTaskRunner.forkProcessDirectOutputCapture(
            task,
            {
              temporaryOutputPath: outputPath,
              forwardOutput,
            }
          );

      this.storeEndTime(task);
      if (this.shouldCacheTaskResult(task, code)) {
        await this.cache.put(task, terminalOutput, taskOutputs, code);
        this.cache.recordOutputsHash(taskOutputs, task.hash);
        if (pipeOutput) {
          writeFileSync(outputPath, terminalOutput);
        }
      }
      this.options.lifeCycle.endTask(task, code);
      await this.complete(task.id, code === 0 ? 'success' : 'failure');
    } catch (e) {
      await this.complete(task.id, 'failure');
    }
  }

  private async applyCachedResult(t: TaskWithCachedResult) {
    this.storeStartTime(t.task);
    this.options.lifeCycle.startTask(t.task);
    const outputs = getOutputs(this.projectGraph.nodes, t.task);
    const shouldCopyOutputsFromCache = this.cache.shouldCopyOutputsFromCache(
      t,
      outputs
    );
    if (shouldCopyOutputsFromCache) {
      this.cache.copyFilesFromCache(t.task.hash, t.cachedResult, outputs);
    }
    if (
      (!this.initiatingProject ||
        this.initiatingProject === t.task.target.project) &&
      !this.hideCachedOutput
    ) {
      const args = getCommandArgsForTask(t.task);
      output.logCommand(
        `nx ${args.join(' ')}`,
        shouldCopyOutputsFromCache
          ? TaskCacheStatus.RetrievedFromCache
          : TaskCacheStatus.MatchedExistingOutput
      );
      process.stdout.write(t.cachedResult.terminalOutput);
    }
    this.options.lifeCycle.endTask(t.task, t.cachedResult.code);
    this.storeEndTime(t.task);
    await this.complete(t.task.id, 'cache');
  }

  private storeStartTime(t: Task) {
    this.timings[`${t.target.project}:${t.target.target}`] = {
      start: new Date().getTime(),
      end: undefined,
    };
  }

  private storeEndTime(t: Task) {
    this.timings[
      `${t.target.project}:${t.target.target}`
    ].end = new Date().getTime();
  }

  private customHasher(task: Task) {
    try {
      const f = getExecutorForTask(task, this.workspace).hasherFactory;
      return f ? f() : null;
    } catch (e) {
      console.error(e);
      throw new Error(`Unable to load hasher for task "${task.id}"`);
    }
  }

  private pipeOutputCapture(task: Task) {
    try {
      return (
        getExecutorForTask(task, this.workspace).schema.outputCapture === 'pipe'
      );
    } catch (e) {
      return false;
    }
  }

  private shouldCacheTaskResult(task: Task, code: number) {
    // TODO: vsavkin make caching failures the default in Nx 12.1
    return (
      this.isCacheableTask(task) &&
      (process.env.NX_CACHE_FAILURES == 'true' ? true : code === 0)
    );
  }

  private shouldForwardOutput(task: Task) {
    if (!this.isCacheableTask(task)) return true;
    if (!this.options.parallel) return true;
    if (task.target.project === this.initiatingProject) return true;
    return false;
  }

  private isCacheableTask(task: Task) {
    const cacheable =
      this.options.cacheableOperations || this.options.cacheableTargets;
    return (
      cacheable &&
      cacheable.indexOf(task.target.target) > -1 &&
      !this.longRunningTask(task)
    );
  }

  private longRunningTask(task: Task) {
    return !!task.overrides['watch'];
  }
}
