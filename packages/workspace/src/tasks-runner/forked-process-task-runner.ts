import { readFileSync, writeFileSync } from 'fs';
import * as dotenv from 'dotenv';
import { ChildProcess, fork } from 'child_process';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { Task } from './tasks-runner';
import { output, TaskCacheStatus } from '../utilities/output';
import { getCliPath, getCommandArgsForTask } from './utils';
import { Batch } from './tasks-schedule';
import { join } from 'path';
import {
  BatchMessage,
  BatchMessageType,
  BatchResults,
} from './batch/batch-messages';

const workerPath = join(__dirname, './batch/run-batch.js');

export class ForkedProcessTaskRunner {
  workspaceRoot = appRootPath;
  cliPath = getCliPath(this.workspaceRoot);

  private processes = new Set<ChildProcess>();

  constructor(private readonly options: DefaultTasksRunnerOptions) {
    this.setupOnProcessExitListener();
  }

  // TODO: vsavkin delegate terminal output printing
  public forkProcessForBatch({ executorName, taskGraph }: Batch) {
    return new Promise<BatchResults>((res, rej) => {
      try {
        const count = Object.keys(taskGraph.tasks).length;
        if (count > 1) {
          output.logSingleLine(
            `Running ${output.bold(count)} ${output.bold(
              'tasks'
            )} with ${output.bold(executorName)}`
          );
        } else {
          const args = getCommandArgsForTask(Object.values(taskGraph.tasks)[0]);
          const commandLine = `nx ${args.join(' ')}`;

          output.logCommand(commandLine);
        }

        const p = fork(workerPath, {
          stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
          env: this.getEnvVariablesForProcess(),
        });
        this.processes.add(p);

        p.once('exit', (code, signal) => {
          if (code === null) code = this.signalToCode(signal);
          if (code !== 0) {
            const results: BatchResults = {};
            for (const rootTaskId of taskGraph.roots) {
              results[rootTaskId] = {
                success: false,
              };
            }
            rej(
              new Error(
                `"${executorName}" exited unexpectedly with code: ${code}`
              )
            );
          }
        });

        p.on('message', (message: BatchMessage) => {
          switch (message.type) {
            case BatchMessageType.Complete: {
              res(message.results);
            }
          }
        });

        // Start the tasks
        p.send({
          type: BatchMessageType.Tasks,
          taskGraph,
          executorName,
        });
      } catch (e) {
        rej(e);
      }
    });
  }

  public forkProcessPipeOutputCapture(
    task: Task,
    {
      forwardOutput,
      temporaryOutputPath,
    }: { forwardOutput: boolean; temporaryOutputPath: string }
  ) {
    return new Promise<{ code: number; terminalOutput: string }>((res, rej) => {
      try {
        const args = getCommandArgsForTask(task);
        const commandLine = `nx ${args.join(' ')}`;

        if (forwardOutput) {
          output.logCommand(commandLine);
        }
        const p = fork(this.cliPath, args, {
          stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
          env: this.getEnvVariablesForTask(
            task,
            process.env.FORCE_COLOR === undefined
              ? 'true'
              : process.env.FORCE_COLOR,
            undefined,
            forwardOutput
          ),
        });
        this.processes.add(p);
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
          const terminalOutput = outWithErr.join('');

          if (!forwardOutput) {
            this.options.lifeCycle.printTaskTerminalOutput(
              task,
              TaskCacheStatus.NoCache,
              terminalOutput
            );
          }
          this.writeTerminalOutput(temporaryOutputPath, terminalOutput);
          res({ code, terminalOutput });
        });
      } catch (e) {
        console.error(e);
        rej(e);
      }
    });
  }

  public forkProcessDirectOutputCapture(
    task: Task,
    {
      forwardOutput,
      temporaryOutputPath,
    }: { forwardOutput: boolean; temporaryOutputPath: string }
  ) {
    return new Promise<{ code: number; terminalOutput: string }>((res, rej) => {
      try {
        const args = getCommandArgsForTask(task);
        const commandLine = `nx ${args.join(' ')}`;

        if (forwardOutput) {
          output.logCommand(commandLine);
        }
        const p = fork(this.cliPath, args, {
          stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
          env: this.getEnvVariablesForTask(
            task,
            undefined,
            temporaryOutputPath,
            forwardOutput
          ),
        });
        this.processes.add(p);
        p.on('exit', (code, signal) => {
          if (code === null) code = this.signalToCode(signal);
          // we didn't print any output as we were running the command
          // print all the collected output
          const terminalOutput = this.readTerminalOutput(temporaryOutputPath);
          if (!forwardOutput) {
            this.options.lifeCycle.printTaskTerminalOutput(
              task,
              TaskCacheStatus.NoCache,
              terminalOutput
            );
          }
          res({
            code,
            terminalOutput,
          });
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

  private writeTerminalOutput(outputPath: string, content: string) {
    try {
      writeFileSync(outputPath, content);
    } catch (e) {}
  }

  // region Environment Variables
  private getEnvVariablesForProcess() {
    return {
      // Start With Dotenv Variables
      ...this.getDotenvVariablesForForkedProcess(),
      // User Process Env Variables override Dotenv Variables
      ...process.env,
      // Nx Env Variables overrides everything
      ...this.getNxEnvVariablesForForkedProcess(
        process.env.FORCE_COLOR === undefined ? 'true' : process.env.FORCE_COLOR
      ),
    };
  }

  private getEnvVariablesForTask(
    task: Task,
    forceColor: string,
    outputPath: string,
    forwardOutput: boolean
  ) {
    return {
      // Start With Dotenv Variables
      ...this.getDotenvVariablesForTask(task),
      // User Process Env Variables override Dotenv Variables
      ...process.env,
      // Nx Env Variables overrides everything
      ...this.getNxEnvVariablesForTask(
        task,
        forceColor,
        outputPath,
        forwardOutput
      ),
    };
  }

  private getNxEnvVariablesForForkedProcess(
    forceColor: string,
    outputPath?: string,
    forwardOutput?: boolean
  ) {
    const env: NodeJS.ProcessEnv = {
      FORCE_COLOR: forceColor,
      NX_INVOKED_BY_RUNNER: 'true',
      NX_WORKSPACE_ROOT: this.workspaceRoot,
    };

    if (outputPath) {
      env.NX_TERMINAL_OUTPUT_PATH = outputPath;
      if (this.options.captureStderr) {
        env.NX_TERMINAL_CAPTURE_STDERR = 'true';
      }
      if (forwardOutput) {
        env.NX_FORWARD_OUTPUT = 'true';
      }
    }
    return env;
  }

  private getNxEnvVariablesForTask(
    task: Task,
    forceColor: string,
    outputPath: string,
    forwardOutput: boolean
  ) {
    const env: NodeJS.ProcessEnv = {
      NX_TASK_TARGET_PROJECT: task.target.project,
      NX_TASK_HASH: task.hash,
    };

    // TODO: remove this once we have a reasonable way to configure it
    if (task.target.target === 'test') {
      env.NX_TERMINAL_CAPTURE_STDERR = 'true';
    }

    return {
      ...this.getNxEnvVariablesForForkedProcess(
        forceColor,
        outputPath,
        forwardOutput
      ),
      ...env,
    };
  }

  private getDotenvVariablesForForkedProcess() {
    return {
      ...parseEnv('.env'),
      ...parseEnv('.local.env'),
      ...parseEnv('.env.local'),
    };
  }

  private getDotenvVariablesForTask(task: Task) {
    return {
      ...this.getDotenvVariablesForForkedProcess(),
      ...parseEnv(`.${task.target.target}.env`),
      ...parseEnv(`.env.${task.target.target}`),
      ...parseEnv(`${task.projectRoot}/.env`),
      ...parseEnv(`${task.projectRoot}/.local.env`),
      ...parseEnv(`${task.projectRoot}/.env.local`),
      ...parseEnv(`${task.projectRoot}/.${task.target.target}.env`),
      ...parseEnv(`${task.projectRoot}/.env.${task.target.target}`),
    };
  }

  // endregion Environment Variables

  private signalToCode(signal: string) {
    if (signal === 'SIGHUP') return 128 + 1;
    if (signal === 'SIGINT') return 128 + 2;
    if (signal === 'SIGTERM') return 128 + 15;
    return 128;
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
}

function parseEnv(path: string) {
  try {
    const envContents = readFileSync(path);
    return dotenv.parse(envContents);
  } catch (e) {}
}
