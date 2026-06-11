"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProcessMetricsService = getProcessMetricsService;
const cache_1 = require("../daemon/cache");
const native_1 = require("../native");
/**
 * Simplified service providing subscription-based access to Rust metrics collector
 * Manages singleton access pattern for metrics collection during execution of tasks and CLI commands
 * All methods handle errors internally to ensure metrics collection never breaks task execution
 */
class ProcessMetricsService {
    constructor() {
        this.collector = null;
        this.cleanupRegistered = false;
        try {
            this.collector = new native_1.ProcessMetricsCollector();
            // Register main nx process as CLI
            this.collector.registerMainCliProcess(process.pid);
            // Register daemon process if available
            const daemonPid = (0, cache_1.getDaemonProcessIdSync)();
            if (daemonPid) {
                this.collector.registerDaemonProcess(daemonPid);
            }
        }
        catch {
            // Silent failure - metrics collection is optional and should never break task execution
        }
    }
    /**
     * Register signal handlers for graceful shutdown
     * Ensures collection thread is stopped cleanly on Ctrl+C or process termination
     */
    registerCleanupHandlers() {
        const cleanup = () => {
            try {
                this.shutdown();
            }
            catch {
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
    subscribe(callback) {
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
            this.collector.subscribe((err, event) => {
                if (err) {
                    // Silently ignore errors - metrics collection is optional
                    return;
                }
                callback(event);
            });
        }
        catch {
            // Silent failure - metrics collection is optional
        }
    }
    /**
     * Register a process for a task - creates anchor for discovery
     * This is the core integration point - called from RunningTask constructors
     */
    registerTaskProcess(taskId, pid) {
        try {
            this.collector?.registerTaskProcess(taskId, pid);
        }
        catch {
            // Silent failure - metrics collection is optional
        }
    }
    /**
     * Register a batch with multiple tasks sharing a worker
     */
    registerBatch(batchId, taskIds, pid) {
        try {
            this.collector?.registerBatch(batchId, taskIds, pid);
        }
        catch {
            // Silent failure - metrics collection is optional
        }
    }
    /**
     * Register the daemon process
     */
    registerDaemonProcess(pid) {
        try {
            this.collector?.registerDaemonProcess(pid);
        }
        catch {
            // Silent failure - metrics collection is optional
        }
    }
    /**
     * Register a subprocess of the main CLI (e.g., plugin worker)
     */
    registerMainCliSubprocess(pid, alias) {
        try {
            this.collector?.registerMainCliSubprocess(pid, alias);
        }
        catch {
            // Silent failure - metrics collection is optional
        }
    }
    /**
     * Get system information (CPU cores and total memory)
     */
    getSystemInfo() {
        try {
            return this.collector?.getSystemInfo();
        }
        catch {
            // Silent failure - metrics collection is optional
            return null;
        }
    }
    /**
     * Stop collection and cleanup
     */
    shutdown() {
        try {
            this.collector?.stopCollection();
        }
        catch {
            // Silent failure during cleanup
        }
    }
}
/**
 * Singleton instance (lazily initialized)
 */
let instance = null;
/**
 * Get or create the singleton ProcessMetricsService instance
 * Lazy initialization - service only starts when first accessed
 */
function getProcessMetricsService() {
    if (!instance) {
        instance = new ProcessMetricsService();
    }
    return instance;
}
