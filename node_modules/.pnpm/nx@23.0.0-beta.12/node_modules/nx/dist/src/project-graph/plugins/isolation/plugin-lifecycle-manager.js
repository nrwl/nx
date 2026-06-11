"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginLifecycleManager = void 0;
/**
 * Phase configuration - single source of truth.
 * Key order defines phase execution order.
 * Hooks within each phase can execute in any order.
 */
const HOOKS_BY_PHASE = {
    graph: ['createNodes', 'createDependencies', 'createMetadata'],
    'pre-task': ['preTasksExecution'],
    'post-task': ['postTasksExecution'],
};
const PHASE_BY_HOOK = Object.entries(HOOKS_BY_PHASE).reduce((acc, [phase, hooks]) => {
    for (const hook of hooks) {
        acc[hook] = phase;
    }
    return acc;
}, {});
const PHASE_ORDER = keys(HOOKS_BY_PHASE);
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
class PluginLifecycleManager {
    constructor(registeredHooks) {
        /** Phases where this plugin has at least one registered hook */
        this.registeredPhases = {};
        /** Number of active "phase sessions" (callers between first and last hook) */
        this.phaseSessionCount = {};
        /** Ordered list of registered phases (derived from HOOKS_BY_PHASE key order, narrowed to registered phases) */
        this.registeredPhaseOrder = [];
        const registered = new Set(registeredHooks);
        // Determine which phases are registered and find first/last hooks per phase
        this.registeredPhases = {};
        for (const phase of PHASE_ORDER) {
            const hooksInPhase = HOOKS_BY_PHASE[phase].filter((hook) => registered.has(hook));
            if (hooksInPhase.length > 0) {
                this.registeredPhases[phase] = hooksInPhase;
                this.registeredPhaseOrder.push(phase);
            }
        }
        // Initialize session counts to 0
        for (const phase of this.registeredPhaseOrder) {
            this.phaseSessionCount[phase] = 0;
        }
    }
    wrapHook(hook, fn, shutdown) {
        return async (...args) => {
            this.enterHook(hook);
            try {
                return await fn(...args);
            }
            finally {
                const shouldShutdown = this.exitHook(hook);
                if (shouldShutdown) {
                    await shutdown();
                }
            }
        };
    }
    /**
     * Called when entering a hook. Increments phase session count if this
     * is the first registered hook in the phase.
     */
    enterHook(hook) {
        const phase = PHASE_BY_HOOK[hook];
        const phaseHooks = this.registeredPhases[phase];
        if (!phaseHooks || !phaseHooks.includes(hook)) {
            throw new Error(`Hook "${hook}" is not registered for this plugin. Registered phases: ${this.registeredPhaseOrder.join(', ')}`);
        }
        // If this is the first hook registered by this plugin in the phase, increment session count
        const firstHook = phaseHooks[0];
        if (hook === firstHook) {
            this.phaseSessionCount[phase] ??= 0;
            this.phaseSessionCount[phase]++;
        }
    }
    /**
     * Called when exiting a hook. Decrements phase session count if this
     * is the last registered hook in the phase.
     *
     * @returns true if the worker should shut down, false otherwise
     */
    exitHook(hook) {
        const phase = PHASE_BY_HOOK[hook];
        const phaseHooks = this.registeredPhases[phase];
        if (!phaseHooks) {
            throw new Error(`Hook "${hook}" is not registered for this plugin. Registered phases: ${this.registeredPhaseOrder.join(', ')}`);
        }
        // Only process shutdown logic on last hook (exiting the phase)
        if (hook !== phaseHooks[phaseHooks.length - 1]) {
            return false;
        }
        // Decrement session count
        const count = this.phaseSessionCount[phase] ?? 0;
        if (count === 0) {
            throw new Error(`Mismatched exitHook call for phase "${phase}". No active sessions.`);
        }
        const newCount = count - 1;
        this.phaseSessionCount[phase] = newCount;
        // Can only shut down if no more active sessions in this phase
        if (newCount > 0)
            return false;
        // Can only shut down if this is the last registered phase
        return this.isLastRegisteredPhase(phase);
    }
    /**
     * Returns true if the worker should shut down immediately after construction.
     * This happens when the plugin has no graph-phase hooks, meaning it won't
     * be needed until task execution time (pre-task or post-task).
     */
    shouldShutdownImmediately() {
        return !this.registeredPhases['graph'];
    }
    /**
     * Returns true if the plugin has any hooks in the given phase.
     */
    hasHooksInPhase(phase) {
        return !!this.registeredPhases[phase];
    }
    /**
     * Returns true if this is the last phase with registered hooks.
     */
    isLastRegisteredPhase(phase) {
        const phaseIndex = this.registeredPhaseOrder.indexOf(phase);
        if (phaseIndex === -1) {
            throw new Error(`Phase "${phase}" is not registered for this plugin.`);
        }
        return phaseIndex === this.registeredPhaseOrder.length - 1;
    }
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
    notifyPhaseAborted(phase, lastCompletedHook) {
        const phaseHooks = this.registeredPhases[phase];
        if (!phaseHooks) {
            return false;
        }
        const hookIndex = phaseHooks.indexOf(lastCompletedHook);
        // Hook not registered → this caller never entered the phase → no session to abort.
        // Hook is the last registered hook → exitHook already closed the session.
        if (hookIndex === -1 || hookIndex === phaseHooks.length - 1) {
            return false;
        }
        const count = this.phaseSessionCount[phase] ?? 0;
        if (count === 0) {
            return false;
        }
        const newCount = count - 1;
        this.phaseSessionCount[phase] = newCount;
        if (newCount > 0) {
            return false;
        }
        return this.isLastRegisteredPhase(phase);
    }
    /**
     * Returns the current session count for a phase. Useful for testing.
     */
    getPhaseRefCount(phase) {
        return this.phaseSessionCount[phase] ?? 0;
    }
}
exports.PluginLifecycleManager = PluginLifecycleManager;
function keys(obj) {
    return Object.keys(obj);
}
