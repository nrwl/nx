/**
 * Phase configuration - single source of truth.
 * Key order defines phase execution order.
 * Hooks within each phase can execute in any order.
 */
const HOOKS_BY_PHASE = {
  graph: ['createNodes', 'createDependencies', 'createMetadata'],
  'pre-task': ['preTasksExecution'],
  'post-task': ['postTasksExecution'],
} as const;

export type Phase = keyof typeof HOOKS_BY_PHASE;
export type Hook = (typeof HOOKS_BY_PHASE)[Phase][number];

const PHASE_BY_HOOK: Record<Hook, Phase> = Object.entries(
  HOOKS_BY_PHASE
).reduce(
  (acc, [phase, hooks]) => {
    for (const hook of hooks) {
      acc[hook as Hook] = phase as Phase;
    }
    return acc;
  },
  {} as Record<Hook, Phase>
);

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
export class PluginLifecycleManager {
  /** Phases where this plugin has at least one registered hook */
  private readonly activePhases: Partial<Record<Phase, Hook[]>> = {};

  /** Number of active "phase sessions" (callers between first and last hook) */
  private readonly phaseSessionCount: Partial<Record<Phase, number>> = {};

  /** Ordered list of phases (derived from HOOKS_BY_PHASE key order, narrowed to active phases) */
  private readonly phaseOrder: Phase[] = [];

  constructor(registeredHooks: Iterable<Hook>) {
    const registered = new Set(registeredHooks);

    // Determine which phases are active and find first/last hooks per phase
    this.activePhases = {};
    for (const phase of PHASE_ORDER) {
      const hooksInPhase = HOOKS_BY_PHASE[phase].filter((hook) =>
        registered.has(hook)
      );
      if (hooksInPhase.length > 0) {
        this.activePhases[phase] = hooksInPhase;
        this.phaseOrder.push(phase);
      }
    }

    // Initialize session counts to 0
    for (const phase of this.phaseOrder) {
      this.phaseSessionCount[phase] = 0;
    }
  }

  wrapHook<TArgs extends unknown[], TReturn>(
    hook: Hook,
    fn: (...args: TArgs) => Promise<TReturn>,
    shutdown: () => Promise<void> | void
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
      this.enterHook(hook);
      try {
        return await fn(...args);
      } finally {
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
  enterHook(hook: Hook): void {
    const phase = PHASE_BY_HOOK[hook];
    const phaseHooks = this.activePhases[phase];

    if (!phaseHooks || !phaseHooks.includes(hook)) {
      throw new Error(
        `Hook "${hook}" is not registered for this plugin. Active phases: ${this.phaseOrder.join(', ')}`
      );
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
  exitHook(hook: Hook): boolean {
    const phase = PHASE_BY_HOOK[hook];
    const phaseHooks = this.activePhases[phase];

    if (!phaseHooks) {
      throw new Error(
        `Hook "${hook}" is not registered for this plugin. Active phases: ${this.phaseOrder.join(', ')}`
      );
    }

    // Only process shutdown logic on last hook (exiting the phase)
    if (hook !== phaseHooks[phaseHooks.length - 1]) {
      return false;
    }

    // Decrement session count
    const count = this.phaseSessionCount[phase] ?? 0;
    if (count === 0) {
      throw new Error(
        `Mismatched exitHook call for phase "${phase}". No active sessions.`
      );
    }
    const newCount = count - 1;
    this.phaseSessionCount[phase] = newCount;

    // Can only shut down if no more active sessions in this phase
    if (newCount > 0) return false;

    // Can only shut down if no later phases are active
    return !this.hasLaterActivePhases(phase);
  }

  /**
   * Returns true if the worker should shut down immediately after construction.
   * This happens when the plugin has no hooks in the first phase.
   */
  shouldShutdownImmediately(): boolean {
    return this.phaseOrder[0] !== PHASE_ORDER[0];
  }

  /**
   * Returns true if the plugin has any hooks in the given phase.
   */
  hasHooksInPhase(phase: Phase): boolean {
    return !!this.activePhases[phase];
  }

  /**
   * Returns true if the plugin has hooks in any phase after the given phase.
   */
  hasLaterActivePhases(phase: Phase): boolean {
    const phaseIndex = this.phaseOrder.indexOf(phase);
    if (phaseIndex === -1) {
      throw new Error(`Phase "${phase}" is not active for this plugin.`);
    }
    // this.phaseOrder is filtered to only active phases
    return this.phaseOrder.length > phaseIndex + 1;
  }

  /**
   * Returns the current session count for a phase. Useful for testing.
   */
  getPhaseRefCount(phase: Phase): number {
    return this.phaseSessionCount[phase] ?? 0;
  }
}

function keys<TKeys extends string | number>(
  obj: Record<TKeys, unknown>
): TKeys[] {
  return Object.keys(obj) as TKeys[];
}
