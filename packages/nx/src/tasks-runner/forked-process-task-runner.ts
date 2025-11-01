import { writeFileSync } from 'fs';
import { fork, Serializable } from 'child_process';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { output } from '../utils/output';
import { getCliPath, getPrintableCommandArgsForTask } from './utils';
import { Batch } from './tasks-schedule';
import { join } from 'path';
import { BatchMessageType } from './batch/batch-messages';
import { stripIndents } from '../utils/strip-indents';
import { Task, TaskGraph } from '../config/task-graph';
import { PseudoTerminal, PseudoTtyProcess } from './pseudo-terminal';
import { signalToCode } from '../utils/exit-codes';
import { ProjectGraph } from '../config/project-graph';
import {
  NodeChildProcessWithDirectOutput,
  NodeChildProcessWithNonDirectOutput,
} from './running-tasks/node-child-process';
import { BatchProcess } from './running-tasks/batch-process';
import { RunningTask } from './running-tasks/running-task';
import { RustPseudoTerminal } from '../native';

const forkScript = join(__dirname, './fork.js');

const workerPath = join(__dirname, './batch/run-batch.js');

export class ForkedProcessTaskRunner {
  cliPath = getCliPath();

  private readonly verbose = process.env.NX_VERBOSE_LOGGING === 'true';
  private processes = new Set<RunningTask | BatchProcess>();
  private finishedProcesses = new Set<BatchProcess>();
  private pseudoTerminals = new Set<PseudoTerminal>();

  constructor(
    private readonly options: DefaultTasksRunnerOptions,
    private readonly tuiEnabled: boolean
  ) {}

  async init() {
    this.setupProcessEventListeners();
  }

  // TODO: vsavkin delegate terminal output printing
  public async forkProcessForBatch(
    { executorName, taskGraph: batchTaskGraph }: Batch,
    projectGraph: ProjectGraph,
    fullTaskGraph: TaskGraph,
    env: NodeJS.ProcessEnv
  ): Promise<BatchProcess> {
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
    const cp = new BatchProcess(p, executorName);
    this.processes.add(cp);

    cp.onExit(() => {
      this.processes.delete(cp);
    });

    // Start the tasks
    cp.send({
      type: BatchMessageType.RunTasks,
      executorName,
      projectGraph,
      batchTaskGraph,
      fullTaskGraph,
    });

    return cp;
  }

  public cleanUpBatchProcesses() {
    if (this.finishedProcesses.size > 0) {
      this.finishedProcesses.forEach((p) => {
        p.kill();
      });
      this.finishedProcesses.clear();
    }
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
  ): Promise<RunningTask> {
    return pipeOutput
      ? this.forkProcessWithPrefixAndNotTTY(task, {
          temporaryOutputPath,
          streamOutput,
          taskGraph,
          env,
        })
      : this.forkProcessDirectOutputCapture(task, {
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
  ): Promise<RunningTask | PseudoTtyProcess> {
    const shouldPrefix =
      streamOutput &&
      process.env.NX_PREFIX_OUTPUT === 'true' &&
      !this.tuiEnabled;

    // streamOutput would be false if we are running multiple targets
    // there's no point in running the commands in a pty if we are not streaming the output
    if (
      PseudoTerminal.isSupported() &&
      !disablePseudoTerminal &&
      (this.tuiEnabled || (streamOutput && !shouldPrefix))
    ) {
      // Use pseudo-terminal for interactive tasks that can support user input
      return this.forkProcessWithPseudoTerminal(task, {
        temporaryOutputPath,
        streamOutput,
        taskGraph,
        env,
      });
    } else {
      // Use non-interactive process with piped output
      // Tradeoff: These tasks cannot support interactivity but can still provide
      // progressive output to the TUI if it's enabled
      return this.forkProcessWithPrefixAndNotTTY(task, {
        temporaryOutputPath,
        streamOutput,
        taskGraph,
        env,
      });
    }
  }

  private async createPseudoTerminal() {
    const terminal = new PseudoTerminal(new RustPseudoTerminal());

    await terminal.init();

    terminal.onMessageFromChildren((message: Serializable) => {
      process.send(message);
    });

    return terminal;
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
  ): Promise<PseudoTtyProcess> {
    const childId = task.id;

    const pseudoTerminal = await this.createPseudoTerminal();
    this.pseudoTerminals.add(pseudoTerminal);
    const p = await pseudoTerminal.fork(childId, forkScript, {
      cwd: process.cwd(),
      execArgv: process.execArgv,
      jsEnv: env,
      quiet: !streamOutput,
      commandLabel: `nx run ${task.id}`,
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

    p.onExit((code) => {
      if (!this.tuiEnabled && code > 128) {
        process.exit(code);
      }
      this.pseudoTerminals.delete(pseudoTerminal);
      this.processes.delete(p);
      if (!streamOutput) {
        this.options.lifeCycle.printTaskTerminalOutput(
          task,
          code === 0 ? 'success' : 'failure',
          terminalOutput
        );
      }
      this.writeTerminalOutput(temporaryOutputPath, terminalOutput);
    });

    return p;
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
    try {
      const args = getPrintableCommandArgsForTask(task);
      if (streamOutput) {
        output.logCommand(args.join(' '));
      }

      const p = fork(this.cliPath, {
        stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
        env,
      });

      // Send message to run the executor
      p.send({
        targetDescription: task.target,
        overrides: task.overrides,
        taskGraph,
        isVerbose: this.verbose,
      });

      const cp = new NodeChildProcessWithNonDirectOutput(p, {
        streamOutput,
        prefix: task.target.project,
      });
      this.processes.add(cp);

      cp.onExit((code, terminalOutput) => {
        this.processes.delete(cp);

        if (!streamOutput) {
          this.options.lifeCycle.printTaskTerminalOutput(
            task,
            code === 0 ? 'success' : 'failure',
            terminalOutput
          );
        }
        this.writeTerminalOutput(temporaryOutputPath, terminalOutput);
      });

      return cp;
    } catch (e) {
      console.error(e);
      throw e;
    }
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
    try {
      const args = getPrintableCommandArgsForTask(task);
      if (streamOutput) {
        output.logCommand(args.join(' '));
      }
      const p = fork(this.cliPath, {
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
        env,
      });
      const cp = new NodeChildProcessWithDirectOutput(p, temporaryOutputPath);

      this.processes.add(cp);

      // Send message to run the executor
      p.send({
        targetDescription: task.target,
        overrides: task.overrides,
        taskGraph,
        isVerbose: this.verbose,
      });

      cp.onExit((code, signal) => {
        this.processes.delete(cp);
        // we didn't print any output as we were running the command
        // print all the collected output
        try {
          const terminalOutput = cp.getTerminalOutput();
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
      });

      return cp;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  private writeTerminalOutput(outputPath: string, content: string) {
    writeFileSync(outputPath, content);
  }

  cleanup(signal?: NodeJS.Signals) {
    this.processes.forEach((p) => {
      p.kill(signal);
    });
    this.cleanUpBatchProcesses();
  }

  private setupProcessEventListeners() {
    const messageHandler = (message: Serializable) => {
      this.pseudoTerminals.forEach((p) => {
        p.sendMessageToChildren(message);
      });

      this.processes.forEach((p) => {
        if ('connected' in p && p.connected && 'send' in p) {
          p.send(message);
        }
      });
    };

    // When the nx process gets a message, it will be sent into the task's process
    process.on('message', messageHandler);

    // Terminate any task processes on exit
    process.once('exit', () => {
      this.cleanup();
      process.off('message', messageHandler);
    });
    process.once('SIGINT', () => {
      this.cleanup('SIGTERM');
      process.off('message', messageHandler);
      // we exit here because we don't need to write anything to cache.
      process.exit(signalToCode('SIGINT'));
    });
    process.once('SIGTERM', () => {
      this.cleanup('SIGTERM');
      process.off('message', messageHandler);
      // no exit here because we expect child processes to terminate which
      // will store results to the cache and will terminate this process
    });
    process.once('SIGHUP', () => {
      this.cleanup('SIGTERM');
      process.off('message', messageHandler);
      // no exit here because we expect child processes to terminate which
      // will store results to the cache and will terminate this process
    });
  }
}
