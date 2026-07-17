import { output } from '../../utils/output';
import { TaskStatus } from '../tasks-runner';
import {
  getPrintableCommandArgsForTask,
  getUnparsedOverrideArgs,
} from '../utils';
import type { LifeCycle, TaskResult } from '../life-cycle';
import { Task } from '../../config/task-graph';

export class InvokeRunnerTerminalOutputLifeCycle implements LifeCycle {
  failedTasks = [] as Task[];
  cachedTasks = [] as Task[];

  constructor(private readonly tasks: Task[]) {}

  startCommand(): void {
    output.log({
      color: 'cyan',
      title: `Running ${this.tasks.length} tasks:`,
      bodyLines: this.tasks.map((task) => {
        const unparsed = getUnparsedOverrideArgs(task);
        return `- Task ${task.id} ${
          unparsed.length > 0 ? `Overrides: ${unparsed.join(' ')}` : ''
        }`;
      }),
    });

    output.addVerticalSeparatorWithoutNewLines('cyan');
  }

  endCommand(): void {
    output.addNewline();
    const taskIds = this.tasks.map((task) => {
      const cached = this.cachedTasks.indexOf(task) !== -1;
      const failed = this.failedTasks.indexOf(task) !== -1;
      const unparsed = getUnparsedOverrideArgs(task);
      return `- Task ${task.id} ${
        unparsed.length > 0 ? `Overrides: ${unparsed.join(' ')}` : ''
      } ${cached ? 'CACHED' : ''} ${failed ? 'FAILED' : ''}`;
    });
    if (this.failedTasks.length === 0) {
      output.addVerticalSeparatorWithoutNewLines('green');
      output.success({
        title: `Successfully ran ${this.tasks.length} tasks:`,
        bodyLines: taskIds,
      });
    } else {
      output.addVerticalSeparatorWithoutNewLines('red');
      output.error({
        title: `Ran ${this.tasks.length} tasks:`,
        bodyLines: taskIds,
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
    cacheStatus: TaskStatus,
    terminalOutput: string
  ) {
    const args = getPrintableCommandArgsForTask(task);
    output.logCommandOutput(args.join(' '), cacheStatus, terminalOutput);
  }
}
