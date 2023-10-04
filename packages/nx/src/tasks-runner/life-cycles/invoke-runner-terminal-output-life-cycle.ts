import { output } from '../../utils/output';
import { TaskStatus } from '../tasks-runner';
import { getPrintableCommandArgsForTask } from '../utils';
import type { LifeCycle } from '../life-cycle';
import { Task } from '../../config/task-graph';
import { formatFlags, formatTargetsAndProjects } from './formatting-utils';

export class InvokeRunnerTerminalOutputLifeCycle implements LifeCycle {
  failedTasks = [] as Task[];
  cachedTasks = [] as Task[];

  constructor(private readonly tasks: Task[]) {}

  startCommand(): void {
    output.log({
      color: 'cyan',
      title: `Running ${this.tasks.length} tasks:`,
      bodyLines: this.tasks.map(
        (task) =>
          `- Task ${task.id} ${
            task.overrides.__overrides_unparsed__.length > 0
              ? `Overrides: ${task.overrides.__overrides_unparsed__.join(' ')}`
              : ''
          }`
      ),
    });

    output.addVerticalSeparatorWithoutNewLines('cyan');
  }

  endCommand(): void {
    output.addNewline();
    const taskIds = this.tasks.map((task) => {
      const cached = this.cachedTasks.indexOf(task) !== -1;
      const failed = this.failedTasks.indexOf(task) !== -1;
      return `- Task ${task.id} ${
        task.overrides.__overrides_unparsed__.length > 0
          ? `Overrides: ${task.overrides.__overrides_unparsed__.join(' ')}`
          : ''
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
    cacheStatus: TaskStatus,
    terminalOutput: string
  ) {
    const args = getPrintableCommandArgsForTask(task);
    output.logCommand(args.join(' '), cacheStatus);
    output.addNewline();
    process.stdout.write(terminalOutput);
  }
}
