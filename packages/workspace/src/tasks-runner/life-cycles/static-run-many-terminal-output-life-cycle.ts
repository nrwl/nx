import type { Task } from '@nrwl/devkit';
import { output } from '../../utilities/output';
import { TaskStatus } from '../tasks-runner';
import { getCommandArgsForTask } from '../utils';
import type { LifeCycle } from '../life-cycle';

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
  allCompletedTasks = new Set<Task>();

  constructor(
    private readonly projectNames: string[],
    private readonly tasks: Task[],
    private readonly args: {
      target?: string;
      configuration?: string;
    },
    private readonly taskOverrides: any
  ) {}

  startCommand(): void {
    if (this.projectNames.length <= 0) {
      let description = `with "${this.args.target}"`;
      if (this.args.configuration) {
        description += ` that are configured for "${this.args.configuration}"`;
      }
      output.logSingleLine(`No projects ${description} were run`);
      return;
    }

    const bodyLines = this.projectNames.map(
      (affectedProject) => ` ${output.colors.gray('-')} ${affectedProject}`
    );
    if (Object.keys(this.taskOverrides).length > 0) {
      bodyLines.push('');
      bodyLines.push(`${output.colors.gray('With flags:')}`);
      Object.entries(this.taskOverrides)
        .map(([flag, value]) => `  --${flag}=${value}`)
        .forEach((arg) => bodyLines.push(arg));
    }

    let title = `Running target ${output.bold(
      this.args.target
    )} for ${output.bold(this.projectNames.length)} project(s)`;
    const dependentTasksCount = this.tasks.length - this.projectNames.length;
    if (dependentTasksCount > 0) {
      title += ` and ${output.bold(
        dependentTasksCount
      )} task(s) they depend on`;
    }
    title += ':';

    output.log({
      color: 'cyan',
      title,
      bodyLines,
    });

    output.addVerticalSeparatorWithoutNewLines('cyan');
  }

  endCommand(): void {
    output.addNewline();

    if (this.failedTasks.length === 0) {
      output.addVerticalSeparatorWithoutNewLines('green');

      const bodyLines =
        this.cachedTasks.length > 0
          ? [
              output.colors.gray(
                `Nx read the output from the cache instead of running the command for ${this.cachedTasks.length} out of ${this.tasks.length} tasks.`
              ),
            ]
          : [];

      output.success({
        title: `Successfully ran target ${output.bold(
          this.args.target
        )} for ${output.bold(this.projectNames.length)} projects`,
        bodyLines,
      });
    } else {
      output.addVerticalSeparatorWithoutNewLines('red');

      const bodyLines = [];
      const skippedTasks = this.skippedTasks();
      if (skippedTasks.length > 0) {
        bodyLines.push(
          output.colors.gray(
            'Tasks not run because their dependencies failed:'
          ),
          '',
          ...skippedTasks.map(
            (task) => `${output.colors.gray('-')} ${task.id}`
          ),
          ''
        );
      }
      bodyLines.push(
        output.colors.gray('Failed tasks:'),
        '',
        ...[...this.failedTasks.values()].map(
          (task) => `${output.colors.gray('-')} ${task.id}`
        )
      );
      output.error({
        title: `Running target "${this.args.target}" failed`,
        bodyLines,
      });
    }
  }

  private skippedTasks() {
    return this.tasks.filter((t) => !this.allCompletedTasks.has(t));
  }

  endTasks(
    taskResults: { task: Task; status: TaskStatus; code: number }[]
  ): void {
    for (let t of taskResults) {
      this.allCompletedTasks.add(t.task);
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
    cacheStatus: TaskStatus,
    terminalOutput: string
  ) {
    const args = getCommandArgsForTask(task);
    output.logCommand(
      `${args.filter((a) => a !== 'run').join(' ')}`,
      cacheStatus
    );
    output.addNewline();
    process.stdout.write(terminalOutput);
  }
}
