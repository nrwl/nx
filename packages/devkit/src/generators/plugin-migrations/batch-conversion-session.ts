import {
  readNxJson,
  type CreateNodes,
  type ExpandedPluginConfiguration,
  type Tree,
  logger as devkitLogger,
} from 'nx/src/devkit-exports';
// Type-only: a runtime import would create a require cycle with the migrator.
import type {
  ResidualByProject,
  ResidualEntry,
} from './executor-to-plugin-migrator';

/**
 * The evidence one deferred engine invocation stages for the batch finalize
 * pass. Everything is captured by value at staging time (see `stagePlan`)
 * because later children in the batch keep mutating the Tree and their own
 * caches; the only live references kept are the plugin's `createNodes`
 * functions, which the finalize verification pass needs to run.
 */
export interface DeferredConversionPlan {
  pluginPath: string;
  createNodes: CreateNodes | undefined;
  createNodesV2: CreateNodes | undefined;
  logger: typeof devkitLogger | undefined;
  /**
   * Whether the plugin was registered in nx.json before this conversion wrote
   * its registrations. Gates dead executor-keyed target-default cleanup, as in
   * the inline engine path.
   */
  pluginPreRegistered: boolean;
  /** Per-(project, target) residuals + equivalence-oracle baselines (Phase 2). */
  residualByProject: ResidualByProject;
  /** project name -> project root for every migrated project. */
  rootByProject: Map<string, string>;
  /**
   * `"<project>\t<target>"` -> the effective executor the pair resolves to
   * after migration (the inferred target's; a `command` resolves to
   * `nx:run-commands`). Input to the finalize target-default preflight.
   */
  inferredExecutorByPair: Map<string, string | undefined>;
  /** Every effective executor the plugin's Phase 1 inference emitted. */
  inferredExecutors: Set<string>;
  /** Every root the plugin's Phase 1 inference produced a project for. */
  inferredRoots: Set<string>;
  /** Config files matched by the plugin's glob and owned by an inferred root. */
  matchedConfigFiles: string[];
  /** Config files the Phase 1 inference could not load. */
  erroredConfigFiles: string[];
  /** The migrated executors (Phase 0 scope): dead-default cleanup candidates. */
  migratedExecutors: string[];
  /**
   * `"<project>\t<target>"` -> executor from the pre-migration project graph.
   * Feeds the batch-global liveness scan: a pair no plan migrated still
   * resolves its graph executor, keeping that executor's defaults live.
   */
  graphExecutorByPair: Map<string, string>;
}

/**
 * One child generator run inside the batch: the `nx.json` `plugins` snapshots
 * around it and the plans its engine invocations staged. A registration delta
 * that no staged plan's plugin accounts for is an opaque barrier for the
 * finalize planner (e.g. a converter that bypasses the engine entirely, or
 * registers an unrelated plugin).
 */
export interface BatchChildRecord {
  pluginsBefore: (string | ExpandedPluginConfiguration)[];
  pluginsAfter: (string | ExpandedPluginConfiguration)[];
  plans: DeferredConversionPlan[];
}

/** The engine-facing slice of the session: stage a plan for the running child. */
export interface BatchConversionStaging {
  stagePlan(plan: DeferredConversionPlan): void;
}

// Keyed by Tree identity so a session cannot leak into another generator
// invocation. At most one session per Tree.
const activeSessions = new WeakMap<Tree, BatchConversionSession>();

/**
 * A batch of convert-to-inferred generator runs against one Tree
 * (`infer-targets` with several plugins selected). While a child runs inside
 * `runChild`, the engine defers centralization: it writes full residuals,
 * skips the hoist / dead-default cleanup / verification pass, and stages a
 * {@link DeferredConversionPlan} here instead. The staged evidence is committed
 * only when the child generator resolves, so a failed child contributes
 * nothing. A finalize pass consumes the committed records after the batch loop.
 *
 * Open with {@link openBatchConversionSession} and always `close()` in a
 * `finally` so the Tree's engine invocations return to the inline path.
 */
export class BatchConversionSession {
  private readonly children: BatchChildRecord[] = [];
  private pendingPlans: DeferredConversionPlan[] | undefined;
  private closed = false;

  constructor(private readonly tree: Tree) {}

  /** The committed child records, in batch order. */
  get records(): readonly BatchChildRecord[] {
    return this.children;
  }

  /**
   * Run one child generator with deferred centralization. Commits the plans
   * its engine invocations staged only when `fn` resolves; a rejection (a
   * failed child, or `NoTargetsToMigrateError`) discards them.
   */
  async runChild<T>(fn: () => T | Promise<T>): Promise<T> {
    if (this.closed) {
      throw new Error(
        'The convert-to-inferred batch session has been closed; open a new one to run more conversions.'
      );
    }
    if (this.pendingPlans) {
      throw new Error(
        'A convert-to-inferred batch child is already running; batch children must run sequentially.'
      );
    }
    const pluginsBefore = structuredClone(readNxJson(this.tree)?.plugins ?? []);
    this.pendingPlans = [];
    try {
      const result = await fn();
      this.children.push({
        pluginsBefore,
        pluginsAfter: structuredClone(readNxJson(this.tree)?.plugins ?? []),
        plans: this.pendingPlans,
      });
      return result;
    } finally {
      this.pendingPlans = undefined;
    }
  }

  /**
   * Stage a deferred plan for the running child (engine-facing; reach it via
   * {@link getActiveBatchStaging}). Clones every mutable structure so the
   * staged evidence is immune to later Tree/cache mutations; the `createNodes`
   * references are kept live for the finalize verification pass.
   */
  stagePlan(plan: DeferredConversionPlan): void {
    if (!this.pendingPlans) {
      throw new Error(
        'Cannot stage a conversion plan: no batch child is running.'
      );
    }
    const residualByProject: ResidualByProject = new Map();
    for (const [projectName, targetMap] of plan.residualByProject) {
      const clonedTargetMap = new Map<string, ResidualEntry>();
      for (const [targetName, entry] of targetMap) {
        clonedTargetMap.set(targetName, structuredClone(entry));
      }
      residualByProject.set(projectName, clonedTargetMap);
    }
    this.pendingPlans.push({
      ...plan,
      residualByProject,
      rootByProject: new Map(plan.rootByProject),
      inferredExecutorByPair: new Map(plan.inferredExecutorByPair),
      inferredExecutors: new Set(plan.inferredExecutors),
      inferredRoots: new Set(plan.inferredRoots),
      matchedConfigFiles: [...plan.matchedConfigFiles],
      erroredConfigFiles: [...plan.erroredConfigFiles],
      migratedExecutors: [...plan.migratedExecutors],
      graphExecutorByPair: new Map(plan.graphExecutorByPair),
    });
  }

  private hasRunningChild(): boolean {
    return this.pendingPlans !== undefined;
  }

  /**
   * End the session: engine invocations on the Tree return to the inline path.
   * Rejected while a child is running; otherwise a still-running child would
   * fall back to inline centralization mid-batch, or stage its plan into a
   * session opened after this one. `runChild` always settles its child before
   * returning or throwing, so a `finally { session.close() }` never hits this.
   */
  close(): void {
    if (this.pendingPlans) {
      throw new Error(
        'Cannot close the convert-to-inferred batch session while a child conversion is running.'
      );
    }
    this.closed = true;
    if (activeSessions.get(this.tree) === this) {
      activeSessions.delete(this.tree);
    }
  }

  /** @internal module-level accessor for {@link getActiveBatchStaging}. */
  static activeStagingFor(tree: Tree): BatchConversionStaging | undefined {
    const session = activeSessions.get(tree);
    return session?.hasRunningChild() ? session : undefined;
  }
}

/**
 * Open a batch conversion session for `tree`. Throws when one is already open:
 * sessions do not nest (each child in a batch must observe the same session).
 */
export function openBatchConversionSession(tree: Tree): BatchConversionSession {
  if (activeSessions.has(tree)) {
    throw new Error(
      'A convert-to-inferred batch session is already open for this Tree.'
    );
  }
  const session = new BatchConversionSession(tree);
  activeSessions.set(tree, session);
  return session;
}

/**
 * The staging handle for `tree`, or `undefined` when no batch child is
 * currently running (no session, or the session is between children). The
 * engine checks this to decide between the inline path and deferred staging.
 */
export function getActiveBatchStaging(
  tree: Tree
): BatchConversionStaging | undefined {
  return BatchConversionSession.activeStagingFor(tree);
}
