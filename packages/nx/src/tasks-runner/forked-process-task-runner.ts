import { readFileSync, writeFileSync } from 'fs';
import * as dotenv from 'dotenv';
import { ChildProcess, fork, Serializable } from 'child_process';
import * as chalk from 'chalk';
import * as logTransformer from 'strong-log-transformer';
import { workspaceRoot } from '../utils/workspace-root';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { output } from '../utils/output';
import { getCliPath, getPrintableCommandArgsForTask } from './utils';
import { Batch } from './tasks-schedule';
import { join } from 'path';
import {
  BatchMessage,
  BatchMessageType,
  BatchResults,
} from './batch/batch-messages';
import { stripIndents } from '../utils/strip-indents';
import { Task, TaskGraph } from '../config/task-graph';
import { Transform } from 'stream';

const workerPath = join(__dirname, './batch/run-batch.js');

export class ForkedProcessTaskRunner {
  workspaceRoot = workspaceRoot;
  cliPath = getCliPath();

  private readonly verbose = process.env.NX_VERBOSE_LOGGING === 'true';
  private processes = new Set<ChildProcess>();

  constructor(private readonly options: DefaultTasksRunnerOptions) {
    this.setupProcessEventListeners();
  }

  // TODO: vsavkin delegate terminal output printing
  public forkProcessForBatch(
    { executorName, taskGraph: batchTaskGraph }: Batch,
    fullTaskGraph: TaskGraph
  ) {
    return new Promise<BatchResults>((res, rej) => {
      try {
        const count = Object.keys(batchTaskGraph.tasks).length;
        if (count > 1) {
          output.logSingleLine(
            `Running ${output.bold(count)} ${output.bold(
              'tasks'
            )} with ${output.bold(executorName)}`
          );
        } else {
          const args = getPrintableCommandArgsForTask(
            Object.values(batchTaskGraph.tasks)[0]
          );
          output.logCommand(args.join(' '));
          output.addNewline();
        }

        const p = fork(workerPath, {
          stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
          env: this.getEnvVariablesForProcess(),
        });
        this.processes.add(p);

        p.once('exit', (code, signal) => {
          this.processes.delete(p);
          if (code === null) code = this.signalToCode(signal);
          if (code !== 0) {
            const results: BatchResults = {};
            for (const rootTaskId of batchTaskGraph.roots) {
              results[rootTaskId] = {
                success: false,
                terminalOutput: '',
              };
            }
            rej(
              new Error(
                `"${executorName}" exited unexpectedly with code: ${code}`
              )
            );
          }
        });

        const printedTasks = new Set<string>();
        p.on('message', (message: BatchMessage) => {
          switch (message.type) {
            case BatchMessageType.CompleteTask: {
              this.options.lifeCycle.printTaskTerminalOutput(
                batchTaskGraph.tasks[message.task],
                message.result.success ? 'success' : 'failure',
                message.result.terminalOutput
              );
              printedTasks.add(message.task);

              break;
            }
            case BatchMessageType.CompleteBatchExecution: {
              Object.entries(message.results).forEach(([taskName, result]) => {
                if (!printedTasks.has(taskName)) {
                  this.options.lifeCycle.printTaskTerminalOutput(
                    batchTaskGraph.tasks[taskName],
                    result.success ? 'success' : 'failure',
                    result.terminalOutput
                  );
                }
              });

              res(message.results);
              break;
            }
            case BatchMessageType.RunTasks: {
              break;
            }
            default: {
              // Re-emit any non-batch messages from the task process
              if (process.send) {
                process.send(message);
              }
            }
          }
        });

        // Start the tasks
        p.send({
          type: BatchMessageType.RunTasks,
          executorName,
          batchTaskGraph,
          fullTaskGraph,
        });
      } catch (e) {
        rej(e);
      }
    });
  }

  public forkProcessPipeOutputCapture(
    task: Task,
    {
      streamOutput,
      temporaryOutputPath,
      taskGraph,
    }: {
      streamOutput: boolean;
      temporaryOutputPath: string;
      taskGraph: TaskGraph;
    }
  ) {
    return new Promise<{ code: number; terminalOutput: string }>((res, rej) => {
      try {
        const args = getPrintableCommandArgsForTask(task);
        if (streamOutput) {
          output.logCommand(args.join(' '));
          output.addNewline();
        }

        const p = fork(this.cliPath, {
          stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
          env: this.getEnvVariablesForTask(
            task,
            process.env.FORCE_COLOR === undefined
              ? 'true'
              : process.env.FORCE_COLOR,
            null,
            null
          ),
        });
        this.processes.add(p);

        // Re-emit any messages from the task process
        p.on('message', (message) => {
          if (process.send) {
            process.send(message);
          }
        });

        // Send message to run the executor
        p.send({
          targetDescription: task.target,
          overrides: task.overrides,
          taskGraph,
          isVerbose: this.verbose,
        });

        if (streamOutput) {
          if (process.env.NX_PREFIX_OUTPUT === 'true') {
            const color = getColor(task.target.project);
            const prefixText = `${task.target.project}:`;

            p.stdout
              .pipe(
                logClearLineToPrefixTransformer(color.bold(prefixText) + ' ')
              )
              .pipe(logTransformer({ tag: color.bold(prefixText) }))
              .pipe(process.stdout);
            p.stderr
              .pipe(logClearLineToPrefixTransformer(color(prefixText) + ' '))
              .pipe(logTransformer({ tag: color(prefixText) }))
              .pipe(process.stderr);
          } else {
            p.stdout.pipe(logTransformer()).pipe(process.stdout);
            p.stderr.pipe(logTransformer()).pipe(process.stderr);
          }
        }

        let outWithErr = [];
        p.stdout.on('data', (chunk) => {
          outWithErr.push(chunk.toString());
        });
        p.stderr.on('data', (chunk) => {
          outWithErr.push(chunk.toString());
        });

        p.on('exit', (code, signal) => {
          this.processes.delete(p);
          if (code === null) code = this.signalToCode(signal);
          // we didn't print any output as we were running the command
          // print all the collected output|
          const terminalOutput = outWithErr.join('');

          if (!streamOutput) {
            this.options.lifeCycle.printTaskTerminalOutput(
              task,
              code === 0 ? 'success' : 'failure',
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
      streamOutput,
      temporaryOutputPath,
      taskGraph,
    }: {
      streamOutput: boolean;
      temporaryOutputPath: string;
      taskGraph: TaskGraph;
    }
  ) {
    return new Promise<{ code: number; terminalOutput: string }>((res, rej) => {
      try {
        const args = getPrintableCommandArgsForTask(task);
        if (streamOutput) {
          output.logCommand(args.join(' '));
          output.addNewline();
        }
        const p = fork(this.cliPath, {
          stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
          env: this.getEnvVariablesForTask(
            task,
            undefined,
            temporaryOutputPath,
            streamOutput
          ),
        });
        this.processes.add(p);

        // Re-emit any messages from the task process
        p.on('message', (message) => {
          if (process.send) {
            process.send(message);
          }
        });

        // Send message to run the executor
        p.send({
          targetDescription: task.target,
          overrides: task.overrides,
          taskGraph,
          isVerbose: this.verbose,
        });

        p.on('exit', (code, signal) => {
          if (code === null) code = this.signalToCode(signal);
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
              Task failed with Exit Code ${code} and Signal "${signal}".

              Received error message:
              ${e.message}
            `);
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
    return readFileSync(outputPath).toString();
  }

  private writeTerminalOutput(outputPath: string, content: string) {
    writeFileSync(outputPath, content);
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
    streamOutput: boolean
  ) {
    const res = {
      // Start With Dotenv Variables
      ...this.getDotenvVariablesForTask(task),
      // User Process Env Variables override Dotenv Variables
      ...process.env,
      // Nx Env Variables overrides everything
      ...this.getNxEnvVariablesForTask(
        task,
        forceColor,
        outputPath,
        streamOutput
      ),
    };

    // we have to delete it because if we invoke Nx from within Nx, we need to reset those values
    if (!outputPath) {
      delete res.NX_TERMINAL_OUTPUT_PATH;
      delete res.NX_STREAM_OUTPUT;
      delete res.NX_PREFIX_OUTPUT;
    }
    delete res.NX_BASE;
    delete res.NX_HEAD;
    delete res.NX_SET_CLI;
    return res;
  }

  private getNxEnvVariablesForForkedProcess(
    forceColor: string,
    outputPath?: string,
    streamOutput?: boolean
  ) {
    const env: NodeJS.ProcessEnv = {
      FORCE_COLOR: forceColor,
      NX_WORKSPACE_ROOT: this.workspaceRoot,
      NX_SKIP_NX_CACHE: this.options.skipNxCache ? 'true' : undefined,
    };

    if (outputPath) {
      env.NX_TERMINAL_OUTPUT_PATH = outputPath;
      if (this.options.captureStderr) {
        env.NX_TERMINAL_CAPTURE_STDERR = 'true';
      }
      if (streamOutput) {
        env.NX_STREAM_OUTPUT = 'true';
      }
    }
    return env;
  }

  private getNxEnvVariablesForTask(
    task: Task,
    forceColor: string,
    outputPath: string,
    streamOutput: boolean
  ) {
    const env: NodeJS.ProcessEnv = {
      NX_TASK_TARGET_PROJECT: task.target.project,
      NX_TASK_TARGET_TARGET: task.target.target,
      NX_TASK_TARGET_CONFIGURATION: task.target.configuration ?? undefined,
      NX_TASK_HASH: task.hash,
      // used when Nx is invoked via Lerna
      LERNA_PACKAGE_NAME: task.target.project,
    };

    // TODO: remove this once we have a reasonable way to configure it
    if (task.target.target === 'test') {
      env.NX_TERMINAL_CAPTURE_STDERR = 'true';
    }

    return {
      ...this.getNxEnvVariablesForForkedProcess(
        forceColor,
        outputPath,
        streamOutput
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
    if (process.env.NX_LOAD_DOT_ENV_FILES == 'true') {
      return {
        ...this.getDotenvVariablesForForkedProcess(),
        ...parseEnv(`.${task.target.target}.env`),
        ...parseEnv(`.env.${task.target.target}`),
        ...(task.target.configuration
          ? {
              ...parseEnv(`.${task.target.configuration}.env`),
              ...parseEnv(
                `.${task.target.target}.${task.target.configuration}.env`
              ),
              ...parseEnv(`.env.${task.target.configuration}`),
              ...parseEnv(
                `.env.${task.target.target}.${task.target.configuration}`
              ),
            }
          : {}),
        ...parseEnv(`${task.projectRoot}/.env`),
        ...parseEnv(`${task.projectRoot}/.local.env`),
        ...parseEnv(`${task.projectRoot}/.env.local`),
        ...parseEnv(`${task.projectRoot}/.${task.target.target}.env`),
        ...parseEnv(`${task.projectRoot}/.env.${task.target.target}`),
        ...(task.target.configuration
          ? {
              ...parseEnv(
                `${task.projectRoot}/.${task.target.configuration}.env`
              ),
              ...parseEnv(
                `${task.projectRoot}/.${task.target.target}.${task.target.configuration}.env`
              ),
              ...parseEnv(
                `${task.projectRoot}/.env.${task.target.configuration}`
              ),
              ...parseEnv(
                `${task.projectRoot}/.env.${task.target.target}.${task.target.configuration}`
              ),
            }
          : {}),
      };
    } else {
      return {};
    }
  }

  // endregion Environment Variables

  private signalToCode(signal: string) {
    if (signal === 'SIGHUP') return 128 + 1;
    if (signal === 'SIGINT') return 128 + 2;
    if (signal === 'SIGTERM') return 128 + 15;
    return 128;
  }

  private setupProcessEventListeners() {
    // When the nx process gets a message, it will be sent into the task's process
    process.on('message', (message: Serializable) => {
      this.processes.forEach((p) => {
        if (p.connected) {
          p.send(message);
        }
      });
    });

    // Terminate any task processes on exit
    process.on('exit', () => {
      this.processes.forEach((p) => {
        if (p.connected) {
          p.kill();
        }
      });
    });
    process.on('SIGINT', () => {
      this.processes.forEach((p) => {
        if (p.connected) {
          p.kill('SIGTERM');
        }
      });
      // we exit here because we don't need to write anything to cache.
      process.exit();
    });
    process.on('SIGTERM', () => {
      this.processes.forEach((p) => {
        if (p.connected) {
          p.kill('SIGTERM');
        }
      });
      // no exit here because we expect child processes to terminate which
      // will store results to the cache and will terminate this process
    });
    process.on('SIGHUP', () => {
      this.processes.forEach((p) => {
        if (p.connected) {
          p.kill('SIGTERM');
        }
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

const colors = [
  chalk.green,
  chalk.greenBright,
  chalk.red,
  chalk.redBright,
  chalk.cyan,
  chalk.cyanBright,
  chalk.yellow,
  chalk.yellowBright,
  chalk.magenta,
  chalk.magentaBright,
];

function getColor(projectName: string) {
  let code = 0;
  for (let i = 0; i < projectName.length; ++i) {
    code += projectName.charCodeAt(i);
  }
  const colorIndex = code % colors.length;

  return colors[colorIndex];
}

/**
 * Prevents terminal escape sequence from clearing line prefix.
 */
function logClearLineToPrefixTransformer(prefix) {
  let prevChunk = null;
  return new Transform({
    transform(chunk, _encoding, callback) {
      if (prevChunk && prevChunk.toString() === '\x1b[2K') {
        chunk = chunk.toString().replace(/\x1b\[1G/g, (m) => m + prefix);
      }
      this.push(chunk);
      prevChunk = chunk;
      callback();
    },
  });
}
