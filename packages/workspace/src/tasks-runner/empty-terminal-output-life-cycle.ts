import type { Task } from '@nrwl/devkit';
import { output, TaskCacheStatus } from '../utilities/output';
import { LifeCycle } from './life-cycle';
import { getCommandArgsForTask } from './utils';

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
