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

  // Batch state: reverse lookup from taskId to its batchId
  private taskIdToBatchId: Map<string, string> = new Map();
  // Buffered inputs/outputs for batch tasks, keyed by batchId -> (taskId -> data)
  private pendingBatchInputs: Map<
    string,
    Map<string, TaskInputInfo['inputs']>
  > = new Map();
  private pendingBatchOutputs: Map<string, Map<string, string[]>> = new Map();

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
   * Register a batch so that subsequent notifyTaskInputs/notifyTaskOutputs
   * calls for tasks in this batch are buffered instead of emitted immediately.
   * The orchestrator calls this at the start of batch execution.
   */
  registerBatch(batchId: string, taskIds: string[]): void {
    for (const taskId of taskIds) {
      this.taskIdToBatchId.set(taskId, batchId);
    }
    this.pendingBatchInputs.set(batchId, new Map());
    this.pendingBatchOutputs.set(batchId, new Map());
  }

  /**
   * Notify subscribers that hash inputs are available for a task.
   * Called from the hasher when inputs are computed.
   * If the task is in a registered batch, inputs are buffered until
   * finalizeBatchInputs is called.
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
    const batchId = this.taskIdToBatchId.get(taskId);
    if (batchId) {
      const batchInputs = this.pendingBatchInputs.get(batchId);
      if (batchInputs) {
        batchInputs.set(taskId, inputs);
        return;
      }
    }

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
   * If the task is in a registered batch, outputs are buffered until
   * finalizeBatchOutputs is called.
   */
  notifyTaskOutputs(taskId: string, outputs: string[]): void {
    const batchId = this.taskIdToBatchId.get(taskId);
    if (batchId) {
      const batchOutputs = this.pendingBatchOutputs.get(batchId);
      if (batchOutputs) {
        batchOutputs.set(taskId, outputs);
        return;
      }
    }

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

  /**
   * Broadcast a PID update to all tasks in a batch.
   * Since batch tasks share a single worker process, each task
   * receives the same PID notification.
   */
  notifyBatchPidUpdate(taskIds: string[], pid: number): void {
    for (const taskId of taskIds) {
      this.notifyPidUpdate({ taskId, pid });
    }
  }

  /**
   * Merge all buffered inputs for a batch and emit the combined set
   * to each task in the batch. Called by the orchestrator after all
   * hashing for the batch is complete.
   */
  finalizeBatchInputs(batchId: string): void {
    const batchInputs = this.pendingBatchInputs.get(batchId);
    if (!batchInputs || batchInputs.size === 0) {
      return;
    }

    const combined = mergeBatchInputs(batchInputs);

    // Emit combined inputs for each task in the batch
    for (const taskId of batchInputs.keys()) {
      const taskInputInfo: TaskInputInfo = { taskId, inputs: combined };
      for (const cb of this.taskInputCallbacks) {
        try {
          cb(taskInputInfo);
        } catch {
          // Silent failure - don't let one callback break others
        }
      }
    }

    this.pendingBatchInputs.delete(batchId);
  }

  /**
   * Merge all buffered outputs for a batch and emit the combined set
   * to each task in the batch. Called by the orchestrator after all
   * caching for the batch is complete.
   */
  finalizeBatchOutputs(batchId: string): void {
    const batchOutputs = this.pendingBatchOutputs.get(batchId);
    if (!batchOutputs || batchOutputs.size === 0) {
      return;
    }

    const combined = mergeBatchOutputs(batchOutputs);

    // Emit combined outputs for each task in the batch
    for (const taskId of batchOutputs.keys()) {
      const update: TaskOutputsUpdate = { taskId, outputs: combined };
      for (const cb of this.taskOutputsCallbacks) {
        try {
          cb(update);
        } catch {
          // Silent failure - don't let one callback break others
        }
      }
    }

    this.pendingBatchOutputs.delete(batchId);
  }

  /**
   * Clean up all batch state for a given batch.
   * Called by the orchestrator when the batch is fully complete.
   */
  clearBatch(batchId: string): void {
    this.pendingBatchInputs.delete(batchId);
    this.pendingBatchOutputs.delete(batchId);
    for (const [taskId, id] of this.taskIdToBatchId) {
      if (id === batchId) {
        this.taskIdToBatchId.delete(taskId);
      }
    }
  }
}

/**
 * Merge inputs from all tasks in a batch into a single combined set.
 * Uses Set for deduplication across tasks.
 */
function mergeBatchInputs(
  batchInputs: Map<string, TaskInputInfo['inputs']>
): TaskInputInfo['inputs'] {
  const files = new Set<string>();
  const runtime = new Set<string>();
  const environment = new Set<string>();
  const depOutputs = new Set<string>();
  const external = new Set<string>();

  for (const inputs of batchInputs.values()) {
    for (const f of inputs.files) files.add(f);
    for (const r of inputs.runtime) runtime.add(r);
    for (const e of inputs.environment) environment.add(e);
    for (const d of inputs.depOutputs) depOutputs.add(d);
    for (const x of inputs.external) external.add(x);
  }

  return {
    files: [...files],
    runtime: [...runtime],
    environment: [...environment],
    depOutputs: [...depOutputs],
    external: [...external],
  };
}

/**
 * Merge outputs from all tasks in a batch into a single deduplicated list.
 */
function mergeBatchOutputs(batchOutputs: Map<string, string[]>): string[] {
  const combined = new Set<string>();
  for (const outputs of batchOutputs.values()) {
    for (const o of outputs) combined.add(o);
  }
  return [...combined];
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
 * Register a task process start with both IO and metrics services.
 * This is the standard way to notify the system that a task process has started.
 * Both services need to be notified together - TaskIOService for external subscribers
 * and ProcessMetricsService for native resource monitoring.
 */
export function registerTaskProcessStart(taskId: string, pid: number): void {
  getTaskIOService().notifyPidUpdate({ taskId, pid });
  getProcessMetricsService().registerTaskProcess(taskId, pid);
}

/**
 * Register a batch process start with both IO and metrics services.
 * Broadcasts the PID to all tasks in the batch since they share a single
 * worker process and cannot be differentiated.
 */
export function registerBatchProcessStart(
  batchId: string,
  taskIds: string[],
  pid: number
): void {
  getTaskIOService().notifyBatchPidUpdate(taskIds, pid);
  getProcessMetricsService().registerBatch(batchId, taskIds, pid);
}
