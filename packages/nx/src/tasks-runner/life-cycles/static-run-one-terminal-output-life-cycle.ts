import { output } from '../../utils/output';
import { TaskStatus } from '../tasks-runner';
import { getPrintableCommandArgsForTask } from '../utils';
import type { LifeCycle } from '../life-cycle';
import { Task } from 'nx/src/shared/tasks';

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

  constructor(
    private readonly initiatingProject: string,
    private readonly projectNames: string[],
    private readonly tasks: Task[],
    private readonly args: {
      target?: string;
      configuration?: string;
    }
  ) {}

  startCommand(): void {
    if (process.env.NX_INVOKED_BY_RUNNER) {
      return;
    }
    const numberOfDeps = this.tasks.length - 1;

    if (numberOfDeps > 0) {
      output.log({
        color: 'cyan',
        title: `Running target ${output.bold(
          this.args.target
        )} for project ${output.bold(this.initiatingProject)} and ${output.bold(
          numberOfDeps
        )} task(s) it depends on`,
      });
      output.addVerticalSeparatorWithoutNewLines('cyan');
    }
  }

  endCommand(): void {
    // Silent for a single task
    if (process.env.NX_INVOKED_BY_RUNNER) {
      return;
    }
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

      output.success({
        title: `Successfully ran target ${output.bold(
          this.args.target
        )} for project ${output.bold(this.initiatingProject)}`,
        bodyLines,
      });
    } else {
      output.addVerticalSeparatorWithoutNewLines('red');

      const bodyLines = [
        output.dim('Failed tasks:'),
        '',
        ...this.failedTasks.map((task) => `${output.dim('-')} ${task.id}`),
        '',
        `${output.dim('Hint: run the command with')} --verbose ${output.dim(
          'for more details.'
        )}`,
      ];
      output.error({
        title: `Running target "${this.initiatingProject}:${this.args.target}" failed`,
        bodyLines,
      });
    }
  }

  endTasks(
    taskResults: { task: Task; status: TaskStatus; code: number }[]
  ): void {
    for (let t of taskResults) {
      if (t.status === 'failure') {
        this.failedTasks.push(t.task);
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
    if (
      status === 'success' ||
      status === 'failure' ||
      task.target.project === this.initiatingProject
    ) {
      const args = getPrintableCommandArgsForTask(task);
      output.logCommand(args.join(' '), status);
      output.addNewline();
      process.stdout.write(terminalOutput);
    }
  }
}
