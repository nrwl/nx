import { readFileSync, writeFileSync } from 'fs';
import { ChildProcess, fork, Serializable } from 'child_process';
import * as chalk from 'chalk';
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
import {
  PseudoTtyProcess,
  getPseudoTerminal,
  PseudoTerminal,
} from './pseudo-terminal';
import { signalToCode } from '../utils/exit-codes';

const forkScript = join(__dirname, './fork.js');

const workerPath = join(__dirname, './batch/run-batch.js');

export class ForkedProcessTaskRunner {
  cliPath = getCliPath();

  private readonly verbose = process.env.NX_VERBOSE_LOGGING === 'true';
  private processes = new Set<ChildProcess | PseudoTtyProcess>();

  private pseudoTerminal: PseudoTerminal | null = PseudoTerminal.isSupported()
    ? getPseudoTerminal()
    : null;

  constructor(private readonly options: DefaultTasksRunnerOptions) {}

  async init() {
    if (this.pseudoTerminal) {
      await this.pseudoTerminal.init();
    }
    this.setupProcessEventListeners();
  }

  // TODO: vsavkin delegate terminal output printing
  public forkProcessForBatch(
    { executorName, taskGraph: batchTaskGraph }: Batch,
    fullTaskGraph: TaskGraph,
    env: NodeJS.ProcessEnv
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
        }

        const p = fork(workerPath, {
          stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
          env,
        });
        this.processes.add(p);

        p.once('exit', (code, signal) => {
          this.processes.delete(p);
          if (code === null) code = signalToCode(signal);
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

        p.on('message', (message: BatchMessage) => {
          switch (message.type) {
            case BatchMessageType.CompleteBatchExecution: {
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

  public async forkProcessLegacy(
    task: Task,
    {
      temporaryOutputPath,
      streamOutput,
      pipeOutput,
      taskGraph,
      env,
    }: {
      temporaryOutputPath: string;
      streamOutput: boolean;
      pipeOutput: boolean;
      taskGraph: TaskGraph;
      env: NodeJS.ProcessEnv;
    }
  ): Promise<{ code: number; terminalOutput: string }> {
    return pipeOutput
      ? await this.forkProcessPipeOutputCapture(task, {
          temporaryOutputPath,
          streamOutput,
          taskGraph,
          env,
        })
      : await this.forkProcessDirectOutputCapture(task, {
          temporaryOutputPath,
          streamOutput,
          taskGraph,
          env,
        });
  }

  public async forkProcess(
    task: Task,
    {
      temporaryOutputPath,
      streamOutput,
      taskGraph,
      env,
      disablePseudoTerminal,
    }: {
      temporaryOutputPath: string;
      streamOutput: boolean;
      pipeOutput: boolean;
      taskGraph: TaskGraph;
      env: NodeJS.ProcessEnv;
      disablePseudoTerminal: boolean;
    }
  ): Promise<{ code: number; terminalOutput: string }> {
    const shouldPrefix =
      streamOutput && process.env.NX_PREFIX_OUTPUT === 'true';

    // streamOutput would be false if we are running multiple targets
    // there's no point in running the commands in a pty if we are not streaming the output
    if (
      !this.pseudoTerminal ||
      disablePseudoTerminal ||
      !streamOutput ||
      shouldPrefix
    ) {
      return this.forkProcessWithPrefixAndNotTTY(task, {
        temporaryOutputPath,
        streamOutput,
        taskGraph,
        env,
      });
    } else {
      return this.forkProcessWithPseudoTerminal(task, {
        temporaryOutputPath,
        streamOutput,
        taskGraph,
        env,
      });
    }
  }

  private async forkProcessWithPseudoTerminal(
    task: Task,
    {
      temporaryOutputPath,
      streamOutput,
      taskGraph,
      env,
    }: {
      temporaryOutputPath: string;
      streamOutput: boolean;
      taskGraph: TaskGraph;
      env: NodeJS.ProcessEnv;
    }
  ): Promise<{ code: number; terminalOutput: string }> {
    const args = getPrintableCommandArgsForTask(task);
    if (streamOutput) {
      output.logCommand(args.join(' '));
    }

    const childId = task.id;
    const p = await this.pseudoTerminal.fork(childId, forkScript, {
      cwd: process.cwd(),
      execArgv: process.execArgv,
      jsEnv: env,
      quiet: !streamOutput,
    });

    p.send({
      targetDescription: task.target,
      overrides: task.overrides,
      taskGraph,
      isVerbose: this.verbose,
    });
    this.processes.add(p);

    let terminalOutput = '';
    p.onOutput((msg) => {
      terminalOutput += msg;
    });

    return new Promise((res) => {
      p.onExit((code) => {
        // If the exit code is greater than 128, it's a special exit code for a signal
        if (code >= 128) {
          process.exit(code);
        }
        this.writeTerminalOutput(temporaryOutputPath, terminalOutput);
        res({
          code,
          terminalOutput,
        });
      });
    });
  }

  private forkProcessPipeOutputCapture(
    task: Task,
    {
      streamOutput,
      temporaryOutputPath,
      taskGraph,
      env,
    }: {
      streamOutput: boolean;
      temporaryOutputPath: string;
      taskGraph: TaskGraph;
      env: NodeJS.ProcessEnv;
    }
  ) {
    return this.forkProcessWithPrefixAndNotTTY(task, {
      streamOutput,
      temporaryOutputPath,
      taskGraph,
      env,
    });
  }

  private forkProcessWithPrefixAndNotTTY(
    task: Task,
    {
      streamOutput,
      temporaryOutputPath,
      taskGraph,
      env,
    }: {
      streamOutput: boolean;
      temporaryOutputPath: string;
      taskGraph: TaskGraph;
      env: NodeJS.ProcessEnv;
    }
  ) {
    return new Promise<{ code: number; terminalOutput: string }>((res, rej) => {
      try {
        const args = getPrintableCommandArgsForTask(task);
        if (streamOutput) {
          output.logCommand(args.join(' '));
        }

        const p = fork(this.cliPath, {
          stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
          env,
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
              .pipe(addPrefixTransformer(color.bold(prefixText)))
              .pipe(process.stdout);
            p.stderr
              .pipe(logClearLineToPrefixTransformer(color(prefixText) + ' '))
              .pipe(addPrefixTransformer(color(prefixText)))
              .pipe(process.stderr);
          } else {
            p.stdout.pipe(addPrefixTransformer()).pipe(process.stdout);
            p.stderr.pipe(addPrefixTransformer()).pipe(process.stderr);
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
          if (code === null) code = signalToCode(signal);
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

  private forkProcessDirectOutputCapture(
    task: Task,
    {
      streamOutput,
      temporaryOutputPath,
      taskGraph,
      env,
    }: {
      streamOutput: boolean;
      temporaryOutputPath: string;
      taskGraph: TaskGraph;
      env: NodeJS.ProcessEnv;
    }
  ) {
    return new Promise<{ code: number; terminalOutput: string }>((res, rej) => {
      try {
        const args = getPrintableCommandArgsForTask(task);
        if (streamOutput) {
          output.logCommand(args.join(' '));
        }
        const p = fork(this.cliPath, {
          stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
          env,
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
          if (code === null) code = signalToCode(signal);
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

  private setupProcessEventListeners() {
    if (this.pseudoTerminal) {
      this.pseudoTerminal.onMessageFromChildren((message: Serializable) => {
        process.send(message);
      });
    }

    // When the nx process gets a message, it will be sent into the task's process
    process.on('message', (message: Serializable) => {
      // this.publisher.publish(message.toString());
      if (this.pseudoTerminal) {
        this.pseudoTerminal.sendMessageToChildren(message);
      }

      this.processes.forEach((p) => {
        if ('connected' in p && p.connected) {
          p.send(message);
        }
      });
    });

    // Terminate any task processes on exit
    process.on('exit', () => {
      this.processes.forEach((p) => {
        if ('connected' in p ? p.connected : p.isAlive) {
          p.kill();
        }
      });
    });
    process.on('SIGINT', () => {
      this.processes.forEach((p) => {
        if ('connected' in p ? p.connected : p.isAlive) {
          p.kill('SIGTERM');
        }
      });
      // we exit here because we don't need to write anything to cache.
      process.exit(signalToCode('SIGINT'));
    });
    process.on('SIGTERM', () => {
      this.processes.forEach((p) => {
        if ('connected' in p ? p.connected : p.isAlive) {
          p.kill('SIGTERM');
        }
      });
      // no exit here because we expect child processes to terminate which
      // will store results to the cache and will terminate this process
    });
    process.on('SIGHUP', () => {
      this.processes.forEach((p) => {
        if ('connected' in p ? p.connected : p.isAlive) {
          p.kill('SIGTERM');
        }
      });
      // no exit here because we expect child processes to terminate which
      // will store results to the cache and will terminate this process
    });
  }
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
function logClearLineToPrefixTransformer(prefix: string) {
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

function addPrefixTransformer(prefix?: string) {
  const newLineSeparator = process.platform.startsWith('win') ? '\r\n' : '\n';
  return new Transform({
    transform(chunk, _encoding, callback) {
      const list = chunk.toString().split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/g);
      list
        .filter(Boolean)
        .forEach((m) =>
          this.push(
            prefix ? prefix + ' ' + m + newLineSeparator : m + newLineSeparator
          )
        );
      callback();
    },
  });
}
