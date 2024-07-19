import { spawn } from 'child_process';
import { ChangedFile, daemonClient } from '../../daemon/client/client';
import { output } from '../../utils/output';

export interface WatchArguments {
  projects?: string[];
  all?: boolean;
  includeDependentProjects?: boolean;
  includeGlobalWorkspaceFiles?: boolean;
  verbose?: boolean;
  command?: string;

  projectNameEnvName?: string;
  fileChangesEnvName?: string;
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

export async function watch(args: WatchArguments) {
  const projectReplacementRegex = new RegExp(
    args.projectNameEnvName ?? DEFAULT_PROJECT_NAME_ENV,
    'g'
  );

  if (args.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  if (daemonClient.enabled()) {
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

  const batchQueue = new BatchCommandRunner(
    args.command ?? '',
    args.projectNameEnvName,
    args.fileChangesEnvName
  );

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
        batchQueue.enqueue(data.changedProjects, data.changedFiles);
      } else {
        batchQueue.enqueue([], data.changedFiles);
      }
    }
  );
  args.verbose && output.logSingleLine('watch process waiting...');
}
