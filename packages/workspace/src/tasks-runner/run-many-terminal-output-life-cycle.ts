import type { Task } from '@nrwl/devkit';
import { output, TaskCacheStatus } from '../utilities/output';
import { LifeCycle } from './life-cycle';
import { TaskStatus } from './tasks-runner';
import { getCommandArgsForTask } from './utils';

export class RunManyTerminalOutputLifeCycle implements LifeCycle {
  failedTasks = [] as Task[];
  cachedTasks = [] as Task[];
  skippedTasks = [] as Task[];

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
      (affectedProject) => `${output.colors.gray('-')} ${affectedProject}`
    );
    if (Object.keys(this.taskOverrides).length > 0) {
      bodyLines.push('');
      bodyLines.push(`${output.colors.gray('With flags:')}`);
      Object.entries(this.taskOverrides)
        .map(([flag, value]) => `  --${flag}=${value}`)
        .forEach((arg) => bodyLines.push(arg));
    }

    let title = `${output.colors.gray('Running target')} ${
      this.args.target
    } ${output.colors.gray(`for`)} ${this.projectNames.length} project(s)`;
    const dependentTasksCount = this.tasks.length - this.projectNames.length;
    if (dependentTasksCount > 0) {
      title += ` ${output.colors.gray(`and`)} ${
        this.tasks.length - this.projectNames.length
      } task(s) ${output.colors.gray(`they depend on`)}`;
    }
    title += ':';

    output.log({
      title,
      bodyLines,
    });

    output.addVerticalSeparatorWithoutNewLines();
  }

  endCommand(): void {
    output.addNewline();
    output.addVerticalSeparatorWithoutNewLines();

    if (this.failedTasks.length === 0) {
      const bodyLines =
        this.cachedTasks.length > 0
          ? [
              output.colors.gray(
                `Nx read the output from cache instead of running the command for ${this.cachedTasks.length} out of ${this.tasks.length} tasks.`
              ),
            ]
          : [];

      output.success({
        title: `Running target "${this.args.target}" succeeded`,
        bodyLines,
      });
    } else {
      const bodyLines = [];
      if (this.skippedTasks.length > 0) {
        bodyLines.push(
          output.colors.gray(
            'Tasks not run because their dependencies failed:'
          ),
          '',
          ...this.skippedTasks.map(
            (task) => `${output.colors.gray('-')} ${task.id}`
          ),
          ''
        );
      }
      bodyLines.push(
        output.colors.gray('Failed tasks:'),
        '',
        ...this.failedTasks.map(
          (task) => `${output.colors.gray('-')} ${task.id}`
        )
      );
      output.error({
        title: `Running target "${this.args.target}" failed`,
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
      } else if (t.status === 'skipped') {
        this.skippedTasks.push(t.task);
      } else if (t.status === 'local-cache') {
        this.cachedTasks.push(t.task);
      } else if (t.status === 'remote-cache') {
        this.cachedTasks.push(t.task);
      }
    }
  }

  printTaskTerminalOutput(
    task: Task,
    cacheStatus: TaskCacheStatus,
    terminalOutput: string
  ) {
    const args = getCommandArgsForTask(task);
    output.logCommand(`nx ${args.join(' ')}`, cacheStatus);
    process.stdout.write(terminalOutput);
  }
}
