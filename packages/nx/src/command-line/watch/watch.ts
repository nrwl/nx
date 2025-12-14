import { ChildProcess, spawn } from 'child_process';
import { ChangedFile, daemonClient } from '../../daemon/client/client';
import { output } from '../../utils/output';

export interface WatchArguments {
  projects?: string[];
  all?: boolean;
  includeDependentProjects?: boolean;
  includeGlobalWorkspaceFiles?: boolean;
  verbose?: boolean;
  command?: string;
  initialRun?: boolean;

  projectNameEnvName?: string;
  fileChangesEnvName?: string;

  /**
   * Execution strategy for running commands.
   * - 'batch': Run and wait for completion before processing next batch (default)
   * - 'persistent': Lazy-start processes and keep them alive, with FIFO eviction
   */
  executionStrategy?: 'batch' | 'persistent';

  /**
   * Maximum number of concurrent persistent processes.
   * Only applies when `executionStrategy` is 'persistent'.
   * Default: 3
   */
  maxParallel?: number;
}

const DEFAULT_PROJECT_NAME_ENV = 'NX_PROJECT_NAME';
const DEFAULT_FILE_CHANGES_ENV = 'NX_FILE_CHANGES';

export class BatchFunctionRunner {
  private running = false;

  private pendingProjects = new Set<string>();
  private pendingFiles = new Set<string>();

  protected get _verbose() {
    return process.env.NX_VERBOSE_LOGGING === 'true';
  }

  private get hasPending() {
    return this.pendingProjects.size > 0 || this.pendingFiles.size > 0;
  }

  constructor(
    private callback: (
      projects: Set<string>,
      files: Set<string>
    ) => Promise<unknown>
  ) {}

  enqueue(projectNames: string[], fileChanges: ChangedFile[]) {
    projectNames.forEach((projectName) => {
      this.pendingProjects.add(projectName);
    });
    fileChanges.forEach((fileChange) => {
      this.pendingFiles.add(fileChange.path);
    });

    return this.process();
  }

  cleanUp() {}

  private async process() {
    if (!this.running && this.hasPending) {
      this.running = true;

      // Clone the pending projects and files before clearing
      const projects = new Set(this.pendingProjects);
      const files = new Set(this.pendingFiles);

      // Clear the pending projects and files
      this.pendingProjects.clear();
      this.pendingFiles.clear();

      return this.callback(projects, files).then(() => {
        this.running = false;
        this.process();
      });
    } else {
      this._verbose &&
        this.running &&
        output.logSingleLine('waiting for function to finish executing');

      this._verbose &&
        !this.hasPending &&
        output.logSingleLine('no more function to process');
    }
  }
}

class BatchCommandRunner extends BatchFunctionRunner {
  constructor(
    private command: string,
    private projectNameEnv: string = DEFAULT_PROJECT_NAME_ENV,
    private fileChangesEnv: string = DEFAULT_FILE_CHANGES_ENV
  ) {
    super((projects, files) => {
      // process all pending commands together
      const envs = this.createCommandEnvironments(projects, files);

      return this.run(envs);
    });
  }

  private createCommandEnvironments(
    projects: Set<string>,
    files: Set<string>
  ): Record<string, string>[] {
    const commandsToRun = [];

    if (projects.size > 0) {
      projects.forEach((projectName) => {
        commandsToRun.push({
          [this.projectNameEnv]: projectName,
          [this.fileChangesEnv]: Array.from(files).join(' '),
        });
      });
    } else {
      commandsToRun.push({
        [this.projectNameEnv]: '',
        [this.fileChangesEnv]: Array.from(files).join(' '),
      });
    }

    return commandsToRun;
  }

  async run(envs: Record<string, string>[]) {
    this._verbose &&
      output.logSingleLine(
        'about to run commands with these environments: ' + JSON.stringify(envs)
      );

    return Promise.all(
      envs.map((env) => {
        return new Promise<void>((resolve, reject) => {
          const commandExec = spawn(this.command, {
            stdio: 'inherit',
            shell: true,
            cwd: process.cwd(),
            env: {
              ...process.env,
              [this.projectNameEnv]: env[this.projectNameEnv],
              [this.fileChangesEnv]: env[this.fileChangesEnv],
            },
            windowsHide: false,
          });
          commandExec.on('close', () => {
            resolve();
          });
          commandExec.on('exit', () => {
            resolve();
          });
        });
      })
    ).then((r) => {
      this._verbose &&
        output.logSingleLine('running complete, processing the next batch');
      return r;
    });
  }
}

class PersistentCommandRunner extends BatchFunctionRunner {
  // Track active processes in insertion order (for FIFO eviction)
  private activeProcesses = new Map<string, ChildProcess>();
  private maxParallel: number;

  constructor(
    private command: string,
    maxParallel: number = 3,
    private projectNameEnv: string = DEFAULT_PROJECT_NAME_ENV,
    private fileChangesEnv: string = DEFAULT_FILE_CHANGES_ENV
  ) {
    super((projects, files) => {
      // Handle persistent processes
      return this.manageProcesses(projects, files);
    });

    this.maxParallel = Math.max(1, maxParallel);
  }

  override cleanUp() {
    super.cleanUp();
    this.killAll();
  }

  private async manageProcesses(
    projects: Set<string>,
    files: Set<string>
  ): Promise<void> {
    const filesArray = Array.from(files);

    if (projects.size === 0) {
      // No projects specified, handle as single global process
      const processKey = this.createProcessKey('__global__');

      if (!this.activeProcesses.has(processKey)) {
        this.startProcess(processKey, '', filesArray);
      } else {
        // Process already running, move to end (most recently used)
        this.touchProcess(processKey);
      }
    } else {
      projects.forEach((projectName) => {
        const processKey = this.createProcessKey(projectName);

        if (this.activeProcesses.has(processKey)) {
          // Process already running, move to end (most recently used)
          this.touchProcess(processKey);

          this._verbose &&
            output.logSingleLine(
              `Process for project "${projectName}" is already running`
            );
        } else {
          this.startProcess(processKey, projectName, filesArray);
        }
      });
    }

    // Resolve immediately - don't wait for processes to exit
    return Promise.resolve();
  }

  private createProcessKey(projectName: string): string {
    // Create a composite key from project name and command to allow
    // multiple different commands per project (e.g., serve, build --watch, test --watch)
    return `${projectName}::${this.command}`;
  }

  private enforceMaxParallel() {
    while (this.activeProcesses.size >= this.maxParallel) {
      // Kill oldest (first entry in Map)
      const [oldestKey, oldestProcess] = this.activeProcesses.entries().next()
        .value as [string, ChildProcess];

      this._verbose &&
        output.logSingleLine(
          `Killing process for "${oldestKey}" (max parallel limit of ${this.maxParallel} reached)`
        );

      try {
        oldestProcess.kill('SIGTERM');
      } catch (e) {
        // Process might already be dead
      }

      this.activeProcesses.delete(oldestKey);
    }
  }

  private touchProcess(key: string) {
    // Move process to end of Map (most recently used)
    const process = this.activeProcesses.get(key);
    if (process) {
      this.activeProcesses.delete(key);
      this.activeProcesses.set(key, process);
    }
  }

  private startProcess(key: string, projectName: string, filesArray: string[]) {
    this.enforceMaxParallel();

    this._verbose &&
      output.logSingleLine(
        `Starting persistent process for "${key}" with command: ${this.command}`
      );

    const childProcess = spawn(this.command, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      cwd: process.cwd(),
      env: {
        ...process.env,
        [this.projectNameEnv]: projectName,
        [this.fileChangesEnv]: filesArray.join(' '),
      },
      windowsHide: false,
    });

    childProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((line) => {
        if (line.trim()) {
          process.stdout.write(
            `${projectName ? `[${projectName}] ` : ''}${line}\n`
          );
        }
      });
    });

    childProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((line) => {
        if (line.trim()) {
          process.stderr.write(
            `${projectName ? `[${projectName}] ` : ''}${line}\n`
          );
        }
      });
    });

    this.activeProcesses.set(key, childProcess);

    // Clean up when process exits
    childProcess.on('exit', (code) => {
      this._verbose &&
        output.logSingleLine(`Process for "${key}" exited with code ${code}`);
      this.activeProcesses.delete(key);
    });

    childProcess.on('error', (error) => {
      output.error({
        title: `Process error for "${key}"`,
        bodyLines: [error.message],
      });
      this.activeProcesses.delete(key);
    });
  }

  private killAll() {
    this._verbose &&
      output.logSingleLine('Killing all persistent processes...');

    for (const [key, childProcess] of this.activeProcesses.entries()) {
      try {
        childProcess.kill('SIGTERM');
      } catch (e) {
        // Process might already be dead
      }
    }

    this.activeProcesses.clear();
  }
}

export async function watch(args: WatchArguments) {
  const projectReplacementRegex = new RegExp(
    args.projectNameEnvName ?? DEFAULT_PROJECT_NAME_ENV,
    'g'
  );

  if (!daemonClient.enabled()) {
    output.error({
      title:
        'Daemon is not running. The watch command is not supported without the Nx Daemon.',
    });
    process.exit(1);
  }

  if (
    args.includeGlobalWorkspaceFiles &&
    args.command.match(projectReplacementRegex)
  ) {
    output.error({
      title: 'Invalid command',
      bodyLines: [
        'The command you provided has a replacement for projects ($NX_PROJECT_NAME), but you are also including global workspace files.',
        'You cannot use a replacement for projects when including global workspace files because there will be scenarios where there are file changes not associated with a project.',
      ],
    });
    process.exit(1);
  }

  args.verbose &&
    output.logSingleLine('running with args: ' + JSON.stringify(args));
  args.verbose && output.logSingleLine('starting watch process');

  const whatToWatch = args.all ? 'all' : args.projects;

  const executionStrategy = args.executionStrategy ?? 'batch';
  const runner =
    executionStrategy === 'persistent'
      ? new PersistentCommandRunner(
          args.command ?? '',
          args.maxParallel ?? 3,
          args.projectNameEnvName,
          args.fileChangesEnvName
        )
      : new BatchCommandRunner(
          args.command ?? '',
          args.projectNameEnvName,
          args.fileChangesEnvName
        );

  args.verbose &&
    output.logSingleLine(`Using ${executionStrategy} execution strategy`);

  const cleanupHandler = () => {
    args.verbose && output.logSingleLine('Cleaning up before exit...');
    runner.cleanUp();
    process.exit(0);
  };
  process.on('SIGINT', cleanupHandler);
  process.on('SIGTERM', cleanupHandler);

  // Run the command initially if requested
  if (args.initialRun) {
    args.verbose && output.logSingleLine('running command initially...');

    const initialProjects = args.all
      ? [] // When using --all, we don't need to pass specific projects
      : args.projects || [];

    // Execute the initial run
    await runner.enqueue(initialProjects, []);
  }

  await daemonClient.registerFileWatcher(
    {
      watchProjects: whatToWatch,
      includeDependentProjects: args.includeDependentProjects,
      includeGlobalWorkspaceFiles: args.includeGlobalWorkspaceFiles,
    },
    async (err, data) => {
      if (err === 'closed') {
        output.error({
          title: 'Watch connection closed',
          bodyLines: [
            'The daemon has closed the connection to this watch process.',
            'Please restart your watch command.',
          ],
        });
        process.exit(1);
      } else if (err !== null) {
        output.error({
          title: 'Watch error',
          bodyLines: [
            'An error occurred during the watch process:',
            err.message,
          ],
        });
      }

      // Only pass the projects to the queue if the command has a replacement for projects
      if (args.command.match(projectReplacementRegex)) {
        runner.enqueue(data.changedProjects, data.changedFiles);
      } else {
        runner.enqueue([], data.changedFiles);
      }
    }
  );
  args.verbose && output.logSingleLine('watch process waiting...');
}
