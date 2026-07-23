import { output } from '../../utils/output';
import { TaskStatus } from '../tasks-runner';
import { getPrintableCommandArgsForTask } from '../utils';
import type { LifeCycle, TaskResult } from '../life-cycle';
import { Task } from '../../config/task-graph';
import { formatTargetsAndProjects } from './formatting-utils';

/**
 * The following life cycle's outputs are static, meaning no previous content
 * is rewritten or modified as new outputs are added. It is therefore intended
 * for use in CI environments.
 *
 * For the common case of a user executing a command on their local machine,
 * the dynamic equivalent of this life cycle is usually preferable.
 */
export class StaticRunOneTerminalOutputLifeCycle implements LifeCycle {
  failedTasks = [] as Task[];
  cachedTasks = [] as Task[];
  stoppedTasks = [] as Task[];
  allCompletedTasks = new Map<string, Task>();

  constructor(
    private readonly initiatingProject: string,
    private readonly projectNames: string[],
    private readonly tasks: Task[],
    private readonly args: {
      targets?: string[];
      configuration?: string;
      verbose?: boolean;
    }
  ) {}

  startCommand(): void {
    const numberOfDeps = this.tasks.length - 1;
    const title = `Running ${formatTargetsAndProjects(
      this.projectNames,
      this.args.targets,
      this.tasks
    )}:`;
    if (numberOfDeps > 0) {
      output.log({
        color: 'cyan',
        title,
      });
      output.addVerticalSeparatorWithoutNewLines('cyan');
    }
  }

  endCommand(): void {
    output.addNewline();

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

      const bodyLines: string[] = [];
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
        ...this.failedTasks.map((task) => `${output.dim('-')} ${task.id}`),
        '',
        `${output.dim('Hint: run the command with')} --verbose ${output.dim(
          'for more details.'
        )}`
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
    status: TaskStatus,
    terminalOutput: string
  ) {
    // Counted in the end of run summary instead.
    if (status === 'skipped' || status === 'stopped') {
      return;
    }

    const args = getPrintableCommandArgsForTask(task);
    if (
      this.args.verbose ||
      status === 'failure' ||
      task.target.project === this.initiatingProject
    ) {
      /**
       * The task that was actually asked for always shows its full output, even
       * on success — printing nothing for `nx build myapp` would be surprising.
       */
      output.logCommandOutput(args.join(' '), status, terminalOutput);
    } else {
      /**
       * Dependency tasks collapse to a single line, so that a cache hit or a
       * success can still be traced without carrying its whole log.
       */
      output.logCommandSummary(args.join(' '), status);
    }
  }
}
