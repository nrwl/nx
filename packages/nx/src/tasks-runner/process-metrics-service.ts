import {
  ProcessMetricsCollector,
  ProcessMetadata,
  ProcessMetrics,
  DaemonMetrics,
  ProcessMetricsSnapshot,
  BatchMetricsSnapshot,
  MetricsUpdate,
} from '../native';
import { getDaemonProcessIdSync } from '../daemon/cache';

export type {
  ProcessMetadata,
  ProcessMetrics,
  DaemonMetrics,
  ProcessMetricsSnapshot,
  BatchMetricsSnapshot,
  MetricsUpdate,
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
  subscribe(callback: MetricsCallback): void {
    if (!this.collector) {
      return;
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
  }

  /**
   * Register a process for a task - creates anchor for discovery
   * This is the core integration point - called from RunningTask constructors
   */
  registerTaskProcess(taskId: string, pid: number): void {
    try {
      this.collector?.registerTaskProcess(taskId, pid);
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
    } catch {
      // Silent failure - metrics collection is optional
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
