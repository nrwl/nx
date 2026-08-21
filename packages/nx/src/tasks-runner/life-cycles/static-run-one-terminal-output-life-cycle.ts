import { output, printsFullTaskOutput } from '../../utils/output';
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
  private collapsedTasks = 0;
  /** Stopped tasks that produced output; a batch-stopped task has none. */
  private stoppedTasksWithOutput = 0;

  constructor(
    private readonly initiatingProject: string,
    private readonly projectNames: string[],
    private readonly tasks: Task[],
    private readonly args: {
      targets?: string[];
      configuration?: string;
      verbose?: boolean;
      outputStyle?: string;
    }
  ) {}

  /**
   * Whether this run prints every task's output in full rather than collapsing
   * the ones that succeeded.
   */
  private get printsFullOutput(): boolean {
    return printsFullTaskOutput(this.args);
  }

  /**
   * Tells the reader that output was withheld, so a task that succeeded while
   * printing something worth reading is not silently swallowed.
   */
  private hiddenOutputHint(): string[] {
    const withheld: string[] = [];
    if (this.collapsedTasks > 0) {
      withheld.push(
        `${this.collapsedTasks} successful ${
          this.collapsedTasks === 1 ? 'task' : 'tasks'
        }`
      );
    }
    // A stopped task's partial output is what diagnoses a hang, and it is
    // dropped by default, so say so even when nothing collapsed.
    if (this.stoppedTasksWithOutput > 0) {
      withheld.push(
        `${this.stoppedTasksWithOutput} stopped ${
          this.stoppedTasksWithOutput === 1 ? 'task' : 'tasks'
        }`
      );
    }
    if (this.printsFullOutput || withheld.length === 0) {
      return [];
    }
    const total = this.collapsedTasks + this.stoppedTasksWithOutput;
    return [
      '',
      `${output.dim(
        `Output of ${withheld.join(' and ')} ${
          total === 1 && withheld.length === 1 ? 'was' : 'were'
        } not shown. Run with`
      )} --verbose ${output.dim('or')} --output-style=static ${output.dim(
        'to see it.'
      )}`,
    ];
  }

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

    // A stopped task was killed mid-flight, so the run did not complete even
    // though nothing outright failed — matching run-many and didCommandComplete.
    if (this.failedTasks.length === 0 && this.stoppedTasks.length === 0) {
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
      bodyLines.push(...this.hiddenOutputHint());

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
      if (this.failedTasks.length > 0) {
        bodyLines.push(
          output.dim('Failed tasks:'),
          '',
          ...this.failedTasks.map((task) => `${output.dim('-')} ${task.id}`),
          ''
        );
      }
      bodyLines.push(...this.hiddenOutputHint());
      bodyLines.push(
        `${output.dim('Hint: run the command with')} --verbose ${output.dim(
          'for more details.'
        )}`
      );
      const targets = formatTargetsAndProjects(
        this.projectNames,
        this.args.targets,
        this.tasks
      );
      output.error({
        title:
          this.failedTasks.length > 0
            ? `Running ${targets} failed`
            : `Running ${targets} did not complete`,
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
    if (this.printsFullOutput) {
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
        // A batch-stopped task is reported with no output at all, so counting
        // it would have the hint promise something --verbose cannot show.
        if (t.terminalOutput) {
          this.stoppedTasksWithOutput++;
        }
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
    const args = getPrintableCommandArgsForTask(task);
    if (
      this.printsFullOutput ||
      status === 'failure' ||
      task.target.project === this.initiatingProject
    ) {
      /**
       * The task that was actually asked for always shows its full output, even
       * on success — printing nothing for `nx build myapp` would be surprising.
       * A stopped task's partial output is shown under --verbose or
       * --output-style=static (what diagnoses a hang); it is dropped on the
       * default path below.
       */
      output.logCommandOutput(args.join(' '), status, terminalOutput);
      return;
    }

    // Named in the end of run summary instead; output not shown by default.
    if (status === 'skipped' || status === 'stopped') {
      return;
    }

    /**
     * Dependency tasks collapse to a single line, so that a cache hit or a
     * success can still be traced without carrying its whole log.
     */
    this.collapsedTasks++;
    output.logCommandSummary(args.join(' '), status);
  }
}
