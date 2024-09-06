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
        title: `Running ${formatTargetsAndProjects(
          this.projectNames,
          this.args.targets,
          this.tasks
        )} failed`,
        bodyLines,
      });
    }
  }

  endTasks(taskResults: TaskResult[]): void {
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
    const args = getPrintableCommandArgsForTask(task);
    if (
      this.args.verbose ||
      status === 'success' ||
      status === 'failure' ||
      task.target.project === this.initiatingProject
    ) {
      output.logCommandOutput(args.join(' '), status, terminalOutput);
    } else {
      /**
       * Do not show the terminal output in the case where it is not the initiating project and verbose is not set,
       * but still print the command that was run and its status (so that cache hits can still be traced).
       */
      output.logCommandOutput(args.join(' '), status, '');
    }
  }
}
