/**
 * Phase configuration - single source of truth.
 * Key order defines phase execution order.
 * Hooks within each phase can execute in any order.
 */
declare const HOOKS_BY_PHASE: {
    readonly graph: readonly ["createNodes", "createDependencies", "createMetadata"];
    readonly 'pre-task': readonly ["preTasksExecution"];
    readonly 'post-task': readonly ["postTasksExecution"];
};
export type Phase = keyof typeof HOOKS_BY_PHASE;
export type Hook = (typeof HOOKS_BY_PHASE)[Phase][number];
/**
 * Manages the lifecycle of an isolated plugin worker.
 *
 * Tracks phase entry/exit to determine when a worker can safely shut down.
 * A "phase session" starts when a caller enters the first registered hook
 * of a phase and ends when they exit the last registered hook.
 *
 * Shutdown occurs when:
 * 1. All phase sessions complete (ref count reaches 0)
 * 2. No later phases have registered hooks
 */
export declare class PluginLifecycleManager {
    /** Phases where this plugin has at least one registered hook */
    private readonly registeredPhases;
    /** Number of active "phase sessions" (callers between first and last hook) */
    private readonly phaseSessionCount;
    /** Ordered list of registered phases (derived from HOOKS_BY_PHASE key order, narrowed to registered phases) */
    private readonly registeredPhaseOrder;
    constructor(registeredHooks: Iterable<Hook>);
    wrapHook<TArgs extends unknown[], TReturn>(hook: Hook, fn: (...args: TArgs) => Promise<TReturn>, shutdown: () => Promise<void> | void): (...args: TArgs) => Promise<TReturn>;
    /**
     * Called when entering a hook. Increments phase session count if this
     * is the first registered hook in the phase.
     */
    enterHook(hook: Hook): void;
    /**
     * Called when exiting a hook. Decrements phase session count if this
     * is the last registered hook in the phase.
     *
     * @returns true if the worker should shut down, false otherwise
     */
    exitHook(hook: Hook): boolean;
    /**
     * Returns true if the worker should shut down immediately after construction.
     * This happens when the plugin has no graph-phase hooks, meaning it won't
     * be needed until task execution time (pre-task or post-task).
     */
    shouldShutdownImmediately(): boolean;
    /**
     * Returns true if the plugin has any hooks in the given phase.
     */
    hasHooksInPhase(phase: Phase): boolean;
    /**
     * Returns true if this is the last phase with registered hooks.
     */
    isLastRegisteredPhase(phase: Phase): boolean;
    /**
     * Aborts a single session within a phase by decrementing its count,
     * but only if the caller's session is still open.
     *
     * Called when graph construction is abandoned mid-flight (e.g., a newer
     * recomputation supersedes the current one). Without this, hooks that
     * were entered but whose phase never completed would leave the session
     * count elevated, preventing the worker from ever shutting down.
     *
     * @param phase The phase to abort
     * @param lastCompletedHook The last hook the caller executed before aborting.
     *   Used to determine whether the caller's session is still open: if there
     *   are registered hooks after this one, the session is open and needs
     *   cleanup. If this IS the last registered hook, exitHook already closed
     *   the session — decrementing again would steal another caller's count.
     * @returns true if the worker should shut down, false otherwise
     */
    notifyPhaseAborted(phase: Phase, lastCompletedHook: Hook): boolean;
    /**
     * Returns the current session count for a phase. Useful for testing.
     */
    getPhaseRefCount(phase: Phase): number;
}
export {};
