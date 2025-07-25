import { Task } from '../config/task-graph';
import { ExternalObject, TaskStatus as NativeTaskStatus } from '../native';
import { RunningTask } from './running-tasks/running-task';
import { TaskStatus } from './tasks-runner';

/**
 * The result of a completed {@link Task}
 */
export interface TaskResult {
  task: Task;
  status: TaskStatus;
  code: number;
  terminalOutput?: string;
}

/**
 * A map of {@link TaskResult} keyed by the ID of the completed {@link Task}s
 */
export type TaskResults = Record<string, TaskResult>;

export interface TaskMetadata {
  groupId: number;
}

interface RustRunningTask extends RunningTask {
  getResults(): Promise<{ code: number; terminalOutput: string }>;

  onExit(cb: (code: number, terminalOutput: string) => void): void;

  kill(signal?: NodeJS.Signals): Promise<void> | void;
}

export interface LifeCycle {
  startCommand?(parallel?: number): void | Promise<void>;

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

  registerRunningTask?(
    taskId: string,
    parserAndWriter: ExternalObject<[any, any]>
  ): void;

  registerRunningTaskWithEmptyParser?(taskId: string): void;

  appendTaskOutput?(taskId: string, output: string, isPtyTask: boolean): void;

  setTaskStatus?(taskId: string, status: NativeTaskStatus): void;

  registerForcedShutdownCallback?(callback: () => void): void;

  setEstimatedTaskTimings?(timings: Record<string, number>): void;
}

export class CompositeLifeCycle implements LifeCycle {
  constructor(private readonly lifeCycles: LifeCycle[]) {}

  async startCommand(parallel?: number): Promise<void> {
    for (let l of this.lifeCycles) {
      if (l.startCommand) {
        await l.startCommand(parallel);
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

  registerRunningTask(
    taskId: string,
    parserAndWriter: ExternalObject<[any, any]>
  ): void {
    for (let l of this.lifeCycles) {
      if (l.registerRunningTask) {
        l.registerRunningTask(taskId, parserAndWriter);
      }
    }
  }

  registerRunningTaskWithEmptyParser(taskId: string): void {
    for (let l of this.lifeCycles) {
      if (l.registerRunningTaskWithEmptyParser) {
        l.registerRunningTaskWithEmptyParser(taskId);
      }
    }
  }

  appendTaskOutput(taskId: string, output: string, isPtyTask: boolean): void {
    for (let l of this.lifeCycles) {
      if (l.appendTaskOutput) {
        l.appendTaskOutput(taskId, output, isPtyTask);
      }
    }
  }

  setTaskStatus(taskId: string, status: NativeTaskStatus): void {
    for (let l of this.lifeCycles) {
      if (l.setTaskStatus) {
        l.setTaskStatus(taskId, status);
      }
    }
  }

  registerForcedShutdownCallback(callback: () => void): void {
    for (let l of this.lifeCycles) {
      if (l.registerForcedShutdownCallback) {
        l.registerForcedShutdownCallback(callback);
      }
    }
  }

  setEstimatedTaskTimings(timings: Record<string, number>): void {
    for (let l of this.lifeCycles) {
      if (l.setEstimatedTaskTimings) {
        l.setEstimatedTaskTimings(timings);
      }
    }
  }
}
