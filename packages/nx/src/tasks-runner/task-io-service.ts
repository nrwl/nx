import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { resolveNxTokensInString } from '../project-graph/utils/project-configuration-utils';
import { workspaceDataDirectory } from '../utils/cache-directory';

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

export type TaskIOInfo = {
  taskId: string;
  inputs: {
    files: string[];
    runtime: string[];
    environment: string[];
    depOutputs: string[];
    external: string[];
  };
  outputGlobs: string[];
};

export type TaskIOCallback = (taskIOInfo: TaskIOInfo) => void;

/**
 * Service for tracking task process IDs and providing access to task IO information.
 * Subscribes to ProcessMetricsService for PID discovery.
 * IO information comes from task.hashInputs (populated during hashing) and task.outputs.
 */
class TaskIOService {
  // Used to call subscribers that were late to the party
  protected taskToPids: Map<string, number> = new Map();
  protected taskToIO: Map<string, TaskIOInfo> = new Map();

  // Subscription state
  private pidCallbacks: TaskPidCallback[] = [];
  private taskIOCallbacks: TaskIOCallback[] = [];

  // Project graph for output resolution
  private projectGraph: ProjectGraph | null = null;

  // Task graph for accessing all tasks
  private taskGraph: TaskGraph | null = null;

  /**
   * Initialize the service with a project graph and optional task graph.
   * Required for resolving task outputs and accessing all task IO information.
   */
  init(projectGraph: ProjectGraph, taskGraph?: TaskGraph): void {
    this.projectGraph = projectGraph;
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
  subscribeToTaskIO(callback: TaskIOCallback): void {
    this.taskIOCallbacks.push(callback);
  }

  /**
   * Notify subscribers that hash inputs are available for a task.
   * Called from the hasher when inputs are computed.
   */
  notifyTaskIO(
    taskId: string,
    inputs: {
      files: string[];
      runtime: string[];
      environment: string[];
      depOutputs: string[];
      external: string[];
    }
  ): void {
    if (!this.taskGraph?.tasks?.[taskId]) {
      // Cannot proceed without task graph to resolve outputs
      return;
    }

    const taskIOInfo: TaskIOInfo = {
      taskId,
      inputs,
      outputGlobs: this.getExpandedOutputs(this.taskGraph?.tasks[taskId]),
    };
    this.taskToIO.set(taskId, taskIOInfo);

    for (const cb of this.taskIOCallbacks) {
      try {
        cb(taskIOInfo);
      } catch {
        // Silent failure - don't let one callback break others
      }
    }
  }

  /**
   * Get current PIDs for a task (synchronous).
   */
  getPidForTask(taskId: string): number | null {
    return this.taskToPids.get(taskId) ?? null;
  }

  /**
   * Get all current task → PIDs mappings.
   * NOTE: This only returns one PID per task, even if that task
   * may have spawned multiple processes. To get all PIDs for a task,
   * you need to correlate spawned processes via their parent PID.
   */
  getAllTaskPids(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [taskId, pid] of this.taskToPids) {
      result.set(taskId, pid);
    }
    return result;
  }

  /**
   * Get IO information for a task.
   * The task must have been hashed (task.hashInputs must be populated).
   * Returns file inputs and outputs.
   */
  getTaskIOInfo(task: string): TaskIOInfo | null {
    return this.taskToIO.get(task);
  }

  /**
   * Get expanded output paths for a task.
   * Resolves {projectRoot} and {workspaceRoot} placeholders.
   */
  getExpandedOutputs(task: Task): string[] {
    if (!this.projectGraph || !task.outputs) {
      return task.outputs ?? [];
    }

    const projectNode = this.projectGraph.nodes[task.target.project];
    if (!projectNode) {
      return task.outputs;
    }

    return task.outputs.map((output) =>
      resolveNxTokensInString(
        output,
        this.projectGraph.nodes[task.target.project].data
      )
    );
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
  constructor(private dbgFilePath: string) {
    super();
  }

  log(message: string): void {
    writeFileSync(
      this.dbgFilePath,
      `[${new Date().toISOString()}] ${message}\n`,
      { flag: 'a' }
    );
  }

  override init(projectGraph: ProjectGraph, taskGraph?: TaskGraph): void {
    super.init(projectGraph, taskGraph);
    mkdirSync(dirname(this.dbgFilePath), { recursive: true });
    try {
      rmSync(this.dbgFilePath, { force: true });
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
    this.log(
      `DebugTaskIOService initialized with projectGraph and ${
        taskGraph ? 'taskGraph' : 'no taskGraph'
      }`
    );
    this.subscribeToTaskPids(({ pid, taskId }) => {
      this.log(`Task ${taskId} PID updated: [${pid}]`);
    }); // Ensure metrics subscription for debugging
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
          ...(taskGraph
            ? [
                'Expected task IO:',
                ...[...this.taskToIO.entries()].map(
                  ([taskId, io]) =>
                    `Task ${taskId}:
    Files: [${io.inputs.files?.slice(0, 5).join(', ')}${io.inputs.files?.length > 5 ? `, ... (${io.inputs.files.length} total)` : ''}]
    Outputs: [${io.outputGlobs.join(', ')}]`
                ),
              ]
            : []),
        ].join('\n')
      );
      console.log(`DebugTaskIOService log written to ${this.dbgFilePath}`);
    });
  }

  override notifyPidUpdate(update: TaskPidUpdate): void {
    this.log(
      `notifyPidUpdate called for task ${update.taskId} with PID [${update.pid}]`
    );
    super.notifyPidUpdate(update);
  }

  override notifyTaskIO(
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
      `notifyTaskIO called for task ${taskId} with ${inputs.files.length} file inputs`
    );
    super.notifyTaskIO(taskId, inputs);
  }
}

// Singleton
let instance: TaskIOService | null = null;

/**
 * Get or create the singleton TaskIOService instance.
 */
export function getTaskIOService(): TaskIOService {
  if (!instance) {
    // TODO: Remove debug service option once stable
    instance = process.env.NX_TASK_IO_DEBUG
      ? new DebugTaskIOService(
          join(workspaceDataDirectory, 'task-io-service-debug.log')
        )
      : new TaskIOService();
  }
  return instance;
}
