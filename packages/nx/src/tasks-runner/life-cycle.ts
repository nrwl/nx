import { TaskStatus } from './tasks-runner';
import { Task } from '../config/task-graph';

export interface TaskResult {
  task: Task;
  status: TaskStatus;
  code: number;
  terminalOutput?: string;
}

export interface TaskMetadata {
  groupId: number;
}

export interface LifeCycle {
  startCommand?(): void | Promise<void>;

  endCommand?(): void | Promise<void>;

  scheduleTask?(task: Task): void | Promise<void>;

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

  startTasks?(task: Task[], metadata: TaskMetadata): void | Promise<void>;

  endTasks?(
    taskResults: TaskResult[],
    metadata: TaskMetadata
  ): void | Promise<void>;

  printTaskTerminalOutput?(
    task: Task,
    status: TaskStatus,
    output: string
  ): void;
}

export class CompositeLifeCycle implements LifeCycle {
  constructor(private readonly lifeCycles: LifeCycle[]) {}

  async startCommand(): Promise<void> {
    for (let l of this.lifeCycles) {
      if (l.startCommand) {
        await l.startCommand();
      }
    }
  }

  async endCommand(): Promise<void> {
    for (let l of this.lifeCycles) {
      if (l.endCommand) {
        await l.endCommand();
      }
    }
  }

  async scheduleTask(task: Task): Promise<void> {
    for (let l of this.lifeCycles) {
      if (l.scheduleTask) {
        await l.scheduleTask(task);
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

  async startTasks(tasks: Task[], metadata: TaskMetadata): Promise<void> {
    for (let l of this.lifeCycles) {
      if (l.startTasks) {
        await l.startTasks(tasks, metadata);
      } else if (l.startTask) {
        tasks.forEach((t) => l.startTask(t));
      }
    }
  }

  async endTasks(
    taskResults: TaskResult[],
    metadata: TaskMetadata
  ): Promise<void> {
    for (let l of this.lifeCycles) {
      if (l.endTasks) {
        await l.endTasks(taskResults, metadata);
      } else if (l.endTask) {
        taskResults.forEach((t) => l.endTask(t.task, t.code));
      }
    }
  }

  printTaskTerminalOutput(
    task: Task,
    status: TaskStatus,
    output: string
  ): void {
    for (let l of this.lifeCycles) {
      if (l.printTaskTerminalOutput) {
        l.printTaskTerminalOutput(task, status, output);
      }
    }
  }
}
