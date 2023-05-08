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

class BatchCommandRunner {
  running = false;

  pendingProjects = new Set<string>();
  pendingFiles = new Set<string>();

  private get _verbose() {
    return process.env.NX_VERBOSE_LOGGING === 'true';
  }

  private get hasPending() {
    return this.pendingProjects.size > 0 || this.pendingFiles.size > 0;
  }

  constructor(
    private command: string,
    private projectNameEnv: string = DEFAULT_PROJECT_NAME_ENV,
    private fileChangesEnv: string = DEFAULT_FILE_CHANGES_ENV
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

  async process() {
    if (!this.running && this.hasPending) {
      this.running = true;

      // process all pending commands together
      const envs = this.createCommandEnvironments();

      this._verbose &&
        output.logSingleLine(
          'about to run commands with these environments: ' +
            JSON.stringify(envs)
        );

      return this.run(envs).then(() => {
        this.running = false;
        this._verbose &&
          output.logSingleLine('running complete, processing the next batch');
        this.process();
      });
    } else {
      this._verbose &&
        this.running &&
        output.logSingleLine('waiting for commands to finish executing');

      this._verbose &&
        !this.hasPending &&
        output.logSingleLine('no more commands to process');
    }
  }

  createCommandEnvironments(): Record<string, string>[] {
    const commandsToRun = [];

    if (this.pendingProjects.size > 0) {
      this.pendingProjects.forEach((projectName) => {
        commandsToRun.push({
          [this.projectNameEnv]: projectName,
          [this.fileChangesEnv]: Array.from(this.pendingFiles).join(' '),
        });
      });
    } else {
      commandsToRun.push({
        [this.projectNameEnv]: '',
        [this.fileChangesEnv]: Array.from(this.pendingFiles).join(' '),
      });
    }

    this.pendingProjects.clear();
    this.pendingFiles.clear();

    return commandsToRun;
  }

  async run(envs: Record<string, string>[]) {
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
    );
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
