import type { Task } from '@nrwl/devkit';
import { output, TaskCacheStatus } from '../utilities/output';
import { LifeCycle } from './life-cycle';
import { TaskStatus } from './tasks-runner';
import { getCommandArgsForTask } from './utils';

export class RunOneTerminalOutputLifeCycle implements LifeCycle {
  failedTasks = [] as Task[];
  cachedTasks = [] as Task[];
  skippedTasks = [] as Task[];

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
        title: `${output.colors.gray('Running target')} ${
          this.args.target
        } ${output.colors.gray('for project')} ${
          this.initiatingProject
        } ${output.colors.gray(
          `and`
        )} ${numberOfDeps} task(s) ${output.colors.gray(`that it depends on.`)}
        `,
      });
      output.addVerticalSeparatorWithoutNewLines();
    }
  }

  endCommand(): void {
    // Silent for a single task
    if (process.env.NX_INVOKED_BY_RUNNER) {
      return;
    }
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
      const bodyLines = [
        output.colors.gray('Failed tasks:'),
        '',
        ...this.failedTasks.map(
          (task) => `${output.colors.gray('-')} ${task.id}`
        ),
        '',
        `${output.colors.gray(
          'Hint: run the command with'
        )} --verbose ${output.colors.gray('for more details.')}`,
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
      } else if (t.status === 'skipped') {
        this.skippedTasks.push(t.task);
      } else if (t.status === 'cache') {
        this.cachedTasks.push(t.task);
      }
    }
  }

  printTaskTerminalOutput(
    task: Task,
    cacheStatus: TaskCacheStatus,
    terminalOutput: string
  ) {
    if (
      cacheStatus === TaskCacheStatus.NoCache ||
      task.target.project === this.initiatingProject
    ) {
      const args = getCommandArgsForTask(task);
      output.logCommand(`nx ${args.join(' ')}`, cacheStatus);
      process.stdout.write(terminalOutput);
    }
  }
}
