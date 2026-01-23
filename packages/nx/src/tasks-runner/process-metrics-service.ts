import {
  ProcessMetricsCollector,
  ProcessMetadata,
  ProcessMetrics,
  MetricsUpdate,
  SystemInfo,
  Metadata,
  GroupInfo,
  GroupType,
} from '../native';
import { getDaemonProcessIdSync } from '../daemon/cache';

export type {
  ProcessMetadata,
  ProcessMetrics,
  MetricsUpdate,
  SystemInfo,
  Metadata,
  GroupInfo,
  GroupType,
};

export type MetricsCallback = (event: MetricsUpdate) => void;

/**
 * Simplified service providing subscription-based access to Rust metrics collector
 * Manages singleton access pattern for metrics collection during execution of tasks and CLI commands
 * All methods handle errors internally to ensure metrics collection never breaks task execution
 */
class ProcessMetricsService {
  private collector: ProcessMetricsCollector | null = null;
  private cleanupRegistered = false;

  private batchPidListeners: ((
    batchId: string,
    taskIds: string[],
    pid: number
  ) => void | Promise<void>)[] = [];
  private taskPidListeners: ((
    taskId: string,
    pid: number
  ) => void | Promise<void>)[] = [];

  constructor() {
    try {
      this.collector = new ProcessMetricsCollector();

      // Register main nx process as CLI
      this.collector.registerMainCliProcess(process.pid);

      // Register daemon process if available
      const daemonPid = getDaemonProcessIdSync();
      if (daemonPid) {
        this.collector.registerDaemonProcess(daemonPid);
      }
    } catch {
      // Silent failure - metrics collection is optional and should never break task execution
    }
  }

  /**
   * Register signal handlers for graceful shutdown
   * Ensures collection thread is stopped cleanly on Ctrl+C or process termination
   */
  private registerCleanupHandlers(): void {
    const cleanup = () => {
      try {
        this.shutdown();
      } catch {
        // Silent failure during cleanup
      }
    };

    // Handle various exit scenarios
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }

  /**
   * Subscribe to push-based metrics notifications
   * Collection starts automatically on first subscription (lazy start)
   */
  subscribe(callback: MetricsCallback): ProcessMetricsService {
    if (!this.collector) {
      throw new Error('Metrics collector not initialized');
    }

    try {
      // Start collection on first subscription (idempotent - safe to call multiple times)
      this.collector.startCollection();

      // Register cleanup handlers on first successful start
      // If startCollection() threw, we never reach this line
      if (!this.cleanupRegistered) {
        this.registerCleanupHandlers();
        this.cleanupRegistered = true;
      }

      // Wrap the user's callback to adapt from error-first pattern (err, data) => void
      // to the simple pattern (event) => void that users expect
      // The Rust side uses CalleeHandled which sends (null, data) on success
      this.collector.subscribe((err: Error | null, event: MetricsUpdate) => {
        if (err) {
          // Silently ignore errors - metrics collection is optional
          return;
        }
        callback(event);
      });
    } catch {
      // Silent failure - metrics collection is optional
    }
    return this;
  }

  /**
   * Subscribe to task PID registration events
   * @param callback Callback invoked when a task registers a PID. Keep this fast.
   */
  subscribeToPidRegistration(
    callback: (taskId: string, pid: number) => void | Promise<void>
  ): typeof this {
    this.taskPidListeners.push(callback);
    return this;
  }

  /**
   * Subscribe to batch PID registration events
   * @param callback Callback invoked when a batch registers a PID. Keep this fast.
   */
  subscribeToBatchPidRegistration(
    callback: (
      batchId: string,
      taskIds: string[],
      pid: number
    ) => void | Promise<void>
  ): typeof this {
    this.batchPidListeners.push(callback);
    return this;
  }

  /**
   * Register a process for a task - creates anchor for discovery
   * This is the core integration point - called from RunningTask constructors
   */
  registerTaskProcess(taskId: string, pid: number): void {
    try {
      this.collector?.registerTaskProcess(taskId, pid);
      this.notifyPidRegistration(taskId, pid);
    } catch {
      // Silent failure - metrics collection is optional
    }
  }

  /**
   * Register a batch with multiple tasks sharing a worker
   */
  registerBatch(batchId: string, taskIds: string[], pid: number): void {
    try {
      this.collector?.registerBatch(batchId, taskIds, pid);
      this.notifyBatchPIDRegistration(batchId, taskIds, pid);
    } catch {
      // Silent failure - metrics collection is optional
    }
  }

  /**
   * Notifies listeners about a batch PID registration
   *
   * @param batchId ID of the batch that is being registered
   * @param pid PID of the worker process for the batch
   * @param taskIds IDs of the tasks in the batch
   */
  notifyBatchPIDRegistration(
    batchId: string,
    taskIds: string[],
    pid: number
  ): void {
    for (const listener of this.batchPidListeners) {
      listener(batchId, taskIds, pid);
    }
  }

  /**
   * Notifies listeners about a task PID registration
   *
   * @param taskId Task ID of the task that is being registered
   * @param pid PID belonging to the task
   */
  notifyPidRegistration(taskId: string, pid: number): void {
    for (const listener of this.taskPidListeners) {
      listener(taskId, pid);
    }
  }

  /**
   * Register the daemon process
   */
  registerDaemonProcess(pid: number): void {
    try {
      this.collector?.registerDaemonProcess(pid);
    } catch {
      // Silent failure - metrics collection is optional
    }
  }

  /**
   * Register a subprocess of the main CLI (e.g., plugin worker)
   */
  registerMainCliSubprocess(pid: number, alias?: string): void {
    try {
      this.collector?.registerMainCliSubprocess(pid, alias);
    } catch {
      // Silent failure - metrics collection is optional
    }
  }

  /**
   * Get system information (CPU cores and total memory)
   */
  getSystemInfo(): SystemInfo | null {
    try {
      return this.collector?.getSystemInfo();
    } catch {
      // Silent failure - metrics collection is optional
      return null;
    }
  }

  /**
   * Stop collection and cleanup
   */
  shutdown(): void {
    try {
      this.collector?.stopCollection();
    } catch {
      // Silent failure during cleanup
    }
  }
}

/**
 * Singleton instance (lazily initialized)
 */
let instance: ProcessMetricsService | null = null;

/**
 * Get or create the singleton ProcessMetricsService instance
 * Lazy initialization - service only starts when first accessed
 */
export function getProcessMetricsService(): ProcessMetricsService {
  if (!instance) {
    instance = new ProcessMetricsService();
  }
  return instance;
}
