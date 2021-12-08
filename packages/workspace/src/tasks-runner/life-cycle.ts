import type { Task } from '@nrwl/devkit';
import { TaskStatus } from './tasks-runner';
import { TaskCacheStatus } from '../utilities/output';

export type ExtendedTaskStatus = TaskStatus | 'pending' | 'loading';

export interface TaskResult {
  task: Task;
  status: ExtendedTaskStatus;
  code: number;
  terminalOutput?: string;
}

export interface LifeCycle {
  startCommand?(): void;

  endCommand?(): void;

  scheduleTask?(task: Task): void;

  /**
   * @deprecated use startTasks
   *
   * startTask won't be supported after Nx 14 is released.
   */
  startTask?(task: Task): void;

  /**
   * @deprecated use endTasks
   *
   * endTask won't be supported after Nx 14 is released.
   */
  endTask?(task: Task, code: number): void;

  startTasks?(task: Task[]): void;

  endTasks?(taskResults: TaskResult[]): void;

  printTaskTerminalOutput?(
    task: Task,
    cacheStatus: TaskCacheStatus,
    output: string
  ): void;
}

export class CompositeLifeCycle implements LifeCycle {
  constructor(public readonly lifeCycles: LifeCycle[]) {}

  startCommand(): void {
    for (let l of this.lifeCycles) {
      if (l.startCommand) {
        l.startCommand();
      }
    }
  }

  endCommand(): void {
    for (let l of this.lifeCycles) {
      if (l.endCommand) {
        l.endCommand();
      }
    }
  }

  scheduleTask(task: Task): void {
    for (let l of this.lifeCycles) {
      if (l.scheduleTask) {
        l.scheduleTask(task);
      }
    }
  }

  startTask(task: Task): void {
    for (let l of this.lifeCycles) {
      if (l.startTask) {
        l.startTask(task);
      }
    }
  }

  endTask(task: Task, code: number): void {
    for (let l of this.lifeCycles) {
      if (l.endTask) {
        l.endTask(task, code);
      }
    }
  }

  startTasks(tasks: Task[]): void {
    for (let l of this.lifeCycles) {
      if (l.startTasks) {
        l.startTasks(tasks);
      } else if (l.startTask) {
        tasks.forEach((t) => l.startTask(t));
      }
    }
  }

  endTasks(taskResults: TaskResult[]): void {
    for (let l of this.lifeCycles) {
      if (l.endTasks) {
        l.endTasks(taskResults);
      } else if (l.endTask) {
        taskResults.forEach((t) => l.endTask(t.task, t.code));
      }
    }
  }

  printTaskTerminalOutput(
    task: Task,
    cacheStatus: TaskCacheStatus,
    output: string
  ): void {
    for (let l of this.lifeCycles) {
      if (l.printTaskTerminalOutput) {
        l.printTaskTerminalOutput(task, cacheStatus, output);
      }
    }
  }
}
