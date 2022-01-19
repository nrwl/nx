import type { Task } from '@nrwl/devkit';
import { output, TaskCacheStatus } from '../../utilities/output';
import { getCommandArgsForTask } from '../utils';
import type { LifeCycle } from './life-cycle';

export class EmptyTerminalOutputLifeCycle implements LifeCycle {
  printTaskTerminalOutput(
    task: Task,
    cacheStatus: TaskCacheStatus,
    terminalOutput: string
  ) {
    if (cacheStatus === TaskCacheStatus.NoCache) {
      const args = getCommandArgsForTask(task);
      output.logCommand(`nx ${args.join(' ')}`, cacheStatus);
      process.stdout.write(terminalOutput);
    }
  }
}
