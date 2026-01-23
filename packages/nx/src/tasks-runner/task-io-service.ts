import {
  getProcessMetricsService,
  MetricsUpdate,
  GroupInfo,
  ProcessMetadata,
} from './process-metrics-service';
import { Task, TaskGraph } from '../config/task-graph';
import { ProjectGraph } from '../config/project-graph';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { dirname } from 'path';

export type TaskPidUpdate = {
  taskId: string;
  pids: number[];
};

export type FileSetInput = {
  /** Project name, or undefined for workspace-level file sets */
  project?: string;
  /** Glob patterns for the file set */
  patterns: string[];
};

export type TaskIOInfo = {
  /** File set inputs (project-scoped or workspace-level globs) */
  fileSets: FileSetInput[];
  /** Task outputs (glob patterns) */
  outputs: string[];
};

export type TaskPidCallback = (update: TaskPidUpdate) => void;

/**
 * Service for tracking task process IDs and providing access to task IO information.
 * Subscribes to ProcessMetricsService for PID discovery.
 * IO information comes from task.hashInputs (populated during hashing) and task.outputs.
 */
class TaskIOService {
  // Accumulated state from metrics updates
  private groups = new Map<string, GroupInfo>();
  private processes = new Map<number, ProcessMetadata>();
  protected taskToPids = new Map<string, Set<number>>();

  // Subscription state
  private pidCallbacks: TaskPidCallback[] = [];
  private metricsSubscribed = false;

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
    this.ensureMetricsSubscription();

    // Emit current state to new subscriber
    for (const [taskId, pids] of this.taskToPids) {
      if (pids.size > 0) {
        callback({
          taskId,
          pids: [...pids],
        });
      }
    }
  }

  /**
   * Get current PIDs for a task (synchronous).
   */
  getPidsForTask(taskId: string): number[] {
    return [...(this.taskToPids.get(taskId) ?? [])];
  }

  /**
   * Get all current task → PIDs mappings.
   */
  getAllTaskPids(): Map<string, number[]> {
    const result = new Map<string, number[]>();
    for (const [taskId, pids] of this.taskToPids) {
      result.set(taskId, [...pids]);
    }
    return result;
  }

  /**
   * Get IO information for a task.
   * The task must have been hashed (task.hashInputs must be populated).
   * Returns file set inputs and outputs.
   */
  getTaskIOInfo(task: Task): TaskIOInfo | null {
    if (!task.hashInputs) {
      return null;
    }

    return {
      fileSets: task.hashInputs.fileSets.map((fs) => ({
        project: fs.project,
        patterns: fs.patterns,
      })),
      outputs: task.outputs ?? [],
    };
  }

  /**
   * Get IO information for multiple tasks.
   */
  getMultipleTaskIOInfo(tasks: Task[]): Map<string, TaskIOInfo> {
    const result = new Map<string, TaskIOInfo>();
    for (const task of tasks) {
      const info = this.getTaskIOInfo(task);
      if (info) {
        result.set(task.id, info);
      }
    }
    return result;
  }

  /**
   * Get IO information for all tasks in the task graph.
   * Returns a map of task ID to TaskIOInfo for tasks that have been hashed.
   * Tasks without hashInputs are excluded from the result.
   */
  getAllTaskGraphIOInfo(): Map<string, TaskIOInfo> {
    if (!this.taskGraph) {
      return new Map();
    }

    return this.getMultipleTaskIOInfo(Object.values(this.taskGraph.tasks));
  }

  /**
   * Get expected outputs for all tasks in the task graph.
   * Unlike getAllTaskGraphIOInfo, this includes all tasks regardless of hash status.
   * FileSets will be empty for unhashed tasks.
   */
  getAllExpectedTaskIO(): Map<string, TaskIOInfo> {
    if (!this.taskGraph) {
      return new Map();
    }

    const result = new Map<string, TaskIOInfo>();
    for (const task of Object.values(this.taskGraph.tasks)) {
      result.set(task.id, {
        fileSets:
          task.hashInputs?.fileSets.map((fs) => ({
            project: fs.project,
            patterns: fs.patterns,
          })) ?? [],
        outputs: task.outputs ?? [],
      });
    }
    return result;
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
      output
        .replace('{projectRoot}', projectNode.data.root)
        .replace('{workspaceRoot}', '')
    );
  }

  // --- Private methods ---

  protected ensureMetricsSubscription(): void {
    if (this.metricsSubscribed) return;
    this.metricsSubscribed = true;

    try {
      getProcessMetricsService()
        .subscribe((update) => {
          this.handleMetricsUpdate(update);
        })
        .subscribeToBatchPidRegistration((batchId, taskIds, pid) => {
          // TODO: Figure out how to handle batches
        })
        .subscribeToPidRegistration((taskId, pid) => {
          let pids = this.taskToPids.get(taskId);
          if (!pids) {
            pids = new Set();
            this.taskToPids.set(taskId, pids);
          }
          pids.add(pid);
          this.notifyPidUpdate({ taskId, pids: [...pids] });
        });
    } catch {
      // Silent failure - PID tracking is optional
    }
  }

  private handleMetricsUpdate(update: MetricsUpdate): void {
    // Merge incremental metadata
    for (const [id, group] of Object.entries(update.metadata.groups)) {
      this.groups.set(id, group);
      this.initTaskPids(group);
    }
    for (const [pid, meta] of Object.entries(update.metadata.processes)) {
      this.processes.set(+pid, meta);
    }

    const livePids = new Set(update.processes.map((p) => p.pid));

    // Add newly discovered PIDs to each task (preserve existing PIDs)
    for (const [taskId, existingPids] of this.taskToPids) {
      const discoveredPids = this.findPidsForTask(taskId, livePids);
      const newPids = [...discoveredPids].filter((p) => !existingPids.has(p));

      // Merge newly discovered PIDs into existing set (don't replace)
      for (const pid of newPids) {
        existingPids.add(pid);
      }

      if (newPids.length) {
        this.notifyPidUpdate({
          taskId,
          pids: [...existingPids],
        });
      }
    }

    // Cleanup dead processes
    for (const pid of this.processes.keys()) {
      if (!livePids.has(pid)) this.processes.delete(pid);
    }
  }

  private initTaskPids(group: GroupInfo): void {
    if (group.groupType === 'Task') {
      if (!this.taskToPids.has(group.id)) {
        this.taskToPids.set(group.id, new Set());
      }
    } else if (group.groupType === 'Batch' && group.taskIds) {
      for (const taskId of group.taskIds) {
        if (!this.taskToPids.has(taskId)) {
          this.taskToPids.set(taskId, new Set());
        }
      }
    }
  }

  private findPidsForTask(taskId: string, livePids: Set<number>): Set<number> {
    const result = new Set<number>();
    for (const pid of livePids) {
      const meta = this.processes.get(pid);
      if (!meta) continue;

      const group = this.groups.get(meta.groupId);
      if (meta.groupId === taskId) {
        result.add(pid);
      } else if (
        group?.groupType === 'Batch' &&
        group.taskIds?.includes(taskId)
      ) {
        result.add(pid);
      }
    }
    return result;
  }

  protected notifyPidUpdate(update: TaskPidUpdate): void {
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
    this.subscribeToTaskPids(({ pids, taskId }) => {
      this.log(`Task ${taskId} PIDs updated: [${pids.join(',')}]`);
    }); // Ensure metrics subscription for debugging
    process.on('exit', () => {
      this.log(
        [
          `Final Task to PIDs mapping: ${JSON.stringify(
            Array.from(this.taskToPids.entries()).reduce(
              (acc, [taskId, pids]) => {
                acc[taskId] = [...pids];
                return acc;
              },
              {} as Record<string, number[]>
            ),
            null,
            2
          )}\n`,
          ...(taskGraph
            ? [
                'Expected task IO:',
                ...[...this.getAllTaskGraphIOInfo().entries()].map(
                  ([taskId, io]) =>
                    `Task ${taskId}:\n  FileSets: ${io.fileSets
                      .map(
                        (fs) =>
                          `{ project: ${fs.project ?? 'workspace'}, patterns: [${fs.patterns.join(
                            ', '
                          )}] }`
                      )
                      .join('; ')}\n  Outputs: [${io.outputs.join(', ')}]`
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
      `notifyPidUpdate called for task ${update.taskId} with PIDs [${update.pids.join(',')}]`
    );
    super.notifyPidUpdate(update);
  }

  override ensureMetricsSubscription(): void {
    super.ensureMetricsSubscription();
    getProcessMetricsService()
      .subscribe((update) => {
        this.log(
          `Processed MetricsUpdate: ${new Date(
            update.timestamp
          ).toLocaleTimeString()}`
        );
      })
      .subscribeToPidRegistration((taskId, pid) => {
        this.log(`PID registration: taskId=${taskId}, pid=${pid}`);
      })
      .subscribeToBatchPidRegistration((batchId, taskIds, pid) => {
        this.log(
          `Batch PID registration: batchId=${batchId}, taskIds=[${taskIds.join(',')}], pid=${pid}`
        );
      });
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
      ? new DebugTaskIOService('tmp/task-io-debug.log')
      : new TaskIOService();
  }
  return instance;
}
