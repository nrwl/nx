import { Cache, TaskWithCachedResult } from './cache';
import { cliCommand } from '../core/file-utils';
import { ProjectGraph } from '../core/project-graph';
import { AffectedEventType, Task } from './tasks-runner';
import { getOutputs } from './utils';
import { fork } from 'child_process';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { output } from '../utils/output';
import * as path from 'path';
import * as fs from 'fs';
import { appRootPath } from '../utils/app-root';
import * as dotenv from 'dotenv';

export class TaskOrchestrator {
  workspaceRoot = appRootPath;
  cache = new Cache(this.options);
  cli = cliCommand();

  constructor(
    private readonly initiatingProject: string | undefined,
    private readonly projectGraph: ProjectGraph,
    private readonly options: DefaultTasksRunnerOptions
  ) {}

  async run(tasksInStage: Task[]) {
    const { cached, rest } = await this.splitTasksIntoCachedAndNotCached(
      tasksInStage
    );

    const r1 = await this.applyCachedResults(cached);
    const r2 = await this.runRest(rest);
    this.cache.removeOldCacheRecords();
    return [...r1, ...r2];
  }

  private async runRest(tasks: Task[]) {
    const left = [...tasks];
    const res = [];

    const that = this;

    function takeFromQueue() {
      if (left.length > 0) {
        const task = left.pop();
        const p = that.pipeOutputCapture(task)
          ? that.forkProcessPipeOutputCapture(task)
          : that.forkProcessDirectOutputCapture(task);
        return p
          .then((code) => {
            res.push({
              task,
              success: code === 0,
              type: AffectedEventType.TaskComplete,
            });
          })
          .then(takeFromQueue)
          .catch(takeFromQueue);
      } else {
        return Promise.resolve(null);
      }
    }

    const wait = [];
    // initial seeding
    const maxParallel = this.options.parallel
      ? this.options.maxParallel || 3
      : 1;
    for (let i = 0; i < maxParallel; ++i) {
      wait.push(takeFromQueue());
    }
    await Promise.all(wait);
    return res;
  }

  private async splitTasksIntoCachedAndNotCached(
    tasks: Task[]
  ): Promise<{ cached: TaskWithCachedResult[]; rest: Task[] }> {
    if (this.options.skipNxCache || this.options.skipNxCache === undefined) {
      return { cached: [], rest: tasks };
    } else {
      const cached: TaskWithCachedResult[] = [];
      const rest: Task[] = [];
      await Promise.all(
        tasks.map(async (task) => {
          const cachedResult = await this.cache.get(task);
          if (cachedResult) {
            cached.push({ task, cachedResult });
          } else {
            rest.push(task);
          }
        })
      );
      return { cached, rest };
    }
  }

  private applyCachedResults(tasks: TaskWithCachedResult[]) {
    tasks.forEach((t) => {
      this.options.lifeCycle.startTask(t.task);

      if (
        !this.initiatingProject ||
        this.initiatingProject === t.task.target.project
      ) {
        const args = this.getCommandArgs(t.task);
        output.logCommand(`${this.cli} ${args.join(' ')}`);
        output.note({ title: `Cached Output:` });
        process.stdout.write(t.cachedResult.terminalOutput);
      }

      const outputs = getOutputs(this.projectGraph.nodes, t.task);
      this.cache.copyFilesFromCache(t.cachedResult, outputs);

      this.options.lifeCycle.endTask(t.task, 0);
    });

    return tasks.reduce((m, c) => {
      m.push({
        task: c.task,
        type: AffectedEventType.TaskCacheRead,
        success: true,
      });
      return m;
    }, []);
  }

  private pipeOutputCapture(task: Task) {
    try {
      const p = this.projectGraph.nodes[task.target.project];
      const b = p.data.architect[task.target.target].builder;
      // this is temporary. we simply want to assess if pipeOutputCapture
      // works well before making it configurable
      return (
        this.cache.temporaryOutputPath(task) &&
        (b === '@nrwl/workspace:run-commands' ||
          b === '@nrwl/cypress:cypress' ||
          b === '@nrwl/gatsby:build')
      );
    } catch (e) {
      return false;
    }
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
        const commandLine = `${this.cli} ${args.join(' ')}`;

        if (forwardOutput) {
          output.logCommand(commandLine);
        }
        const p = fork(this.getCommand(), args, {
          stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
          env,
        });

        let out = [];
        let outWithErr = [];
        p.stdout.on('data', (chunk) => {
          process.stdout.write(chunk);
          out.push(chunk.toString());
          outWithErr.push(chunk.toString());
        });
        p.stderr.on('data', (chunk) => {
          process.stderr.write(chunk);
          outWithErr.push(chunk.toString());
        });
        process.addListener('SIGINT', () => {
          p.kill('SIGINT');
        });
        p.on('exit', (code) => {
          // we didn't print any output as we were running the command
          // print all the collected output|
          if (!forwardOutput) {
            output.logCommand(commandLine);
            process.stdout.write(outWithErr.join(''));
          }
          if (outputPath && code === 0) {
            fs.writeFileSync(outputPath, outWithErr.join(''));
            this.cache
              .put(task, outputPath, taskOutputs)
              .then(() => {
                this.options.lifeCycle.endTask(task, code);
                res(code);
              })
              .catch((e) => {
                rej(e);
              });
          } else {
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
        const commandLine = `${this.cli} ${args.join(' ')}`;

        if (forwardOutput) {
          output.logCommand(commandLine);
        }
        const p = fork(this.getCommand(), args, {
          stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
          env,
        });
        p.on('exit', (code) => {
          // we didn't print any output as we were running the command
          // print all the collected output|
          if (!forwardOutput) {
            output.logCommand(commandLine);
            try {
              process.stdout.write(fs.readFileSync(outputPath));
            } catch (e) {
              console.error(
                `Nx could not find process's output. Run the command without --parallel.`
              );
            }
          }
          // we don't have to worry about this statement. code === 0 guarantees the file is there.
          if (outputPath && code === 0) {
            this.cache
              .put(task, outputPath, taskOutputs)
              .then(() => {
                this.options.lifeCycle.endTask(task, code);
                res(code);
              })
              .catch((e) => {
                rej(e);
              });
          } else {
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

  private envForForkedProcess(
    task: Task,
    outputPath: string,
    forwardOutput: boolean,
    forceColor: string
  ) {
    const envsFromFiles = {
      ...parseEnv('.env'),
      ...parseEnv('.local.env'),
      ...parseEnv(`${task.projectRoot}/.env`),
      ...parseEnv(`${task.projectRoot}/.local.env`),
    };
    const env = { ...envsFromFiles, FORCE_COLOR: forceColor, ...process.env };
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
    return path.join(
      this.workspaceRoot,
      'node_modules',
      '@nrwl',
      'cli',
      'lib',
      'run-cli.js'
    );
  }

  private getCommandArgs(task: Task) {
    const args = Object.entries(task.overrides || {}).map(([prop, value]) =>
      typeof value === 'boolean'
        ? value
          ? `--${prop}`
          : `--no-${prop}`
        : `--${prop}=${value}`
    );

    const config = task.target.configuration
      ? `:${task.target.configuration}`
      : '';

    return [
      'run',
      `${task.target.project}:${task.target.target}${config}`,
      ...args,
    ];
  }
}

function parseEnv(path: string) {
  try {
    const envContents = fs.readFileSync(path);
    return dotenv.parse(envContents);
  } catch (e) {}
}
