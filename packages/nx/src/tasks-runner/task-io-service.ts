import type { Task } from '../config/task-graph';
import { getProcessMetricsService } from './process-metrics-service';

/**
 * Maps taskId -> PID. Note that this only Returns
 * the PID that the main task process is running under,
 * not any child processes it may have spawned. To fully
 * trace the task's processes, you'll need to correlate
 * spawned processes's PIDs with their parent PID.
 */
export type TaskPidUpdate = {
  taskId: string;
  pid: number;
};

export type TaskPidCallback = (update: TaskPidUpdate) => void;

export type TaskInputInfo = {
  taskId: string;
  inputs: {
    files: string[];
    runtime: string[];
    environment: string[];
    depOutputs: string[];
    external: string[];
  };
};

export type TaskInputCallback = (taskInputInfo: TaskInputInfo) => void;

export type TaskOutputsUpdate = {
  taskId: string;
  outputs: string[];
};

export type TaskOutputsCallback = (update: TaskOutputsUpdate) => void;

/**
 * Service for tracking task process IDs and providing access to task IO information.
 * Subscribes to ProcessMetricsService for PID discovery.
 * IO information comes from hash inputs (populated during hashing).
 * Output files are reported when tasks are stored to cache.
 *
 * Data is only stored when subscribers are registered. Without subscribers,
 * notifications are no-ops to avoid unbounded memory growth in long-lived
 * processes (e.g. the Nx daemon).
 */
class TaskIOService {
  // Subscription state
  private pidCallbacks: TaskPidCallback[] = [];
  private taskInputCallbacks: TaskInputCallback[] = [];
  private taskOutputsCallbacks: TaskOutputsCallback[] = [];

  /**
   * Subscribe to task PID updates.
   * Receives notifications when processes are added/removed from tasks.
   */
  subscribeToTaskPids(callback: TaskPidCallback): void {
    this.pidCallbacks.push(callback);
  }

  /**
   * Returns true if any callbacks are registered for task input notifications.
   * Used to avoid expensive input collection in the hasher when nobody is listening.
   */
  hasTaskInputSubscribers(): boolean {
    return this.taskInputCallbacks.length > 0;
  }

  /**
   * Subscribe to hash inputs as they are computed.
   * Called when a task's hash inputs become available.
   */
  subscribeToTaskInputs(callback: TaskInputCallback): void {
    this.taskInputCallbacks.push(callback);
  }

  /**
   * Subscribe to task outputs as they are stored to cache.
   * Called when a task's output files are collected for caching.
   */
  subscribeToTaskOutputs(callback: TaskOutputsCallback): void {
    this.taskOutputsCallbacks.push(callback);
  }

  /**
   * Notify subscribers that hash inputs are available for a task.
   * Called from the hasher when inputs are computed.
   */
  notifyTaskInputs(
    taskId: string,
    inputs: {
      files: string[];
      runtime: string[];
      environment: string[];
      depOutputs: string[];
      external: string[];
    }
  ): void {
    const taskInputInfo: TaskInputInfo = {
      taskId,
      inputs,
    };

    for (const cb of this.taskInputCallbacks) {
      try {
        cb(taskInputInfo);
      } catch {
        // Silent failure - don't let one callback break others
      }
    }
  }

  /**
   * Notify subscribers that task outputs have been collected.
   * Called from the cache when outputs are stored.
   */
  notifyTaskOutputs(taskId: string, outputs: string[]): void {
    const update: TaskOutputsUpdate = {
      taskId,
      outputs,
    };

    for (const cb of this.taskOutputsCallbacks) {
      try {
        cb(update);
      } catch {
        // Silent failure - don't let one callback break others
      }
    }
  }

  /**
   * Registers a PID to a task and notifies subscribers.
   * @param update The TaskPidUpdate containing taskId and pid.
   */
  notifyPidUpdate(update: TaskPidUpdate): void {
    for (const cb of this.pidCallbacks) {
      try {
        cb(update);
      } catch {
        // Silent failure - don't let one callback break others
      }
    }
  }
}

// Singleton
let instance: TaskIOService | null = null;

/**
 * Get or create the singleton TaskIOService instance.
 */
export function getTaskIOService(): TaskIOService {
  if (!instance) {
    instance = new TaskIOService();
  }
  return instance;
}

/**
 * The task a process belongs to. `run-commands` can synthesize an id for a task
 * that is not in the graph, so only the id is guaranteed.
 */
export type TaskProcessOwner = Pick<Task, 'id' | 'sandbox'>;

/**
 * Register a task process start with both IO and metrics services.
 * This is the standard way to notify the system that a task process has started.
 *
 * A target that opted out of sandboxing (`sandbox: { enabled: false }`) reports
 * no PID, which suppresses IO tracing and therefore its sandbox report. Metrics
 * are registered either way: the opt-out covers reporting, not the process
 * management that cleanup and orphan reaping depend on.
 */
export function registerTaskProcessStart(
  task: TaskProcessOwner,
  pid: number
): void {
  if (task.sandbox?.enabled !== false) {
    getTaskIOService().notifyPidUpdate({ taskId: task.id, pid });
  }
  getProcessMetricsService().registerTaskProcess(task.id, pid);
}
