import type { Task } from '@nrwl/devkit';
import { output, TaskCacheStatus } from '../../utilities/output';
import { getCommandArgsForTask } from '../utils';
import type { LifeCycle } from '../life-cycle';

export class EmptyTerminalOutputLifeCycle implements LifeCycle {
  printTaskTerminalOutput(
    task: Task,
    cacheStatus: TaskCacheStatus,
    terminalOutput: string
  ) {
    if (cacheStatus === TaskCacheStatus.NoCache) {
      const args = getCommandArgsForTask(task);
      output.logCommand(
        `${args.filter((a) => a !== 'run').join(' ')}`,
        cacheStatus
      );
      output.addNewline();
      process.stdout.write(terminalOutput);
    }
  }
}
