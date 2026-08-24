import { join } from 'node:path/posix';
import {
  getProjects,
  readJson,
  readNxJson,
  serializeJson,
  updateNxJson,
  type NxJsonConfiguration,
  type TargetConfiguration,
  type TargetDefaultArrayEntry,
  type Tree,
  logger as devkitLogger,
} from 'nx/src/devkit-exports';
import {
  LoadedNxPlugin,
  ProjectConfigurationsError,
  findProjectForPath,
  mergeTargetConfigurations,
  retrieveProjectConfigurations,
} from 'nx/src/devkit-internals';
import type { ConfigurationResult } from 'nx/src/project-graph/utils/project-configuration-utils';
import { isExactTargetNameKey } from '../target-defaults-utils';
import type {
  BatchChildRecord,
  BatchConversionSession,
  DeferredConversionPlan,
} from './batch-conversion-session';
import {
  appendPluginScopedTargetDefault,
  buildOwnerRootByPath,
  computeStrictCommon,
  harvestConfigurationErrors,
  hoistChangesExistingTargetDefaults,
  isRegistrationOfPlugin,
  packageJsonAuthorsTargetIdentity,
  removeDeadExecutorTargetDefault,
  removeHoistedTargetDefault,
  stableStringify,
  subtractCommon,
  type HarvestedConfigurationError,
  type ResidualEntry,
} from './executor-to-plugin-migrator';

type Logger = typeof devkitLogger;

interface PairPlan {
  projectName: string;
  root: string;
  entry: ResidualEntry;
}

/** Planning state for one target of one plan. */
interface TargetPlan {
  pairs: PairPlan[];
  /** Migrated projects whose identity is authored outside the plugin. */
  excludedProjects: Set<string>;
  migratedRoots: Set<string>;
  /** The strict common to hoist; `{}` means no candidate for this target. */
  common: TargetConfiguration;
  /** The entry appended to the proposed nx.json; set only for candidates. */
  hoistedEntry: TargetDefaultArrayEntry | undefined;
  /** Whether verification rejected the target-wide candidate. */
  rejected: boolean;
}

interface PlanState {
  plan: DeferredConversionPlan;
  log: Logger;
  /** Index of the plugin's first registration in the final plugins array. */
  firstRegistrationIndex: number;
  targets: Map<string, TargetPlan>;
  packageJsonAuthoredIdentity: boolean;
}

/**
 * Batch finalize: the deferred equivalent of Phase 3's hoist + cleanup and
 * Phase 4's verification, run once over every plan the batch session staged.
 * Planning happens on a clone of the final `nx.json`; a single combined
 * verification inference pass (all trusted plugin registrations, in final
 * order) supplies the ownership oracle and the per-pair equivalence inputs;
 * only then is the accepted outcome applied to the Tree as a precomputed byte
 * write-set.
 *
 * Finalization is optional deduplication: the Tree already holds each child's
 * conservative full-residual output. Any failure here (including an apply
 * failure, after restoring the write-set's snapshots) is caught, reported as
 * a single warning, and swallowed so the batch's callbacks still run.
 */
export async function finalizeBatchConversion(
  tree: Tree,
  session: BatchConversionSession,
  logger?: Logger
): Promise<void> {
  try {
    await runFinalize(tree, session.records);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    (logger ?? devkitLogger).warn(
      `convert-to-inferred could not centralize the shared configuration for this batch: ${message}. Every migrated project keeps its full per-project configuration; no configuration was lost, but shared configuration remains duplicated.`
    );
  }
}

async function runFinalize(
  tree: Tree,
  records: readonly BatchChildRecord[]
): Promise<void> {
  const plans = records.flatMap((record) => record.plans);
  if (plans.length === 0) {
    return;
  }

  const nxJson = readNxJson(tree);
  const finalPlugins = nxJson.plugins ?? [];

  // Classify every final registration: a registration of a plan's plugin is
  // trusted (the plan's createNodes can run it); anything else is opaque: a
  // pre-existing foreign plugin, or a registration a child added outside the
  // engine. An opaque registration at position k merges after (and can take
  // target identity from) every plan registered before k, invisibly to the
  // combined pass, so those plans must keep their full residuals.
  const pluginPathByRegistrationIndex = new Map<number, string>();
  const opaqueIndexes: number[] = [];
  finalPlugins.forEach((registration, index) => {
    const owner = plans.find((plan) =>
      isRegistrationOfPlugin(registration, plan.pluginPath)
    );
    if (owner) {
      pluginPathByRegistrationIndex.set(index, owner.pluginPath);
    } else {
      opaqueIndexes.push(index);
    }
  });

  const planStates: PlanState[] = plans.map((plan) => ({
    plan,
    log: plan.logger ?? devkitLogger,
    firstRegistrationIndex: finalPlugins.findIndex((registration) =>
      isRegistrationOfPlugin(registration, plan.pluginPath)
    ),
    targets: new Map<string, TargetPlan>(),
    packageJsonAuthoredIdentity: false,
  }));
  // Plan in final registration order: later-registered plugins merge later, so
  // their proposed entries append after earlier plans' under a shared key.
  planStates.sort(
    (a, b) =>
      (a.firstRegistrationIndex === -1
        ? Number.MAX_SAFE_INTEGER
        : a.firstRegistrationIndex) -
      (b.firstRegistrationIndex === -1
        ? Number.MAX_SAFE_INTEGER
        : b.firstRegistrationIndex)
  );

  // Executors any plan's inference emits. The union: an appended target-name
  // key resolves as an EXECUTOR key for every target of every plugin in the
  // final workspace, not only the plan's own.
  const unionInferredExecutors = new Set<string>();
  for (const plan of plans) {
    for (const executor of plan.inferredExecutors) {
      unionInferredExecutors.add(executor);
    }
  }

  const proposedNxJson = structuredClone(nxJson);

  for (const state of planStates) {
    planTargets(tree, state);
    applyPlanGates(
      state,
      opaqueIndexes,
      unionInferredExecutors,
      proposedNxJson
    );
    // Surviving candidates join the proposed nx.json so later plans' preflight
    // and the combined verification see them.
    proposedNxJson.targetDefaults ??= {};
    for (const targetName of [...state.targets.keys()].sort()) {
      const targetPlan = state.targets.get(targetName);
      if (Object.keys(targetPlan.common).length === 0) {
        continue;
      }
      targetPlan.hoistedEntry = appendPluginScopedTargetDefault(
        proposedNxJson,
        targetName,
        state.plan.pluginPath,
        targetPlan.common
      );
    }
    emitExcludedProjectsWarning(state);
  }

  // Every trusted registration, in exact final order, constructed with its
  // final registration index so partial errors are attributable to a plan.
  const specifiedPlugins: LoadedNxPlugin[] = [];
  finalPlugins.forEach((registration, index) => {
    const pluginPath = pluginPathByRegistrationIndex.get(index);
    if (pluginPath === undefined) {
      return;
    }
    const plan = plans.find((p) => p.pluginPath === pluginPath);
    specifiedPlugins.push(
      new LoadedNxPlugin(
        {
          createNodes: plan.createNodes,
          createNodesV2: plan.createNodesV2,
          name: plan.pluginPath,
        },
        registration,
        index
      )
    );
  });
  if (specifiedPlugins.length === 0) {
    // No plan has a final registration: every candidate was already retained
    // by the registration gate and nothing can be verified. The conservative
    // Tree state stands.
    return;
  }

  // One combined specified-plugin verification pass over every trusted final
  // registration, against the complete proposed nx.json. This replaces the
  // deferred children's Phase 4 passes.
  const { result, errors } = await runCombinedVerificationPass(
    tree,
    specifiedPlugins,
    proposedNxJson
  );
  if (!result) {
    throw new Error('the verification inference pass returned no result');
  }

  const ownerRootByPath = buildOwnerRootByPath(
    plans.flatMap((plan) => [...plan.graphRoots]),
    plans.flatMap((plan) => [...plan.inferredRoots])
  );

  const deviationsByProject = new Map<
    string,
    { root: string; targets: Map<string, TargetConfiguration> }
  >();
  for (const state of planStates) {
    const planErrors = errors.filter(
      (error) =>
        error.pluginIndex === undefined ||
        pluginPathByRegistrationIndex.get(error.pluginIndex) ===
          state.plan.pluginPath
    );
    rejectUnsafeCandidates(
      state,
      result,
      planErrors,
      ownerRootByPath,
      proposedNxJson
    );
    verifyPairs(state, result, planErrors, deviationsByProject);
  }

  planDeadExecutorCleanup(tree, records, plans, planStates, proposedNxJson);

  applyWriteSet(tree, proposedNxJson, deviationsByProject);
}

/**
 * Group a plan's residuals by target and partition each target's projects into
 * hoist-eligible and excluded, exactly as the inline hoist does, except the
 * package.json identity is recomputed against the FINAL Tree, since later
 * children in the batch may have edited package.json files after this plan was
 * staged.
 */
function planTargets(tree: Tree, state: PlanState): void {
  const { plan } = state;
  for (const [projectName, targetMap] of plan.residualByProject) {
    const root = plan.rootByProject.get(projectName);
    for (const [targetName, entry] of targetMap) {
      if (!state.targets.has(targetName)) {
        state.targets.set(targetName, {
          pairs: [],
          excludedProjects: new Set(),
          migratedRoots: new Set(),
          common: {},
          hoistedEntry: undefined,
          rejected: false,
        });
      }
      const targetPlan = state.targets.get(targetName);
      targetPlan.pairs.push({ projectName, root, entry });
      targetPlan.migratedRoots.add(root);
    }
  }

  for (const targetName of [...state.targets.keys()].sort()) {
    const targetPlan = state.targets.get(targetName);
    const eligibleResiduals: TargetConfiguration[] = [];
    for (const pair of targetPlan.pairs) {
      const packageJsonAuthored = packageJsonAuthorsTargetIdentity(
        tree,
        pair.root,
        targetName
      );
      if (packageJsonAuthored) {
        state.packageJsonAuthoredIdentity = true;
      }
      const identityAuthored =
        pair.entry.residual.executor !== undefined ||
        pair.entry.residual.command !== undefined ||
        packageJsonAuthored;
      if (identityAuthored) {
        targetPlan.excludedProjects.add(pair.projectName);
      } else {
        eligibleResiduals.push(pair.entry.residual);
      }
    }
    targetPlan.common =
      eligibleResiduals.length >= 2
        ? computeStrictCommon(eligibleResiduals)
        : {};
  }
}

/**
 * The pre-verification gates, mirroring the inline hoist's order: the
 * registration-tail gate (generalized to positional opaque barriers), then the
 * exact-name / executor-collision gate and the existing-target-default
 * preflight. Rejected targets keep their full residuals and warn with the
 * inline reasons.
 */
function applyPlanGates(
  state: PlanState,
  opaqueIndexes: number[],
  unionInferredExecutors: Set<string>,
  proposedNxJson: NxJsonConfiguration
): void {
  const { plan } = state;
  const retainResiduals = (targetNames: string[], reason: string) => {
    for (const targetName of targetNames) {
      state.targets.get(targetName).common = {};
    }
    state.log.warn(
      `convert-to-inferred retained full per-project configuration for target(s) ${targetNames.join(
        ', '
      )} because ${reason}; no configuration was lost, but shared configuration remains duplicated.`
    );
  };
  const centralizableTargets = () =>
    [...state.targets.entries()]
      .filter(([, targetPlan]) => Object.keys(targetPlan.common).length > 0)
      .map(([targetName]) => targetName)
      .sort();

  const blockedByOpaqueRegistration =
    state.firstRegistrationIndex === -1 ||
    opaqueIndexes.some((index) => index > state.firstRegistrationIndex);
  if (blockedByOpaqueRegistration) {
    const skippedTargets = centralizableTargets();
    if (skippedTargets.length > 0) {
      retainResiduals(
        skippedTargets,
        `another plugin is registered after ${plan.pluginPath} in nx.json and may take over those targets`
      );
    }
    return;
  }

  const preflightTargets = centralizableTargets();
  if (preflightTargets.length === 0) {
    return;
  }
  const projectNodesByName = Object.fromEntries(plan.graphNodeByProject);
  const nonExactNameTargets: string[] = [];
  const rejectedTargets: string[] = [];
  for (const targetName of preflightTargets) {
    if (
      !isExactTargetNameKey(targetName) ||
      unionInferredExecutors.has(targetName)
    ) {
      nonExactNameTargets.push(targetName);
      continue;
    }
    const targetPlan = state.targets.get(targetName);
    const eligiblePairs = targetPlan.pairs
      .filter((pair) => !targetPlan.excludedProjects.has(pair.projectName))
      .map((pair) => ({
        projectName: pair.projectName,
        inferredExecutor: plan.inferredExecutorByPair.get(
          `${pair.projectName}\t${targetName}`
        ),
      }));
    if (
      hoistChangesExistingTargetDefaults(
        proposedNxJson.targetDefaults,
        targetName,
        targetPlan.common,
        plan.pluginPath,
        eligiblePairs,
        projectNodesByName
      )
    ) {
      rejectedTargets.push(targetName);
    }
  }
  if (nonExactNameTargets.length > 0) {
    retainResiduals(
      nonExactNameTargets,
      'the target name would resolve as an executor or glob targetDefaults key and could apply to other targets'
    );
  }
  if (rejectedTargets.length > 0) {
    retainResiduals(
      rejectedTargets,
      'centralization would change which existing targetDefaults apply'
    );
  }
}

function emitExcludedProjectsWarning(state: PlanState): void {
  const excludedTargets = [...state.targets.entries()].filter(
    ([, targetPlan]) => targetPlan.excludedProjects.size > 0
  );
  if (excludedTargets.length === 0) {
    return;
  }
  const excludedProjectNames = [
    ...new Set(
      excludedTargets.flatMap(([, targetPlan]) => [
        ...targetPlan.excludedProjects,
      ])
    ),
  ].sort();
  const targetNames = excludedTargets
    .map(([targetName]) => targetName)
    .sort()
    .join(', ');
  state.log.warn(
    `convert-to-inferred kept per-project configuration for ${
      excludedProjectNames.length
    } project(s) (${excludedProjectNames.join(
      ', '
    )}) on target(s) ${targetNames} instead of centralizing it: their target identity is authored outside the plugin (a project.json executor/command, or a package.json script/nx.targets entry), so a plugin-scoped default would not resolve for them. Those projects keep the same output as before the migration; review them if you expected shared configuration.`
  );
}

async function runCombinedVerificationPass(
  tree: Tree,
  specifiedPlugins: LoadedNxPlugin[],
  proposedNxJson: NxJsonConfiguration
): Promise<{
  result: ConfigurationResult | undefined;
  errors: HarvestedConfigurationError[];
}> {
  global.NX_GRAPH_CREATION = true;
  try {
    return {
      result: await retrieveProjectConfigurations(
        { specifiedPlugins, defaultPlugins: [] },
        tree.root,
        structuredClone(proposedNxJson)
      ),
      errors: [],
    };
  } catch (e) {
    if (e instanceof ProjectConfigurationsError) {
      return {
        result: e.partialProjectConfigurationsResult,
        errors: harvestConfigurationErrors(e).entries,
      };
    }
    throw e;
  } finally {
    global.NX_GRAPH_CREATION = false;
  }
}

/**
 * The owner of a target's identity in the combined result: the plugin the
 * final source maps attribute `executor`/`command` to. Mirrors Nx's
 * `resolveSourcePlugin` (project-configuration/target-defaults.ts), which
 * decides whether a `filter: { plugin }` default resolves for the target; the
 * synthetic `nx/target-defaults` plugin never owns identity.
 */
function resolveTargetOwner(
  result: ConfigurationResult,
  root: string,
  targetName: string
): string | undefined {
  const sourceMap = result.sourceMaps?.[root];
  for (const identityKey of ['executor', 'command']) {
    const plugin = sourceMap?.[`targets.${targetName}.${identityKey}`]?.[1];
    if (plugin && plugin !== 'nx/target-defaults') {
      return plugin;
    }
  }
  return undefined;
}

/**
 * Target-wide rejection, the deferred equivalent of the inline verification
 * revert: drop a plan's candidate when the combined pass shows its plugin
 * owning the target on a non-migrated root (that root would inherit the
 * centralized default), or when an attributable error lies outside the plan's
 * migrated roots (a root the pass could not inspect might). Rejected targets
 * keep their full residuals (the conservative Tree state) and the entry is
 * removed from the proposed nx.json.
 */
function rejectUnsafeCandidates(
  state: PlanState,
  result: ConfigurationResult,
  planErrors: HarvestedConfigurationError[],
  ownerRootByPath: Map<string, string>,
  proposedNxJson: NxJsonConfiguration
): void {
  const revertedTargets: string[] = [];
  for (const [targetName, targetPlan] of state.targets) {
    if (!targetPlan.hoistedEntry) {
      continue;
    }
    const reachesNonMigratedRoot = Object.entries(result.projects ?? {}).some(
      ([root, projectConfig]) => {
        if (
          projectConfig.targets?.[targetName] === undefined ||
          targetPlan.migratedRoots.has(root)
        ) {
          return false;
        }
        // Only roots where THIS plugin owns the target inherit its
        // plugin-scoped default. A target another trusted plugin owns is that
        // plugin's concern; an unresolvable owner fails closed.
        const owner = resolveTargetOwner(result, root, targetName);
        return owner === state.plan.pluginPath || owner === undefined;
      }
    );
    const erroredOutsideMigratedRoots = planErrors.some((error) =>
      error.files.some((file) => {
        const ownerRoot = findProjectForPath(file, ownerRootByPath);
        return ownerRoot == null || !targetPlan.migratedRoots.has(ownerRoot);
      })
    );
    if (reachesNonMigratedRoot || erroredOutsideMigratedRoots) {
      targetPlan.rejected = true;
      removeHoistedTargetDefault(
        proposedNxJson,
        targetName,
        targetPlan.hoistedEntry
      );
      targetPlan.hoistedEntry = undefined;
      revertedTargets.push(targetName);
    }
  }

  if (revertedTargets.length > 0) {
    const causes =
      planErrors.length > 0
        ? ` The verification pass reported errors: ${planErrors
            .map((error) => error.message)
            .join('; ')}`
        : '';
    state.log.warn(
      `convert-to-inferred kept per-project configuration for target(s) ${revertedTargets
        .sort()
        .join(
          ', '
        )} instead of centralizing it: other projects inferred by this plugin would have inherited the centralized configuration (or the verification pass could not confirm they would not). The migrated projects keep the same output as before centralization.${causes}`
    );
  }
}

/**
 * Per-pair equivalence for EVERY migrated pair of the plan, candidates or not
 * (mirrors the inline Phase 4 oracle): the planned write merged with the
 * verified inferred target must equal the pair's baseline. A missing,
 * differently owned, or divergent pair keeps its full residual (the
 * conservative Tree state) instead of receiving a deviation write.
 */
function verifyPairs(
  state: PlanState,
  result: ConfigurationResult,
  planErrors: HarvestedConfigurationError[],
  deviationsByProject: Map<
    string,
    { root: string; targets: Map<string, TargetConfiguration> }
  >
): void {
  const fallbacks: string[] = [];
  let anyMissingFromVerification = false;
  let anyReverted = false;

  for (const [targetName, targetPlan] of state.targets) {
    if (targetPlan.rejected) {
      // Full residuals are already in place: the previous engine's exact
      // output, so there is nothing left to verify.
      anyReverted = true;
      continue;
    }
    for (const pair of targetPlan.pairs) {
      const verifiedInferred: TargetConfiguration | undefined =
        result.projects?.[pair.root]?.targets?.[targetName];
      if (!verifiedInferred) {
        anyMissingFromVerification = true;
        fallbacks.push(`${pair.projectName} > ${targetName}`);
        continue;
      }

      const hoisted =
        targetPlan.hoistedEntry !== undefined &&
        !targetPlan.excludedProjects.has(pair.projectName);
      if (
        hoisted &&
        resolveTargetOwner(result, pair.root, targetName) !==
          state.plan.pluginPath
      ) {
        // The plugin-scoped default would not resolve for a differently owned
        // pair, so the deviation write would silently drop the common keys.
        fallbacks.push(`${pair.projectName} > ${targetName}`);
        continue;
      }

      const plannedWrite = hoisted
        ? subtractCommon(pair.entry.residual, targetPlan.common)
        : structuredClone(pair.entry.residual);
      const postMigrationFinal = mergeTargetConfigurations(
        structuredClone(plannedWrite),
        structuredClone(verifiedInferred)
      );
      // stableStringify rather than deepStrictEqual: the staged baseline went
      // through `structuredClone`, whose output can carry another realm's
      // Object prototype, which deepStrictEqual rejects on structurally equal
      // objects.
      if (
        stableStringify(postMigrationFinal) !==
        stableStringify(pair.entry.baselineFinal)
      ) {
        fallbacks.push(`${pair.projectName} > ${targetName}`);
        continue;
      }

      if (hoisted) {
        if (!deviationsByProject.has(pair.projectName)) {
          deviationsByProject.set(pair.projectName, {
            root: pair.root,
            targets: new Map(),
          });
        }
        deviationsByProject
          .get(pair.projectName)
          .targets.set(targetName, plannedWrite);
      }
    }
  }

  if (fallbacks.length > 0) {
    const causes =
      anyMissingFromVerification && planErrors.length > 0
        ? ` The verification pass reported errors: ${planErrors
            .map((error) => error.message)
            .join('; ')}`
        : '';
    state.log.warn(
      `convert-to-inferred restored the pre-centralization migration output for ${fallbacks.length} target(s) that could not be verified as equivalent after migration: ${fallbacks.join(
        ', '
      )}. Centralized nx.json defaults are shadowed where their keys overlap, but the live inferred configuration may differ from the pre-migration behavior. Review these targets manually.${causes}`
    );
  }

  const errorsSurfacedByFallbackWarning =
    fallbacks.length > 0 && anyMissingFromVerification;
  if (
    planErrors.length > 0 &&
    !anyReverted &&
    !errorsSurfacedByFallbackWarning
  ) {
    const outcome =
      fallbacks.length === 0
        ? ' The migrated targets matched their pre-migration output, but review any workspace configuration the errors reference.'
        : ' Review any workspace configuration the errors reference.';
    state.log.warn(
      `convert-to-inferred could not fully verify the migration: the verification inference pass reported errors: ${planErrors
        .map((error) => error.message)
        .join('; ')}.${outcome}`
    );
  }
}

/**
 * Batch-global dead-executor cleanup, run once (the deferred children leave
 * every executor-keyed default in place). An executor stays live when any
 * plan's inference emits it, any explicit target still carries it, or an
 * untouched (not migrated by any plan) graph pair resolves it. A registration
 * added during the batch that no plan accounts for makes liveness opaque, so
 * cleanup is skipped entirely; per executor, every plan that migrated it must
 * also pass the inline fail-open gates (fresh registration, no
 * package-authored identity).
 */
function planDeadExecutorCleanup(
  tree: Tree,
  records: readonly BatchChildRecord[],
  plans: DeferredConversionPlan[],
  planStates: PlanState[],
  proposedNxJson: NxJsonConfiguration
): void {
  const anyOpaqueAddedDuringBatch = records.some((record) => {
    const before = new Set(
      record.pluginsBefore.map((registration) => JSON.stringify(registration))
    );
    return record.pluginsAfter.some(
      (registration) =>
        !plans.some((plan) =>
          isRegistrationOfPlugin(registration, plan.pluginPath)
        ) && !before.has(JSON.stringify(registration))
    );
  });
  if (anyOpaqueAddedDuringBatch) {
    return;
  }

  const liveExecutors = new Set<string>();
  for (const plan of plans) {
    for (const executor of plan.inferredExecutors) {
      liveExecutors.add(executor);
    }
  }
  for (const projectConfig of getProjects(tree).values()) {
    for (const target of Object.values(projectConfig.targets ?? {})) {
      if (target.executor) {
        liveExecutors.add(target.executor);
      }
    }
  }
  const migratedPairs = new Set<string>();
  for (const plan of plans) {
    for (const [projectName, targetMap] of plan.residualByProject) {
      for (const targetName of targetMap.keys()) {
        migratedPairs.add(`${projectName}\t${targetName}`);
      }
    }
  }
  for (const plan of plans) {
    for (const [pairKey, executor] of plan.graphExecutorByPair) {
      if (!migratedPairs.has(pairKey)) {
        liveExecutors.add(executor);
      }
    }
  }

  const statesByExecutor = new Map<string, PlanState[]>();
  for (const state of planStates) {
    for (const executor of state.plan.migratedExecutors) {
      if (!statesByExecutor.has(executor)) {
        statesByExecutor.set(executor, []);
      }
      statesByExecutor.get(executor).push(state);
    }
  }
  for (const [executor, states] of statesByExecutor) {
    const removalSafe = states.every(
      (state) =>
        !state.plan.pluginPreRegistered && !state.packageJsonAuthoredIdentity
    );
    if (removalSafe && !liveExecutors.has(executor)) {
      removeDeadExecutorTargetDefault(proposedNxJson, executor);
    }
  }
}

interface PlannedWrite {
  path: string;
  content: string;
}

/**
 * Serialize the final outcome into a byte write-set, snapshot the affected
 * paths' current virtual state, and apply. Project and package files receive
 * direct `tree.write` calls of the precomputed bytes; `nx.json` goes through
 * `updateNxJson` (a single underlying write) so a configuration read through
 * `extends` is projected back onto the local file exactly as the inline path
 * does. On any apply error the snapshots are restored and verified before the
 * error propagates (the caller downgrades it to a single warning).
 */
function applyWriteSet(
  tree: Tree,
  proposedNxJson: NxJsonConfiguration,
  deviationsByProject: Map<
    string,
    { root: string; targets: Map<string, TargetConfiguration> }
  >
): void {
  const writes: PlannedWrite[] = [];

  if (
    proposedNxJson.targetDefaults &&
    Object.keys(proposedNxJson.targetDefaults).length === 0
  ) {
    delete proposedNxJson.targetDefaults;
  }

  for (const [projectName, { root, targets }] of deviationsByProject) {
    const projectJsonPath = join(root, 'project.json');
    if (tree.exists(projectJsonPath)) {
      // The conservative full residual was written through the same helpers
      // moments ago, so mutating the parsed JSON and re-serializing yields the
      // byte output the inline deviation write would have produced.
      const projectJson = readJson(tree, projectJsonPath);
      projectJson.targets ??= {};
      for (const [targetName, deviation] of targets) {
        if (Object.keys(deviation).length > 0) {
          projectJson.targets[targetName] = deviation;
        } else {
          delete projectJson.targets[targetName];
        }
      }
      // Mirror `updateProjectConfiguration`'s empty-targets handling: the
      // `// targets` comment exists (ordered before `targets`) exactly when
      // the map is empty.
      if (Object.keys(projectJson.targets).length === 0) {
        delete projectJson.targets;
        projectJson['// targets'] =
          `to see all targets run: nx show project ${projectName} --web`;
        projectJson.targets = {};
      } else {
        delete projectJson['// targets'];
      }
      writes.push({
        path: projectJsonPath,
        content: toWrittenJson(projectJson),
      });
    } else {
      // Package-based project: the residual lives in package.json `nx.targets`.
      // An empty deviation removes the entry (the package-identity gate already
      // excluded projects where an included same-name script would take over).
      const packageJsonPath = join(root, 'package.json');
      const packageJson = readJson(tree, packageJsonPath);
      packageJson.nx ??= {};
      packageJson.nx.targets ??= {};
      for (const [targetName, deviation] of targets) {
        if (Object.keys(deviation).length > 0) {
          packageJson.nx.targets[targetName] = deviation;
        } else {
          delete packageJson.nx.targets[targetName];
        }
      }
      if (Object.keys(packageJson.nx.targets).length === 0) {
        delete packageJson.nx.targets;
      }
      writes.push({
        path: packageJsonPath,
        content: toWrittenJson(packageJson),
      });
    }
  }

  const pendingOptionsByPath = new Map(
    tree.listChanges().map((change) => [change.path, change.options])
  );
  const affectedPaths = ['nx.json', ...writes.map(({ path }) => path)];
  const snapshots = affectedPaths.map((path) => ({
    path,
    exists: tree.exists(path),
    content: tree.exists(path) ? tree.read(path) : null,
    options: pendingOptionsByPath.get(path),
  }));

  try {
    updateNxJson(tree, proposedNxJson);
    for (const write of writes) {
      tree.write(write.path, write.content);
    }
    // A write replaces the path's recorded change, dropping any staged
    // `TreeWriteOptions`; re-apply a mode staged before the finalize pass.
    for (const snapshot of snapshots) {
      if (snapshot.options?.mode !== undefined) {
        tree.changePermissions(snapshot.path, snapshot.options.mode);
      }
    }
  } catch (applyError) {
    let restoreNote: string;
    try {
      for (const snapshot of snapshots) {
        if (snapshot.exists) {
          tree.write(snapshot.path, snapshot.content);
          if (snapshot.options?.mode !== undefined) {
            // Restoring bytes identical to disk removes the recorded change
            // and its options with it; re-stage the mode explicitly.
            tree.changePermissions(snapshot.path, snapshot.options.mode);
          }
        } else if (tree.exists(snapshot.path)) {
          tree.delete(snapshot.path);
        }
      }
      const restoredChangeByPath = new Map(
        tree.listChanges().map((change) => [change.path, change])
      );
      const unrestored = snapshots.filter(
        (snapshot) =>
          tree.exists(snapshot.path) !== snapshot.exists ||
          (snapshot.exists &&
            !tree.read(snapshot.path)?.equals(snapshot.content)) ||
          restoredChangeByPath.get(snapshot.path)?.options?.mode !==
            snapshot.options?.mode
      );
      restoreNote =
        unrestored.length === 0
          ? ' The affected files were restored to their pre-centralization state.'
          : ` Restoring the affected files failed for: ${unrestored
              .map((snapshot) => snapshot.path)
              .join(', ')}; review them manually.`;
    } catch (restoreError) {
      restoreNote = ` Restoring the affected files also failed: ${
        restoreError instanceof Error ? restoreError.message : restoreError
      }; review them manually.`;
    }
    const message =
      applyError instanceof Error ? applyError.message : String(applyError);
    throw new Error(
      `applying the centralized configuration failed: ${message}.${restoreNote}`
    );
  }
}

/** The exact bytes `writeJson` would write for `value`. */
function toWrittenJson(value: object): string {
  return `${serializeJson(value)}\n`;
}
