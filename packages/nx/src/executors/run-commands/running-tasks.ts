import * as chalk from 'chalk';
import { ChildProcess, exec, Serializable } from 'child_process';
import { env as appendLocalEnv } from 'npm-run-path';
import { isAbsolute, join } from 'path';
import * as treeKill from 'tree-kill';
import { ExecutorContext } from '../../config/misc-interfaces';
import {
  createPseudoTerminal,
  PseudoTerminal,
  PseudoTtyProcess,
} from '../../tasks-runner/pseudo-terminal';
import { RunningTask } from '../../tasks-runner/running-tasks/running-task';
import {
  loadAndExpandDotEnvFile,
  unloadDotEnvFile,
} from '../../tasks-runner/task-env';
import { getProcessMetricsService } from '../../tasks-runner/process-metrics-service';
import { signalToCode } from '../../utils/exit-codes';
import {
  LARGE_BUFFER,
  NormalizedRunCommandsOptions,
  RunCommandsCommandOptions,
} from './run-commands.impl';

export class ParallelRunningTasks implements RunningTask {
  private readonly childProcesses: RunningNodeProcess[];
  private readyWhenStatus: { stringToMatch: string; found: boolean }[];
  private readonly streamOutput: boolean;

  private exitCallbacks: Array<(code: number, terminalOutput: string) => void> =
    [];
  private outputCallbacks: Array<(terminalOutput: string) => void> = [];

  constructor(
    options: NormalizedRunCommandsOptions,
    context: ExecutorContext,
    taskId: string
  ) {
    this.childProcesses = options.commands.map(
      (commandConfig) =>
        new RunningNodeProcess(
          commandConfig,
          options.color,
          calculateCwd(options.cwd, context),
          options.env ?? {},
          options.readyWhenStatus,
          options.streamOutput,
          options.envFile,
          taskId
        )
    );
    this.readyWhenStatus = options.readyWhenStatus;
    this.streamOutput = options.streamOutput;

    this.run();
  }

  async getResults(): Promise<{ code: number; terminalOutput: string }> {
    return new Promise((res) => {
      this.onExit((code, terminalOutput) => {
        res({ code, terminalOutput });
      });
    });
  }

  onOutput(cb: (terminalOutput: string) => void) {
    this.outputCallbacks.push(cb);
  }

  onExit(cb: (code: number, terminalOutput: string) => void): void {
    this.exitCallbacks.push(cb);
  }

  send(message: Serializable): void {
    for (const childProcess of this.childProcesses) {
      childProcess.send(message);
    }
  }

  async kill(signal?: NodeJS.Signals) {
    await Promise.all(
      this.childProcesses.map(async (p) => {
        try {
          return p.kill();
        } catch (e) {
          console.error(`Unable to terminate "${p.command}"\nError:`, e);
        }
      })
    );
  }

  private async run() {
    if (this.readyWhenStatus.length) {
      let {
        childProcess,
        result: { code, terminalOutput },
      } = await Promise.race(
        this.childProcesses.map(
          (childProcess) =>
            new Promise<{
              childProcess: RunningNodeProcess;
              result: { code: number; terminalOutput: string };
            }>((res) => {
              childProcess.onOutput((terminalOutput) => {
                for (const cb of this.outputCallbacks) {
                  cb(terminalOutput);
                }
              });
              childProcess.onExit((code, terminalOutput) => {
                res({
                  childProcess,
                  result: { code, terminalOutput },
                });
              });
            })
        )
      );

      if (code !== 0) {
        const output = `Warning: command "${childProcess.command}" exited with non-zero status code`;
        terminalOutput += output;
        if (this.streamOutput) {
          process.stderr.write(output);
        }
      }

      for (const cb of this.exitCallbacks) {
        cb(code, terminalOutput);
      }
    } else {
      const runningProcesses = new Set<RunningNodeProcess>();
      let hasFailure = false;
      let failureDetails: {
        childProcess: RunningNodeProcess;
        code: number;
        terminalOutput: string;
      } | null = null;
      const terminalOutputs = new Map<RunningNodeProcess, string>();

      await Promise.allSettled(
        this.childProcesses.map(async (childProcess) => {
          runningProcesses.add(childProcess);

          childProcess.onOutput((terminalOutput) => {
            for (const cb of this.outputCallbacks) {
              cb(terminalOutput);
            }
          });

          const { code, terminalOutput } = await childProcess.getResults();
          terminalOutputs.set(childProcess, terminalOutput);

          if (code !== 0 && !hasFailure) {
            hasFailure = true;
            failureDetails = { childProcess, code, terminalOutput };

            // Immediately terminate all other running processes
            await this.terminateRemainingProcesses(
              runningProcesses,
              childProcess
            );
          }

          runningProcesses.delete(childProcess);
        })
      );

      let terminalOutput = Array.from(terminalOutputs.values()).join('\r\n');

      if (hasFailure && failureDetails) {
        // Add failure message
        const output = `Warning: command "${failureDetails.childProcess.command}" exited with non-zero status code`;
        terminalOutput += output;
        if (this.streamOutput) {
          process.stderr.write(output);
        }

        for (const cb of this.exitCallbacks) {
          cb(1, terminalOutput);
        }
      } else {
        for (const cb of this.exitCallbacks) {
          cb(0, terminalOutput);
        }
      }
    }
  }

  private async terminateRemainingProcesses(
    runningProcesses: Set<RunningNodeProcess>,
    failedProcess: RunningNodeProcess
  ): Promise<void> {
    const terminationPromises: Promise<void>[] = [];

    const processesToTerminate = [...runningProcesses].filter(
      (p) => p !== failedProcess
    );
    for (const process of processesToTerminate) {
      runningProcesses.delete(process);

      // Terminate the process
      terminationPromises.push(
        process.kill('SIGTERM').catch((err) => {
          // Log error but don't fail the entire operation
          if (this.streamOutput) {
            console.error(
              `Failed to terminate process "${process.command}":`,
              err
            );
          }
        })
      );
    }

    // Wait for all terminations to complete with a timeout
    if (terminationPromises.length > 0) {
      await Promise.race([
        Promise.all(terminationPromises),
        new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
      ]);
    }
  }
}

export class SeriallyRunningTasks implements RunningTask {
  private terminalOutput = '';
  private currentProcess: RunningTask | PseudoTtyProcess | null = null;
  private exitCallbacks: Array<(code: number, terminalOutput: string) => void> =
    [];
  private code: number | null = 0;
  private error: any;
  private outputCallbacks: Array<(terminalOutput: string) => void> = [];

  constructor(
    options: NormalizedRunCommandsOptions,
    context: ExecutorContext,
    private readonly tuiEnabled: boolean,
    private readonly taskId: string
  ) {
    this.run(options, context)
      .catch((e) => {
        this.error = e;
      })
      .finally(() => {
        for (const cb of this.exitCallbacks) {
          cb(this.code, this.terminalOutput);
        }
      });
  }

  getResults(): Promise<{ code: number; terminalOutput: string }> {
    return new Promise((res, rej) => {
      this.onExit((code) => {
        if (this.error) {
          rej(this.error);
        } else {
          res({ code, terminalOutput: this.terminalOutput });
        }
      });
    });
  }

  onExit(cb: (code: number, terminalOutput: string) => void): void {
    this.exitCallbacks.push(cb);
  }

  onOutput(cb: (terminalOutput: string) => void) {
    this.outputCallbacks.push(cb);
  }

  send(message: Serializable): void {
    throw new Error('Not implemented');
  }

  kill(signal?: NodeJS.Signals) {
    return this.currentProcess.kill(signal);
  }

  private async run(
    options: NormalizedRunCommandsOptions,
    context: ExecutorContext
  ) {
    for (const c of options.commands) {
      const childProcess = await this.createProcess(
        c,
        options.color,
        calculateCwd(options.cwd, context),
        options.processEnv ?? options.env ?? {},
        this.taskId,
        options.usePty,
        options.streamOutput,
        options.tty,
        options.envFile
      );
      this.currentProcess = childProcess;

      childProcess.onOutput((output) => {
        for (const cb of this.outputCallbacks) {
          cb(output);
        }
      });

      let { code, terminalOutput } = await childProcess.getResults();
      this.terminalOutput += terminalOutput;
      this.code = code;
      if (code !== 0) {
        const output = `Warning: command "${c.command}" exited with non-zero status code`;
        terminalOutput += output;
        if (options.streamOutput) {
          process.stderr.write(output);
        }
        this.terminalOutput += terminalOutput;

        // Stop running commands
        break;
      }
    }
  }

  private async createProcess(
    commandConfig: RunCommandsCommandOptions,
    color: boolean,
    cwd: string,
    env: Record<string, string>,
    taskId: string,
    usePty: boolean = true,
    streamOutput: boolean = true,
    tty: boolean,
    envFile?: string
  ): Promise<PseudoTtyProcess | RunningNodeProcess> {
    // The rust runCommand is always a tty, so it will not look nice in parallel and if we need prefixes
    // currently does not work properly in windows
    if (
      process.env.NX_NATIVE_COMMAND_RUNNER !== 'false' &&
      !commandConfig.prefix &&
      usePty &&
      PseudoTerminal.isSupported()
    ) {
      const pseudoTerminal = createPseudoTerminal();
      registerProcessListener(this, pseudoTerminal);

      const pseudoTtyProcess = await createProcessWithPseudoTty(
        pseudoTerminal,
        commandConfig,
        color,
        cwd,
        env,
        streamOutput,
        tty,
        envFile
      );

      // Register process for metrics collection (direct run-commands execution)
      // Skip registration if we're in a forked executor - the fork wrapper already registered
      const pid = pseudoTtyProcess.getPid();
      if (pid && !process.env.NX_FORKED_TASK_EXECUTOR) {
        getProcessMetricsService().registerTaskProcess(taskId, pid);
      }

      return pseudoTtyProcess;
    }

    return new RunningNodeProcess(
      commandConfig,
      color,
      cwd,
      env,
      [],
      streamOutput,
      envFile,
      taskId
    );
  }
}

class RunningNodeProcess implements RunningTask {
  private terminalOutput = '';
  private childProcess: ChildProcess;
  private exitCallbacks: Array<(code: number, terminalOutput: string) => void> =
    [];
  private outputCallbacks: Array<(terminalOutput: string) => void> = [];
  public command: string;

  constructor(
    commandConfig: RunCommandsCommandOptions,
    color: boolean,
    cwd: string,
    env: Record<string, string>,
    private readyWhenStatus: { stringToMatch: string; found: boolean }[],
    streamOutput = true,
    envFile: string,
    private taskId: string
  ) {
    env = processEnv(color, cwd, env, envFile);
    this.command = commandConfig.command;
    this.terminalOutput = chalk.dim('> ') + commandConfig.command + '\r\n\r\n';
    if (streamOutput) {
      process.stdout.write(this.terminalOutput);
    }
    this.childProcess = exec(commandConfig.command, {
      maxBuffer: LARGE_BUFFER,
      env,
      cwd,
      windowsHide: false,
    });

    // Register process for metrics collection
    // Skip registration if we're in a forked executor - the fork wrapper already registered
    if (this.childProcess.pid && !process.env.NX_FORKED_TASK_EXECUTOR) {
      getProcessMetricsService().registerTaskProcess(
        this.taskId,
        this.childProcess.pid
      );
    }

    this.addListeners(commandConfig, streamOutput);
  }

  getResults(): Promise<{ code: number; terminalOutput: string }> {
    return new Promise((res) => {
      this.onExit((code, terminalOutput) => {
        res({ code, terminalOutput });
      });
    });
  }

  onOutput(cb: (terminalOutput: string) => void) {
    this.outputCallbacks.push(cb);
  }

  onExit(cb: (code: number, terminalOutput: string) => void): void {
    this.exitCallbacks.push(cb);
  }

  send(message: Serializable): void {
    this.childProcess.send(message);
  }

  kill(signal?: NodeJS.Signals): Promise<void> {
    return new Promise<void>((res, rej) => {
      treeKill(this.childProcess.pid, signal, (err) => {
        // On Windows, tree-kill (which uses taskkill) may fail when the process or its child process is already terminated.
        // Ignore the errors, otherwise we will log them unnecessarily.
        if (err && process.platform !== 'win32') {
          rej(err);
        } else {
          res();
        }
      });
    });
  }

  private triggerOutputListeners(output: string) {
    for (const cb of this.outputCallbacks) {
      cb(output);
    }
  }

  private addListeners(
    commandConfig: RunCommandsCommandOptions,
    streamOutput: boolean
  ) {
    this.childProcess.stdout.on('data', (data) => {
      const output = addColorAndPrefix(data, commandConfig);

      this.terminalOutput += output;
      this.triggerOutputListeners(output);

      if (streamOutput) {
        process.stdout.write(output);
      }
      if (
        this.readyWhenStatus.length &&
        isReady(this.readyWhenStatus, data.toString())
      ) {
        for (const cb of this.exitCallbacks) {
          cb(0, this.terminalOutput);
        }
      }
    });
    this.childProcess.stderr.on('data', (err) => {
      const output = addColorAndPrefix(err, commandConfig);

      this.terminalOutput += output;
      this.triggerOutputListeners(output);

      if (streamOutput) {
        process.stderr.write(output);
      }
      if (
        this.readyWhenStatus.length &&
        isReady(this.readyWhenStatus, err.toString())
      ) {
        for (const cb of this.exitCallbacks) {
          cb(1, this.terminalOutput);
        }
      }
    });
    this.childProcess.on('error', (err) => {
      const output = addColorAndPrefix(err.toString(), commandConfig);
      this.terminalOutput += output;
      if (streamOutput) {
        process.stderr.write(output);
      }
      for (const cb of this.exitCallbacks) {
        cb(1, this.terminalOutput);
      }
    });
    this.childProcess.on('exit', (code) => {
      if (!this.readyWhenStatus.length || isReady(this.readyWhenStatus)) {
        for (const cb of this.exitCallbacks) {
          cb(code, this.terminalOutput);
        }
      }
    });
    // Terminate any task processes on exit
    process.on('exit', () => {
      this.childProcess.kill();
    });
    process.on('SIGINT', () => {
      this.childProcess.kill('SIGTERM');
      // we exit here because we don't need to write anything to cache.
      process.exit(signalToCode('SIGINT'));
    });
    process.on('SIGTERM', () => {
      this.childProcess.kill('SIGTERM');
      // no exit here because we expect child processes to terminate which
      // will store results to the cache and will terminate this process
    });
    process.on('SIGHUP', () => {
      this.childProcess.kill('SIGTERM');
      // no exit here because we expect child processes to terminate which
      // will store results to the cache and will terminate this process
    });
  }
}

export async function runSingleCommandWithPseudoTerminal(
  normalized: NormalizedRunCommandsOptions,
  context: ExecutorContext,
  taskId: string
): Promise<PseudoTtyProcess> {
  const pseudoTerminal = createPseudoTerminal();
  const pseudoTtyProcess = await createProcessWithPseudoTty(
    pseudoTerminal,
    normalized.commands[0],
    normalized.color,
    calculateCwd(normalized.cwd, context),
    normalized.env,
    normalized.streamOutput,
    pseudoTerminal ? normalized.isTTY : false,
    normalized.envFile
  );

  // Register process for metrics collection (direct run-commands execution)
  // Skip registration if we're in a forked executor - the fork wrapper already registered
  const pid = pseudoTtyProcess.getPid();
  if (pid && !process.env.NX_FORKED_TASK_EXECUTOR) {
    getProcessMetricsService().registerTaskProcess(taskId, pid);
  }

  registerProcessListener(pseudoTtyProcess, pseudoTerminal);
  return pseudoTtyProcess;
}

async function createProcessWithPseudoTty(
  pseudoTerminal: PseudoTerminal,
  commandConfig: RunCommandsCommandOptions,
  color: boolean,
  cwd: string,
  env: Record<string, string>,
  streamOutput: boolean = true,
  tty: boolean,
  envFile?: string
) {
  return pseudoTerminal.runCommand(commandConfig.command, {
    cwd,
    jsEnv: processEnv(color, cwd, env, envFile),
    quiet: !streamOutput,
    tty,
  });
}

function addColorAndPrefix(out: string, config: RunCommandsCommandOptions) {
  if (config.prefix) {
    out = out
      .split('\n')
      .map((l) => {
        let prefixText = config.prefix;
        if (config.prefixColor && chalk[config.prefixColor]) {
          prefixText = chalk[config.prefixColor](prefixText);
        }
        prefixText = chalk.bold(prefixText);
        return l.trim().length > 0 ? `${prefixText} ${l}` : l;
      })
      .join('\n');
  }
  if (config.color && chalk[config.color]) {
    out = chalk[config.color](out);
  }
  if (config.bgColor && chalk[config.bgColor]) {
    out = chalk[config.bgColor](out);
  }
  return out;
}

function calculateCwd(
  cwd: string | undefined,
  context: ExecutorContext
): string {
  if (!cwd) return context.root;
  if (isAbsolute(cwd)) return cwd;
  return join(context.root, cwd);
}

/**
 * Env variables are processed in the following order:
 * - env option from executor options
 * - env file from envFile option if provided
 * - local env variables
 */
function processEnv(
  color: boolean,
  cwd: string,
  envOptionFromExecutor: Record<string, string>,
  envFile?: string
) {
  let localEnv = appendLocalEnv({ cwd: cwd ?? process.cwd() });
  localEnv = {
    ...process.env,
    ...localEnv,
  };

  if (process.env.NX_LOAD_DOT_ENV_FILES !== 'false' && envFile) {
    loadEnvVarsFile(envFile, localEnv);
  }
  let res: Record<string, string> = {
    ...localEnv,
    ...envOptionFromExecutor,
  };
  // need to override PATH to make sure we are using the local node_modules
  if (localEnv.PATH) res.PATH = localEnv.PATH; // UNIX-like
  if (localEnv.Path) res.Path = localEnv.Path; // Windows

  if (color) {
    res.FORCE_COLOR = `${color}`;
  }
  return res;
}

function isReady(
  readyWhenStatus: { stringToMatch: string; found: boolean }[] = [],
  data?: string
): boolean {
  if (data) {
    for (const readyWhenElement of readyWhenStatus) {
      if (data.toString().indexOf(readyWhenElement.stringToMatch) > -1) {
        readyWhenElement.found = true;
        break;
      }
    }
  }

  return readyWhenStatus.every((readyWhenElement) => readyWhenElement.found);
}

function loadEnvVarsFile(path: string, env: Record<string, string> = {}) {
  unloadDotEnvFile(path, env);
  const result = loadAndExpandDotEnvFile(path, env);
  if (result.error) {
    throw result.error;
  }
}

let registered = false;

function registerProcessListener(
  runningTask: PseudoTtyProcess | ParallelRunningTasks | SeriallyRunningTasks,
  pseudoTerminal?: PseudoTerminal
) {
  if (registered) {
    return;
  }

  registered = true;
  // When the nx process gets a message, it will be sent into the task's process
  process.on('message', (message: Serializable) => {
    // this.publisher.publish(message.toString());
    if (pseudoTerminal) {
      pseudoTerminal.sendMessageToChildren(message);
    }

    if ('send' in runningTask) {
      runningTask.send(message);
    }
  });

  // Terminate any task processes on exit
  process.on('exit', () => {
    runningTask.kill();
  });
  process.on('SIGINT', () => {
    runningTask.kill('SIGTERM');
    // we exit here because we don't need to write anything to cache.
    process.exit(signalToCode('SIGINT'));
  });
  process.on('SIGTERM', () => {
    runningTask.kill('SIGTERM');
    // no exit here because we expect child processes to terminate which
    // will store results to the cache and will terminate this process
  });
  process.on('SIGHUP', () => {
    runningTask.kill('SIGTERM');
    // no exit here because we expect child processes to terminate which
    // will store results to the cache and will terminate this process
  });
}
