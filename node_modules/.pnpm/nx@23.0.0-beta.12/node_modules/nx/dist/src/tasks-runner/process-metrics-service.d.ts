import { GroupInfo, GroupType, Metadata, MetricsUpdate, ProcessMetadata, ProcessMetrics, SystemInfo } from '../native';
export type { GroupInfo, GroupType, Metadata, MetricsUpdate, ProcessMetadata, ProcessMetrics, SystemInfo, };
export type MetricsCallback = (event: MetricsUpdate) => void;
/**
 * Simplified service providing subscription-based access to Rust metrics collector
 * Manages singleton access pattern for metrics collection during execution of tasks and CLI commands
 * All methods handle errors internally to ensure metrics collection never breaks task execution
 */
declare class ProcessMetricsService {
    private collector;
    private cleanupRegistered;
    constructor();
    /**
     * Register signal handlers for graceful shutdown
     * Ensures collection thread is stopped cleanly on Ctrl+C or process termination
     */
    private registerCleanupHandlers;
    /**
     * Subscribe to push-based metrics notifications
     * Collection starts automatically on first subscription (lazy start)
     */
    subscribe(callback: MetricsCallback): void;
    /**
     * Register a process for a task - creates anchor for discovery
     * This is the core integration point - called from RunningTask constructors
     */
    registerTaskProcess(taskId: string, pid: number): void;
    /**
     * Register a batch with multiple tasks sharing a worker
     */
    registerBatch(batchId: string, taskIds: string[], pid: number): void;
    /**
     * Register the daemon process
     */
    registerDaemonProcess(pid: number): void;
    /**
     * Register a subprocess of the main CLI (e.g., plugin worker)
     */
    registerMainCliSubprocess(pid: number, alias?: string): void;
    /**
     * Get system information (CPU cores and total memory)
     */
    getSystemInfo(): SystemInfo | null;
    /**
     * Stop collection and cleanup
     */
    shutdown(): void;
}
/**
 * Get or create the singleton ProcessMetricsService instance
 * Lazy initialization - service only starts when first accessed
 */
export declare function getProcessMetricsService(): ProcessMetricsService;
