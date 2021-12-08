import type { Task } from '@nrwl/devkit';
import { TaskCacheStatus } from '../../utilities/output';
import { LifeCycle, TaskResult } from '../life-cycle';

export interface InkRunManyLifeCycleOnStartCommandParams {
  projectNames: string[];
  tasks: Task[];
  args: { target?: string; configuration?: string };
}

export class InkRunManyLifeCycle implements LifeCycle {
  callbacks: {
    onStartCommand: (params: InkRunManyLifeCycleOnStartCommandParams) => void;
    onStartTasks: (tasks: Task[]) => void;
    onEndTasks: (taskResults: TaskResult[]) => void;
    onPrintTaskTerminalOutput: (
      task: Task,
      cacheStatus: TaskCacheStatus,
      output: string
    ) => void;
  } = {
    onStartCommand: () => {},
    onStartTasks: () => {},
    onEndTasks: () => {},
    onPrintTaskTerminalOutput: () => {},
  };

  constructor(
    private readonly projectNames: string[],
    private readonly tasks: Task[],
    private readonly args: {
      target?: string;
      configuration?: string;
    }
  ) {}

  startCommand(): void {
    this.callbacks.onStartCommand({
      projectNames: this.projectNames,
      tasks: this.tasks,
      args: this.args,
    });
  }

  startTasks(tasks) {
    this.callbacks.onStartTasks(tasks);
  }

  endTasks(taskResults: TaskResult[]) {
    this.callbacks.onEndTasks(taskResults);
  }

  printTaskTerminalOutput(
    task: Task,
    cacheStatus: TaskCacheStatus,
    output: string
  ) {
    this.callbacks.onPrintTaskTerminalOutput(task, cacheStatus, output);
  }
}
