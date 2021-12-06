import type { Task } from '@nrwl/devkit';
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
  } = {
    onStartCommand: () => {},
    onStartTasks: () => {},
    onEndTasks: () => {},
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
}
