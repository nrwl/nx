import type { Task } from '@nrwl/devkit';
import { output } from '../../utilities/output';
import { getCommandArgsForTask } from '../utils';
import type { LifeCycle } from '../life-cycle';
import { TaskStatus } from '@nrwl/workspace/src/tasks-runner/tasks-runner';

export class EmptyTerminalOutputLifeCycle implements LifeCycle {
  printTaskTerminalOutput(
    task: Task,
    cacheStatus: TaskStatus,
    terminalOutput: string
  ) {
    if (
      cacheStatus === 'success' ||
      cacheStatus === 'failure' ||
      cacheStatus === 'skipped'
    ) {
      const args = getCommandArgsForTask(task);
      output.logCommand(args.join(' '), cacheStatus);
      output.addNewline();
      process.stdout.write(terminalOutput);
    }
  }
}
