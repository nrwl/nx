import { output } from '../../utils/output';
import { TaskStatus } from '../tasks-runner';
import { getPrintableCommandArgsForTask } from '../utils';
import type { LifeCycle, TaskResult } from '../life-cycle';
import { Task } from '../../config/task-graph';
import { formatFlags, formatTargetsAndProjects } from './formatting-utils';

/**
 * The following life cycle's outputs are static, meaning no previous content
 * is rewritten or modified as new outputs are added. It is therefore intended
 * for use in CI environments.
 *
 * For the common case of a user executing a command on their local machine,
 * the dynamic equivalent of this life cycle is usually preferable.
 */
export class StaticRunManyTerminalOutputLifeCycle implements LifeCycle {
  failedTasks = [] as Task[];
  cachedTasks = [] as Task[];
  stoppedTasks = [] as Task[];
  allCompletedTasks = new Map<string, Task>();

  constructor(
    private readonly projectNames: string[],
    private readonly tasks: Task[],
    private readonly args: {
      targets?: string[];
      configuration?: string;
      verbose?: boolean;
    },
    private readonly taskOverrides: any
  ) {}

  startCommand(): void {
    if (this.tasks.length === 0) {
      return;
    }
    if (this.projectNames.length <= 0) {
      output.logSingleLine(
        `No projects with ${formatTargetsAndProjects(
          this.projectNames,
          this.args.targets,
          this.tasks
        )} were run`
      );
      return;
    }

    const bodyLines = this.projectNames.map(
      (affectedProject) => `${output.dim('-')} ${affectedProject}`
    );
    const filteredOverrides = Object.entries(this.taskOverrides).filter(
      // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
      ([flag]) => flag !== 'nxReleaseVersionData'
    );
    if (filteredOverrides.length > 0) {
      bodyLines.push('');
      bodyLines.push(`${output.dim('With additional flags:')}`);
      filteredOverrides
        .map(([flag, value]) => formatFlags('', flag, value))
        .forEach((arg) => bodyLines.push(arg));
    }

    const title = `Running ${formatTargetsAndProjects(
      this.projectNames,
      this.args.targets,
      this.tasks
    )}:`;

    output.log({
      color: 'cyan',
      title,
      bodyLines,
    });

    output.addVerticalSeparatorWithoutNewLines('cyan');
  }

  endCommand(): void {
    output.addNewline();

    if (this.tasks.length === 0) {
      output.logSingleLine(`No tasks were run`);
      return;
    }
    if (this.failedTasks.length === 0) {
      output.addVerticalSeparatorWithoutNewLines('green');

      const bodyLines =
        this.cachedTasks.length > 0
          ? [
              output.dim(
                `Nx read the output from the cache instead of running the command for ${this.cachedTasks.length} out of ${this.tasks.length} tasks.`
              ),
            ]
          : [];
      bodyLines.push(...this.tasksNotRunSummary());

      output.success({
        title: `Successfully ran ${formatTargetsAndProjects(
          this.projectNames,
          this.args.targets,
          this.tasks
        )}`,
        bodyLines,
      });
    } else {
      output.addVerticalSeparatorWithoutNewLines('red');

      const bodyLines = [];
      const skippedTasks = this.skippedTasks();
      if (skippedTasks.length > 0) {
        bodyLines.push(
          output.dim(
            'Tasks not run because their dependencies failed or --nx-bail=true:'
          ),
          '',
          ...skippedTasks.map((task) => `${output.dim('-')} ${task.id}`),
          ''
        );
      }
      if (this.stoppedTasks.length > 0) {
        bodyLines.push(
          output.dim('Tasks stopped before they finished:'),
          '',
          ...this.stoppedTasks.map((task) => `${output.dim('-')} ${task.id}`),
          ''
        );
      }
      bodyLines.push(
        output.dim('Failed tasks:'),
        '',
        ...[...this.failedTasks.values()].map(
          (task) => `${output.dim('-')} ${task.id}`
        )
      );
      output.error({
        title: `Running ${formatTargetsAndProjects(
          this.projectNames,
          this.args.targets,
          this.tasks
        )} failed`,
        bodyLines,
      });
    }
  }

  /**
   * Tasks with a `skipped` status are never reported through `endTasks`, so
   * they are derived by subtracting everything that did complete.
   */
  private skippedTasks() {
    return this.tasks.filter((t) => !this.allCompletedTasks.has(t.id));
  }

  /**
   * Tasks that never produced output worth printing are summarized as counts,
   * with their names available behind --verbose.
   */
  private tasksNotRunSummary(): string[] {
    const skippedTasks = this.skippedTasks();
    const counts: string[] = [];
    if (skippedTasks.length > 0) {
      counts.push(`${skippedTasks.length} skipped`);
    }
    if (this.stoppedTasks.length > 0) {
      counts.push(`${this.stoppedTasks.length} stopped`);
    }
    if (counts.length === 0) {
      return [];
    }

    const lines = [output.dim(counts.join(', '))];
    if (this.args.verbose) {
      lines.push(
        '',
        ...[...skippedTasks, ...this.stoppedTasks].map(
          (task) => `${output.dim('-')} ${task.id}`
        )
      );
    }
    return lines;
  }

  endTasks(taskResults: TaskResult[]): void {
    for (let t of taskResults) {
      this.allCompletedTasks.set(t.task.id, t.task);
      if (t.status === 'failure') {
        this.failedTasks.push(t.task);
      } else if (t.status === 'stopped') {
        this.stoppedTasks.push(t.task);
      } else if (t.status === 'local-cache') {
        this.cachedTasks.push(t.task);
      } else if (t.status === 'local-cache-kept-existing') {
        this.cachedTasks.push(t.task);
      } else if (t.status === 'remote-cache') {
        this.cachedTasks.push(t.task);
      }
    }
  }

  printTaskTerminalOutput(
    task: Task,
    taskStatus: TaskStatus,
    terminalOutput: string
  ) {
    // Counted in the end of run summary instead.
    if (taskStatus === 'skipped' || taskStatus === 'stopped') {
      return;
    }

    const args = getPrintableCommandArgsForTask(task);
    if (this.args.verbose || taskStatus === 'failure') {
      output.logCommandOutput(args.join(' '), taskStatus, terminalOutput);
    } else {
      output.logCommandSummary(args.join(' '), taskStatus);
    }
  }
}
