import { Workspaces } from '@nrwl/tao/src/shared/workspace';
import { ChildProcess, fork } from 'child_process';
import * as dotenv from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import type { ProjectGraph } from '@nrwl/devkit';
import { appRootPath } from '../utilities/app-root';
import { output, TaskCacheStatus } from '../utilities/output';
import { Cache, TaskWithCachedResult } from './cache';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { AffectedEventType, Task } from './tasks-runner';
import { getOutputs, unparse } from './utils';
import { performance } from 'perf_hooks';
import { TaskGraph } from './task-graph-creator';
import { Hasher } from '../core/hasher/hasher';

export class TaskOrchestrator {
  workspaceRoot = appRootPath;
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

  private processes: ChildProcess[] = [];

  constructor(
    private readonly hasher: Hasher,
    private readonly initiatingProject: string | undefined,
    private readonly projectGraph: ProjectGraph,
    private readonly taskGraph: TaskGraph,
    private readonly options: DefaultTasksRunnerOptions,
    private readonly hideCachedOutput: boolean
  ) {
    this.setupOnProcessExitListener();
  }

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

      const cachedResult = await that.cache.get(task);
      if (cachedResult && cachedResult.code === 0 && doNotSkipCache) {
        that.applyCachedResult({ task, cachedResult });
        await that.complete(task.id, 'cache');
        return takeFromQueue();
      }

      that.storeStartTime(task);
      try {
        const code = that.pipeOutputCapture(task)
          ? await that.forkProcessPipeOutputCapture(task)
          : await that.forkProcessDirectOutputCapture(task);

        that.storeEndTime(task);
        await that.complete(task.id, code === 0 ? 'success' : 'failure');
        return takeFromQueue();
      } catch {
        await that.complete(task.id, 'failure');
        return takeFromQueue();
      }
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

  private applyCachedResult(t: TaskWithCachedResult) {
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
      const args = this.getCommandArgs(t.task);
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
  }

  private storeStartTime(t: Task) {
    this.timings[`${t.target.project}:${t.target.target}`] = {
      start: new Date().getTime(),
      end: undefined,
    };
  }

  private storeEndTime(t: Task) {
    this.timings[`${t.target.project}:${t.target.target}`].end =
      new Date().getTime();
  }

  private pipeOutputCapture(task: Task) {
    try {
      return this.readExecutor(task).schema.outputCapture === 'pipe';
    } catch (e) {
      return false;
    }
  }

  private customHasher(task: Task) {
    try {
      const f = this.readExecutor(task).hasherFactory;
      return f ? f() : null;
    } catch (e) {
      console.error(e);
      throw new Error(`Unable to load hasher for task "${task.id}"`);
    }
  }

  private readExecutor(task: Task) {
    const p = this.projectGraph.nodes[task.target.project];
    const b = p.data.targets[task.target.target].executor;
    const [nodeModule, executor] = b.split(':');

    const w = new Workspaces(this.workspaceRoot);
    return w.readExecutor(nodeModule, executor);
  }

  private forkProcessPipeOutputCapture(task: Task) {
    const taskOutputs = getOutputs(this.projectGraph.nodes, task);
    const outputPath = this.cache.temporaryOutputPath(task);
    return new Promise((res, rej) => {
      try {
        this.options.lifeCycle.startTask(task);
        const forwardOutput = this.shouldForwardOutput(outputPath, task);
        const env = this.envForForkedProcess(
          task,
          undefined,
          forwardOutput,
          process.env.FORCE_COLOR === undefined
            ? 'true'
            : process.env.FORCE_COLOR
        );
        const args = this.getCommandArgs(task);
        const commandLine = `nx ${args.join(' ')}`;

        if (forwardOutput) {
          output.logCommand(commandLine);
        }
        this.cache.removeRecordedOutputsHashes(taskOutputs);
        const p = fork(this.getCommand(), args, {
          stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
          env,
        });
        this.processes.push(p);
        let out = [];
        let outWithErr = [];
        p.stdout.on('data', (chunk) => {
          if (forwardOutput) {
            process.stdout.write(chunk);
          }
          out.push(chunk.toString());
          outWithErr.push(chunk.toString());
        });
        p.stderr.on('data', (chunk) => {
          if (forwardOutput) {
            process.stderr.write(chunk);
          }
          outWithErr.push(chunk.toString());
        });

        p.on('exit', (code, signal) => {
          if (code === null) code = this.signalToCode(signal);
          // we didn't print any output as we were running the command
          // print all the collected output|
          if (!forwardOutput) {
            output.logCommand(commandLine);
            process.stdout.write(outWithErr.join(''));
          }
          if (outputPath) {
            const terminalOutput = outWithErr.join('');
            writeFileSync(outputPath, terminalOutput);
            if (this.shouldCacheTask(outputPath, code)) {
              this.cache
                .put(task, terminalOutput, taskOutputs, code)
                .then(() => {
                  this.cache.recordOutputsHash(taskOutputs, task.hash);
                  this.options.lifeCycle.endTask(task, code);
                  res(code);
                })
                .catch((e) => {
                  rej(e);
                });
            } else {
              this.cache.recordOutputsHash(taskOutputs, task.hash);
              this.options.lifeCycle.endTask(task, code);
              res(code);
            }
          } else {
            this.cache.recordOutputsHash(taskOutputs, task.hash);
            this.options.lifeCycle.endTask(task, code);
            res(code);
          }
        });
      } catch (e) {
        console.error(e);
        rej(e);
      }
    });
  }

  private forkProcessDirectOutputCapture(task: Task) {
    const taskOutputs = getOutputs(this.projectGraph.nodes, task);
    const outputPath = this.cache.temporaryOutputPath(task);
    return new Promise((res, rej) => {
      try {
        this.options.lifeCycle.startTask(task);
        const forwardOutput = this.shouldForwardOutput(outputPath, task);
        const env = this.envForForkedProcess(
          task,
          outputPath,
          forwardOutput,
          undefined
        );
        const args = this.getCommandArgs(task);
        const commandLine = `nx ${args.join(' ')}`;

        if (forwardOutput) {
          output.logCommand(commandLine);
        }
        this.cache.removeRecordedOutputsHashes(taskOutputs);
        const p = fork(this.getCommand(), args, {
          stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
          env,
        });
        this.processes.push(p);
        p.on('exit', (code, signal) => {
          if (code === null) code = this.signalToCode(signal);
          // we didn't print any output as we were running the command
          // print all the collected output
          if (!forwardOutput) {
            output.logCommand(commandLine);
            const terminalOutput = this.readTerminalOutput(outputPath);
            if (terminalOutput) {
              process.stdout.write(terminalOutput);
            } else {
              console.error(
                `Nx could not find process's output. Run the command without --parallel.`
              );
            }
          }
          // we don't have to worry about this statement. code === 0 guarantees the file is there.
          if (this.shouldCacheTask(outputPath, code)) {
            this.cache
              .put(task, this.readTerminalOutput(outputPath), taskOutputs, code)
              .then(() => {
                this.cache.recordOutputsHash(taskOutputs, task.hash);
                this.options.lifeCycle.endTask(task, code);
                res(code);
              })
              .catch((e) => {
                rej(e);
              });
          } else {
            this.cache.recordOutputsHash(taskOutputs, task.hash);
            this.options.lifeCycle.endTask(task, code);
            res(code);
          }
        });
      } catch (e) {
        console.error(e);
        rej(e);
      }
    });
  }

  private readTerminalOutput(outputPath: string) {
    try {
      return readFileSync(outputPath).toString();
    } catch (e) {
      return null;
    }
  }

  private shouldCacheTask(outputPath: string | null, code: number) {
    // TODO: vsavkin make caching failures the default in Nx 12.1
    if (process.env.NX_CACHE_FAILURES == 'true') {
      return outputPath;
    } else {
      return outputPath && code === 0;
    }
  }

  private envForForkedProcess(
    task: Task,
    outputPath: string,
    forwardOutput: boolean,
    forceColor: string
  ) {
    const envsFromFiles = {
      ...parseEnv('.env'),
      ...parseEnv('.local.env'),
      ...parseEnv('.env.local'),
      ...parseEnv(`${task.projectRoot}/.env`),
      ...parseEnv(`${task.projectRoot}/.local.env`),
      ...parseEnv(`${task.projectRoot}/.env.local`),
    };

    const env: NodeJS.ProcessEnv = {
      ...envsFromFiles,
      FORCE_COLOR: forceColor,
      ...process.env,
      NX_TASK_HASH: task.hash,
      NX_INVOKED_BY_RUNNER: 'true',
      NX_WORKSPACE_ROOT: this.workspaceRoot,
    };

    if (outputPath) {
      env.NX_TERMINAL_OUTPUT_PATH = outputPath;
      if (this.options.captureStderr) {
        env.NX_TERMINAL_CAPTURE_STDERR = 'true';
      }
      // TODO: remove this once we have a reasonable way to configure it
      if (task.target.target === 'test') {
        env.NX_TERMINAL_CAPTURE_STDERR = 'true';
      }
      if (forwardOutput) {
        env.NX_FORWARD_OUTPUT = 'true';
      }
    }
    return env;
  }

  private shouldForwardOutput(outputPath: string | undefined, task: Task) {
    if (!outputPath) return true;
    if (!this.options.parallel) return true;
    if (task.target.project === this.initiatingProject) return true;
    return false;
  }

  private getCommand() {
    const cli = require.resolve(`@nrwl/cli/lib/run-cli.js`, {
      paths: [this.workspaceRoot],
    });
    return `${cli}`;
  }

  private getCommandArgs(task: Task) {
    const args: string[] = unparse(task.overrides || {});

    const config = task.target.configuration
      ? `:${task.target.configuration}`
      : '';

    return [
      'run',
      `${task.target.project}:${task.target.target}${config}`,
      ...args,
    ];
  }

  private setupOnProcessExitListener() {
    process.on('SIGINT', () => {
      this.processes.forEach((p) => {
        p.kill('SIGTERM');
      });
      // we exit here because we don't need to write anything to cache.
      process.exit();
    });
    process.on('SIGTERM', () => {
      this.processes.forEach((p) => {
        p.kill('SIGTERM');
      });
      // no exit here because we expect child processes to terminate which
      // will store results to the cache and will terminate this process
    });
    process.on('SIGHUP', () => {
      this.processes.forEach((p) => {
        p.kill('SIGTERM');
      });
      // no exit here because we expect child processes to terminate which
      // will store results to the cache and will terminate this process
    });
  }

  private signalToCode(signal: string) {
    if (signal === 'SIGHUP') return 128 + 1;
    if (signal === 'SIGINT') return 128 + 2;
    if (signal === 'SIGTERM') return 128 + 15;
    return 128;
  }
}

function parseEnv(path: string) {
  try {
    const envContents = readFileSync(path);
    return dotenv.parse(envContents);
  } catch (e) {}
}
