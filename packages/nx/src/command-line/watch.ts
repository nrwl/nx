import { exec, execSync, spawn } from 'child_process';
import { ChangedFile, daemonClient } from '../daemon/client/client';
import { output } from '../utils/output';
import { PromisedBasedQueue } from '../utils/promised-based-queue';

export interface WatchArguments {
  project?: string;
  projects?: string[];
  all?: boolean;
  includeDependentProjects?: boolean;
  includeGlobalWorkspaceFiles?: boolean;
  verbose?: boolean;
  callback?: string;
}

class BatchQueue {
  pendingCommands: Set<string> = new Set();
  running = false;

  private get _verbose() {
    return process.env.NX_VERBOSE_LOGGING === 'true';
  }

  /**
   * Adds a command to an internal set so that duplicate commands are not executed
   * @param commands - a string or an array of strings to be executed
   * @returns
   */
  enqueue(commands: string[] | string) {
    if (typeof commands === 'string') {
      this.pendingCommands.add(commands);
    } else {
      commands.forEach((command) => this.pendingCommands.add(command));
    }
    return this.process();
  }

  async process() {
    if (!this.running && this.pendingCommands.size > 0) {
      this.running = true;

      // process all pending commands together
      const commands = Array.from(this.pendingCommands);
      this.pendingCommands.clear();

      this._verbose &&
        output.logSingleLine('about to run these commands: ' + commands);

      return this.run(commands).then(() => {
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
        this.pendingCommands.size == 0 &&
        output.logSingleLine('no more commands to process');
    }
  }

  async run(commands: string[]) {
    return Promise.all(
      commands.map((command) => {
        return new Promise<void>((resolve, reject) => {
          const commandExec = spawn(command, {
            stdio: 'inherit',
            shell: true,
            cwd: process.cwd(),
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

const batchQueue = new BatchQueue();

const fileReplacementRegex = /&2/g;
const projectReplacementRegex = /&1/g;

export async function watch(args: WatchArguments) {
  if (args.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  if (args.project) {
    (args.projects ??= []).push(args.project);
  }

  if (
    args.includeGlobalWorkspaceFiles &&
    args.callback.match(projectReplacementRegex)
  ) {
    output.error({
      title: 'Invalid command',
      bodyLines: [
        'The command you provided has a replacement for projects (&1), but you are also including global workspace files.',
        'You cannot use a replacement for projects when including global workspace files because there will be scenarios where there are file changes not associated with a project.',
      ],
    });
    process.exit(1);
  }

  const whatToWatch = args.all ? 'all' : args.projects;

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

      const command = args.callback ?? '';

      if (
        !command.match(fileReplacementRegex) &&
        !command.match(projectReplacementRegex)
      ) {
        batchQueue.enqueue(command);
      } else {
        batchQueue.enqueue(
          buildCommands(command, data.changedFiles, data.changedProjects)
        );
      }
    }
  );
}

export function buildCommands(
  command: string,
  changedFiles: ChangedFile[],
  changedProjects: string[]
) {
  const commandsToExecute = [];
  const replaceProject = (commandToReplace): string[] => {
    const projectReplacements = [];
    for (const project of changedProjects) {
      projectReplacements.push(
        commandToReplace.replace(projectReplacementRegex, project)
      );
    }

    return projectReplacements;
  };

  /**
   * if the command  has both a replacement for files and projects, we need to replace the placeholders in the command for each file and project
   * Since we always get files, we'll go through those first
   */
  if (command.match(fileReplacementRegex)) {
    for (const { path } of changedFiles) {
      const fileReplacement = command.replace(fileReplacementRegex, path);
      if (command.match(projectReplacementRegex)) {
        commandsToExecute.push(...replaceProject(fileReplacement));
      } else {
        commandsToExecute.push(fileReplacement);
      }
    }
  } else if (command.match(projectReplacementRegex)) {
    commandsToExecute.push(...replaceProject(command));
  } else {
    commandsToExecute.push(command);
  }

  return commandsToExecute;
}
