import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { ProjectGraph } from '../config/project-graph';
import { TaskGraph } from '../config/task-graph';
import { workspaceDataDirectory } from '../utils/cache-directory';
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
 */
class TaskIOService {
  // Used to call subscribers that were late to the party
  protected taskToPids: Map<string, number> = new Map();
  protected taskToInputs: Map<string, TaskInputInfo> = new Map();

  // Subscription state
  private pidCallbacks: TaskPidCallback[] = [];
  private taskInputCallbacks: TaskInputCallback[] = [];
  private taskOutputsCallbacks: TaskOutputsCallback[] = [];

  // Project graph and task graph for resolving task information
  protected projectGraph: ProjectGraph | null = null;
  protected taskGraph: TaskGraph | null = null;

  constructor(projectGraph?: ProjectGraph, taskGraph?: TaskGraph) {
    if (projectGraph) {
      this.projectGraph = projectGraph;
    }
    if (taskGraph) {
      this.taskGraph = taskGraph;
    }
  }

  /**
   * Subscribe to task PID updates.
   * Receives notifications when processes are added/removed from tasks.
   */
  subscribeToTaskPids(callback: TaskPidCallback): void {
    this.pidCallbacks.push(callback);

    // Emit current state to new subscriber
    for (const [taskId, pid] of this.taskToPids) {
      callback({
        taskId,
        pid,
      });
    }
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
    this.taskToInputs.set(taskId, taskInputInfo);

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
    this.taskToPids.set(update.taskId, update.pid);
    for (const cb of this.pidCallbacks) {
      try {
        cb(update);
      } catch {
        // Silent failure - don't let one callback break others
      }
    }
  }
}

class DebugTaskIOService extends TaskIOService {
  constructor(
    private dbgFilePath: string,
    projectGraph?: ProjectGraph,
    taskGraph?: TaskGraph
  ) {
    super(projectGraph, taskGraph);
    mkdirSync(dirname(this.dbgFilePath), { recursive: true });
    try {
      rmSync(this.dbgFilePath, { force: true });
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
    this.log(
      `DebugTaskIOService initialized with ${projectGraph ? 'projectGraph' : 'no projectGraph'} and ${
        taskGraph ? 'taskGraph' : 'no taskGraph'
      }`
    );
    this.subscribeToTaskPids(({ pid, taskId }) => {
      this.log(`Task ${taskId} PID updated: [${pid}]`);
    });
    process.on('exit', () => {
      this.log(
        [
          `Final Task to PIDs mapping: ${JSON.stringify(
            Array.from(this.taskToPids.entries()).reduce(
              (acc, [taskId, pid]) => {
                acc[taskId] = pid;
                return acc;
              },
              {} as Record<string, number>
            ),
            null,
            2
          )}\n`,
          ...(this.taskGraph
            ? [
                'Expected task inputs:',
                ...[...this.taskToInputs.entries()].map(
                  ([taskId, info]) =>
                    `Task ${taskId}:
    Files: [${info.inputs.files?.slice(0, 5).join(', ')}${info.inputs.files?.length > 5 ? `, ... (${info.inputs.files.length} total)` : ''}]`
                ),
              ]
            : []),
        ].join('\n')
      );
      console.log(`DebugTaskIOService log written to ${this.dbgFilePath}`);
    });
  }

  log(message: string): void {
    writeFileSync(
      this.dbgFilePath,
      `[${new Date().toISOString()}] ${message}\n`,
      { flag: 'a' }
    );
  }

  override notifyPidUpdate(update: TaskPidUpdate): void {
    this.log(
      `notifyPidUpdate called for task ${update.taskId} with PID [${update.pid}]`
    );
    super.notifyPidUpdate(update);
  }

  override notifyTaskInputs(
    taskId: string,
    inputs: {
      files: string[];
      runtime: string[];
      environment: string[];
      depOutputs: string[];
      external: string[];
    }
  ): void {
    this.log(
      `notifyTaskInputs called for task ${taskId} with ${inputs.files.length} file inputs`
    );
    super.notifyTaskInputs(taskId, inputs);
  }

  override notifyTaskOutputs(taskId: string, outputs: string[]): void {
    this.log(
      `notifyTaskOutputs called for task ${taskId} with ${outputs.length} outputs`
    );
    super.notifyTaskOutputs(taskId, outputs);
  }
}

// Singleton
let instance: TaskIOService | null = null;

/**
 * Get or create the singleton TaskIOService instance.
 * Optionally provide projectGraph and taskGraph to initialize with context.
 */
export function getTaskIOService(
  projectGraph?: ProjectGraph,
  taskGraph?: TaskGraph
): TaskIOService {
  if (!instance) {
    // TODO: Remove debug service option once stable
    instance = process.env.NX_TASK_IO_DEBUG
      ? new DebugTaskIOService(
          join(workspaceDataDirectory, 'task-io-service-debug.log'),
          projectGraph,
          taskGraph
        )
      : new TaskIOService(projectGraph, taskGraph);
  }
  return instance;
}

/**
 * Register a task process start with both IO and metrics services.
 * This is the standard way to notify the system that a task process has started.
 * Both services need to be notified together - TaskIOService for external subscribers
 * and ProcessMetricsService for native resource monitoring.
 */
export function registerTaskProcessStart(taskId: string, pid: number): void {
  getTaskIOService().notifyPidUpdate({ taskId, pid });
  getProcessMetricsService().registerTaskProcess(taskId, pid);
}
