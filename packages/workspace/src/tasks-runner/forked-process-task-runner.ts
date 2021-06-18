import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
import { ChildProcess, fork } from 'child_process';
import { appRootPath } from '../utilities/app-root';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { Task } from './tasks-runner';
import { output } from '../utilities/output';
import { getCliPath, getCommandArgsForTask, unparse } from './utils';

export class ForkedProcessTaskRunner {
  workspaceRoot = appRootPath;
  cliPath = getCliPath(this.workspaceRoot);

  private processes: ChildProcess[] = [];

  constructor(private readonly options: DefaultTasksRunnerOptions) {
    this.setupOnProcessExitListener();
  }

  public forkProcessPipeOutputCapture(
    task: Task,
    { forwardOutput }: { forwardOutput: boolean }
  ) {
    return new Promise<{ code: number; terminalOutput: string }>((res, rej) => {
      try {
        const env = this.envForForkedProcess(
          task,
          undefined,
          forwardOutput,
          process.env.FORCE_COLOR === undefined
            ? 'true'
            : process.env.FORCE_COLOR
        );
        const args = getCommandArgsForTask(task);
        const commandLine = `nx ${args.join(' ')}`;

        if (forwardOutput) {
          output.logCommand(commandLine);
        }
        const p = fork(this.cliPath, args, {
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
          const terminalOutput = outWithErr.join('');
          if (!forwardOutput) {
            output.logCommand(commandLine);
            process.stdout.write(terminalOutput);
          }
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
        const env = this.envForForkedProcess(
          task,
          temporaryOutputPath,
          forwardOutput,
          undefined
        );
        const args = getCommandArgsForTask(task);
        const commandLine = `nx ${args.join(' ')}`;

        if (forwardOutput) {
          output.logCommand(commandLine);
        }
        const p = fork(this.cliPath, args, {
          stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
          env,
        });
        this.processes.push(p);
        p.on('exit', (code, signal) => {
          if (code === null) code = this.signalToCode(signal);
          // we didn't print any output as we were running the command
          // print all the collected output
          const terminalOutput = this.readTerminalOutput(temporaryOutputPath);
          if (!forwardOutput) {
            output.logCommand(commandLine);
            if (terminalOutput) {
              process.stdout.write(terminalOutput);
            } else {
              console.error(
                `Nx could not find process's output. Run the command without --parallel.`
              );
            }
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
