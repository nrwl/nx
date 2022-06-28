import { readFileSync } from 'fs';
import { ChildProcess } from 'child_process';
import { workspaceRoot } from '../utils/workspace-root';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { output } from '../utils/output';
import { getPrintableCommandArgsForTask } from './utils';
import { Batch } from './tasks-schedule';
import { stripIndents } from '../utils/strip-indents';
import { Task } from '../config/task-graph';
import { Worker } from 'jest-worker';
import { BatchResults } from './batch/batch-messages';
import type * as ExecutorWorker from '../../bin/run-executor-worker';
import { addCommandPrefixIfNeeded } from '../utils/add-command-prefix';
import { ProjectGraph } from '../config/project-graph';

// Worker threads slower for me??? 38s fork, 45s worker thread
const useWorkerThreads =
  process.env.NX_JEST_WORKER_TASK_RUNNER_USE_THREADS === 'true';

export class JestWorkerTaskRunner {
  workspaceRoot = workspaceRoot;
  cliPath = require.resolve(`../../bin/run-executor-worker.js`);

  private processes = new Set<ChildProcess>();

  private worker = (useWorkerThreads
    ? new Worker(this.cliPath, {
        numWorkers: this.options.parallel,
        enableWorkerThreads: true,
        exposedMethods: ['executeTask'],
      })
    : new Worker(this.cliPath, {
        numWorkers: this.options.parallel,
        exposedMethods: ['executeTask'],
        forkOptions: {
          env: {
            ...process.env,
            ...this.getNxEnvVariablesForForkedProcess(),
          },
          execArgv: ['--inspect-brk'],
        },
      })) as Worker & typeof ExecutorWorker;

  constructor(
    private readonly options: DefaultTasksRunnerOptions,
    private readonly projectGraph: ProjectGraph
  ) {
    this.setupOnProcessExitListener();
  }

  // TODO: vsavkin delegate terminal output printing
  public forkProcessForBatch({
    executorName,
    taskGraph,
  }: Batch): Promise<BatchResults> {
    throw new Error('Not implemented');
  }

  public async executeTask(
    task: Task,
    {
      streamOutput,
      temporaryOutputPath,
    }: {
      streamOutput: boolean;
      temporaryOutputPath: string;
    }
  ): Promise<{ code: number; terminalOutput: string }> {
    let code: number | undefined;
    let error: string | undefined;
    try {
      if (streamOutput) {
        output.logCommand(getPrintableCommandArgsForTask(task).join(' '));
        output.addNewline();
      }

      const result = await this.worker.executeTask(task, {
        workspaceRoot: this.workspaceRoot,
        outputPath: temporaryOutputPath,
        streamOutput,
        captureStderr: this.options.captureStderr,
        projectGraph: this.projectGraph,

        // Worker threads have trouble serializing these functions but forks don't?
        onStdout: useWorkerThreads
          ? undefined
          : (chunk) => {
              if (streamOutput) {
                process.stdout.write(
                  addCommandPrefixIfNeeded(task.target.project, chunk, 'utf-8')
                    .content
                );
              }
            },
        onStderr: useWorkerThreads
          ? undefined
          : (chunk) => {
              if (streamOutput) {
                process.stderr.write(
                  addCommandPrefixIfNeeded(task.target.project, chunk, 'utf-8')
                    .content
                );
              }
            },
      });

      code = result.statusCode;
      error = result.error;
    } catch (err) {
      console.dir({ err });
      code = 1;
      error = err.toString();
    }

    // TODO if (code === null) code = this.signalToCode(signal);
    // we didn't print any output as we were running the command
    // print all the collected output
    let terminalOutput = '';
    try {
      terminalOutput = this.readTerminalOutput(temporaryOutputPath);
      if (!streamOutput) {
        this.options.lifeCycle.printTaskTerminalOutput(
          task,
          code === 0 ? 'success' : 'failure',
          terminalOutput
        );
      }
    } catch (e) {
      console.log(stripIndents`
              Unable to print terminal output for Task "${task.id}".
              Task failed with Exit Code ${code}.

              Received error message:
              ${e.message}
            `);
    }
    return { code, terminalOutput: terminalOutput || error || '' };
  }

  private readTerminalOutput(outputPath: string) {
    return readFileSync(outputPath).toString();
  }

  private getNxEnvVariablesForForkedProcess() {
    const env: NodeJS.ProcessEnv = {
      FORCE_COLOR: 'true',
      NX_SKIP_NX_CACHE: this.options.skipNxCache ? 'true' : undefined,
    };

    return env;
  }

  // endregion Environment Variables

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
}
