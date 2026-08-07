import { minimatch, Minimatch } from 'minimatch';
import { deepStrictEqual } from 'node:assert';
import { join } from 'node:path/posix';
import type {
  InputDefinition,
  ProjectConfiguration,
} from 'nx/src/config/workspace-json-project-json';
import {
  readNxJson,
  readProjectConfiguration,
  getProjects,
  updateNxJson,
  updateProjectConfiguration,
  type CreateNodes,
  type ExpandedPluginConfiguration,
  type NxJsonConfiguration,
  type ProjectGraph,
  type TargetConfiguration,
  type TargetDefaultArrayEntry,
  type Tree,
} from 'nx/src/devkit-exports';
import {
  LoadedNxPlugin,
  ProjectConfigurationsError,
  mergeTargetConfigurations,
  retrieveProjectConfigurations,
  globalSpinner,
} from 'nx/src/devkit-internals';
import type { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';
import type { ConfigurationResult } from 'nx/src/project-graph/utils/project-configuration-utils';
import { forEachExecutorOptions } from '../executor-options-utils';
import {
  findTargetDefault,
  updateTargetDefault,
} from '../target-defaults-utils';
import { deleteMatchingProperties } from './plugin-migration-utils';
import { logger as devkitLogger } from 'nx/src/devkit-exports';

export type InferredTargetConfiguration = TargetConfiguration & {
  name: string;
};
type PostTargetTransformer = (
  targetConfiguration: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: InferredTargetConfiguration
) => TargetConfiguration | Promise<TargetConfiguration>;
type SkipTargetFilter = (
  targetOptions: Record<string, unknown>,
  projectConfiguration: ProjectConfiguration
) => false | string;
type SkipProjectFilter = (
  projectConfiguration: ProjectConfiguration
) => false | string;

type MigrationDefinition<T> = {
  executors: string[];
  targetPluginOptionMapper: (targetName: string) => Partial<T>;
  postTargetTransformer: PostTargetTransformer;
  skipProjectFilter?: SkipProjectFilter;
  skipTargetFilter?: SkipTargetFilter;
};

/**
 * A distinct plugin-option set used to infer targets (Phase 1). `options` is the
 * value passed to the plugin's `createNodes` (i.e. `targetPluginOptionMapper`'s
 * output) and `targetNames` are the migrated target names that option set is
 * responsible for producing.
 */
interface InferenceOptionSet<T> {
  /** Stable id used to keep inference results isolated by option set. */
  id: number;
  /** Raw mapper output — plugin defaults are never applied to inference sets. */
  options: Partial<T>;
  targetNames: Set<string>;
}

interface ExecutorScope<T> {
  executor: string;
  migration: MigrationDefinition<T>;
  targetAndProjects: Map<string, Set<string>>;
  inferenceOptionSetIdsByTarget: Map<string, number>;
}

/**
 * The result of Phase 0 (Collect). Built once per plugin from a single pass over
 * `forEachExecutorOptions`, replacing the per-executor scope derivation the
 * migrator used to do internally.
 */
export interface MigrationScope<T> {
  /** target name -> set of projects to migrate that target */
  targetsToMigrate: Map<string, Set<string>>;
  /** project -> resolved plugin registration options (defaults + mappers) */
  pluginOptionsByProject: Map<string, T>;
  /** distinct inference option sets (deduped raw `targetPluginOptionMapper` output) */
  distinctOptionSets: Partial<T>[];
  /** distinct inference option sets paired with the target names they infer */
  optionSetGroups: InferenceOptionSet<T>[];
  /** per (migration, executor) slice used to drive residual computation */
  executorScopes: ExecutorScope<T>[];
  /** projects excluded by a skipProjectFilter */
  skipped: Set<string>;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map(
      (k) =>
        JSON.stringify(k) +
        ':' +
        stableStringify((value as Record<string, unknown>)[k])
    )
    .join(',')}}`;
}

/**
 * Phase 0 — Collect (once). Fold `forEachExecutorOptions` over every
 * migration/executor into a single scope object, applying the skip filters with
 * the exact same warn-vs-throw semantics the migrator used before (a
 * `specificProjectToMigrate` skip throws instead of warning). This is the single
 * authority for filtering; downstream phases only read the returned maps.
 */
export function collectMigrationScope<T>(
  tree: Tree,
  projectGraph: ProjectGraph,
  migrations: MigrationDefinition<T>[],
  defaultPluginOptions: T,
  specificProjectToMigrate?: string,
  logger?: typeof devkitLogger
): MigrationScope<T> {
  const log = logger ?? devkitLogger;
  const targetsToMigrate = new Map<string, Set<string>>();
  const pluginOptionsByProject = new Map<string, T>();
  const executorScopes: ExecutorScope<T>[] = [];
  const skipped = new Set<string>();
  const optionSetGroupsByKey = new Map<string, InferenceOptionSet<T>>();

  for (const migration of migrations) {
    const skipProjectFilter =
      migration.skipProjectFilter ?? ((..._args) => false as const);
    const skipTargetFilter =
      migration.skipTargetFilter ?? ((..._args) => false as const);

    for (const executor of migration.executors) {
      const targetAndProjects = new Map<string, Set<string>>();
      const inferenceOptionSetIdsByTarget = new Map<string, number>();
      // Fresh per executor to preserve the previous per-migrator semantics
      // (each executor got its own migrator + skipped set).
      const skippedForExecutor = new Set<string>();

      forEachExecutorOptions(
        tree,
        executor,
        (
          options: Record<string, unknown>,
          projectName,
          targetName,
          configurationName
        ) => {
          if (skippedForExecutor.has(projectName) || configurationName) {
            return;
          }

          if (
            specificProjectToMigrate &&
            projectName !== specificProjectToMigrate
          ) {
            return;
          }

          const skipProjectReason = skipProjectFilter(
            projectGraph.nodes[projectName].data
          );
          if (skipProjectReason) {
            skippedForExecutor.add(projectName);
            skipped.add(projectName);
            const errorMsg = `The "${projectName}" project cannot be migrated. ${skipProjectReason}`;
            if (specificProjectToMigrate) {
              throw new Error(errorMsg);
            }
            log.warn(errorMsg);
            return;
          }

          const skipTargetReason = skipTargetFilter(
            options,
            projectGraph.nodes[projectName].data
          );
          if (skipTargetReason) {
            const errorMsg = `The ${targetName} target on project "${projectName}" cannot be migrated. ${skipTargetReason}`;
            if (specificProjectToMigrate) {
              throw new Error(errorMsg);
            }
            log.warn(errorMsg);
            return;
          }

          if (!targetAndProjects.has(targetName)) {
            targetAndProjects.set(targetName, new Set());
          }
          targetAndProjects.get(targetName).add(projectName);
        }
      );

      if (targetAndProjects.size === 0) {
        continue;
      }

      for (const [targetName, projs] of targetAndProjects) {
        if (!targetsToMigrate.has(targetName)) {
          targetsToMigrate.set(targetName, new Set());
        }
        const globalSet = targetsToMigrate.get(targetName);
        for (const project of projs) {
          globalSet.add(project);
        }

        const inferenceOptions = migration.targetPluginOptionMapper(targetName);
        const key = stableStringify(inferenceOptions);
        if (!optionSetGroupsByKey.has(key)) {
          optionSetGroupsByKey.set(key, {
            id: optionSetGroupsByKey.size,
            options: inferenceOptions,
            targetNames: new Set(),
          });
        }
        const optionSetGroup = optionSetGroupsByKey.get(key);
        optionSetGroup.targetNames.add(targetName);
        inferenceOptionSetIdsByTarget.set(targetName, optionSetGroup.id);

        // Invert to per-project registration options, mirroring the previous
        // `migrateProjects` inversion loop (target-grouped insertion order).
        for (const project of projs) {
          pluginOptionsByProject.set(project, {
            ...(pluginOptionsByProject.get(project) ?? ({} as T)),
            ...migration.targetPluginOptionMapper(targetName),
          } as T);
        }
      }

      executorScopes.push({
        executor,
        migration,
        targetAndProjects,
        inferenceOptionSetIdsByTarget,
      });
    }
  }

  // Apply default plugin options (registration options only).
  for (const [project, options] of pluginOptionsByProject) {
    pluginOptionsByProject.set(project, {
      ...defaultPluginOptions,
      ...options,
    });
  }

  const optionSetGroups = [...optionSetGroupsByKey.values()];

  return {
    targetsToMigrate,
    pluginOptionsByProject,
    distinctOptionSets: optionSetGroups.map((group) => group.options),
    optionSetGroups,
    executorScopes,
    skipped,
  };
}

/** The per-project residual and the equivalence oracle baseline for a target. */
export interface ResidualEntry {
  /** Byte-for-byte what the previous engine writes into project.json. */
  residual: TargetConfiguration;
  /**
   * The migrated (command-based) effective config the previous engine yields:
   * the full inferred target with the residual layered on top. Used in Phase 4
   * as the equivalence oracle.
   */
  baselineFinal: TargetConfiguration;
}

/** project name -> (target name -> residual entry) */
export type ResidualByProject = Map<string, Map<string, ResidualEntry>>;
export type InferredTargetsByRoot = Map<
  string,
  Map<string, TargetConfiguration>
>;
export type InferredTargetsByOptionSet = Map<number, InferredTargetsByRoot>;

function stripInferredTarget(
  fullInferredTarget: TargetConfiguration
): TargetConfiguration {
  const stripped: TargetConfiguration<RunCommandsOptions> =
    structuredClone(fullInferredTarget);
  delete stripped.command;
  delete stripped.options?.cwd;
  return stripped;
}

function getFullInferredTarget(
  inferredTargetsByOptionSet: InferredTargetsByOptionSet,
  optionSetId: number,
  projectRoot: string,
  targetName: string
): TargetConfiguration {
  const inferredTarget = inferredTargetsByOptionSet
    .get(optionSetId)
    ?.get(projectRoot)
    ?.get(targetName);
  if (!inferredTarget) {
    throw new Error(
      `The nx plugin did not find a project inside ${projectRoot}. File an issue at https://github.com/nrwl/nx with information about your project structure.`
    );
  }
  return inferredTarget;
}

/**
 * Phase 2 — Per-project residual (in-memory, no inference). For each
 * `(project, target)` computes the residual exactly as the previous engine did
 * (`mergeTargetConfigurations` with the executor target defaults ->
 * `deleteMatchingProperties` -> input merge -> the plugin's
 * `postTargetTransformer`), plus `baselineFinal = merge(residual, inferred)` as
 * the equivalence oracle. Does NOT write project.json.
 */
export async function computeResidualByProject<T>(
  tree: Tree,
  projectGraph: ProjectGraph,
  scope: MigrationScope<T>,
  inferredTargetsByOptionSet: InferredTargetsByOptionSet,
  nxJson: NxJsonConfiguration,
  projectConfigsByName: Map<string, ProjectConfiguration> = getProjects(tree)
): Promise<ResidualByProject> {
  const residualByProject: ResidualByProject = new Map();

  for (const executorScope of scope.executorScopes) {
    const targetDefaultsForExecutor = structuredClone(
      readTargetDefaultsForExecutor(
        executorScope.executor,
        nxJson.targetDefaults
      ) ?? {}
    );

    for (const [targetName, projectNames] of executorScope.targetAndProjects) {
      const optionSetId =
        executorScope.inferenceOptionSetIdsByTarget.get(targetName);
      if (optionSetId === undefined) {
        throw new Error(
          `Could not find an inference option set for target "${targetName}".`
        );
      }
      for (const projectName of projectNames) {
        const root = projectGraph.nodes[projectName].data.root;
        const fullInferredTarget = getFullInferredTarget(
          inferredTargetsByOptionSet,
          optionSetId,
          root,
          targetName
        );
        const strippedInferredTarget = stripInferredTarget(fullInferredTarget);

        const projectConfig = readCachedProjectConfiguration(
          tree,
          projectConfigsByName,
          projectName
        );
        let projectTarget = projectConfig.targets[targetName];
        projectTarget = mergeTargetConfigurations(
          projectTarget,
          targetDefaultsForExecutor
        );
        delete projectTarget.executor;

        deleteMatchingProperties(projectTarget, strippedInferredTarget);

        if (projectTarget.inputs && strippedInferredTarget.inputs) {
          mergeInputs(projectTarget, strippedInferredTarget);
        }

        projectTarget = await executorScope.migration.postTargetTransformer(
          projectTarget,
          tree,
          { projectName, root },
          { ...strippedInferredTarget, name: targetName }
        );

        if (
          projectTarget.options &&
          Object.keys(projectTarget.options).length === 0
        ) {
          delete projectTarget.options;
        }

        const residual = projectTarget;
        const baselineFinal = mergeTargetConfigurations(
          structuredClone(residual),
          structuredClone(fullInferredTarget)
        );

        if (!residualByProject.has(projectName)) {
          residualByProject.set(projectName, new Map());
        }
        residualByProject
          .get(projectName)
          .set(targetName, { residual, baselineFinal });
      }
    }
  }

  return residualByProject;
}

/**
 * Phase 3 (single-project-mode variant) — write the full residual into each
 * project.json, exactly reproducing the previous per-(project, target) write
 * sequence. Single-project mode never centralizes, so this is its permanent
 * write path.
 */
function writeResiduals<T>(
  tree: Tree,
  projectConfigsByName: Map<string, ProjectConfiguration>,
  projectGraph: ProjectGraph,
  scope: MigrationScope<T>,
  residualByProject: ResidualByProject
) {
  for (const executorScope of scope.executorScopes) {
    for (const [targetName, projectNames] of executorScope.targetAndProjects) {
      for (const projectName of projectNames) {
        const entry = residualByProject.get(projectName)?.get(targetName);
        if (!entry) {
          continue;
        }
        writeResidualTarget(
          tree,
          projectConfigsByName,
          projectName,
          targetName,
          structuredClone(entry.residual)
        );
      }
    }
  }
}

/** Write a single residual target into project.json (or delete it if empty). */
function writeResidualTarget(
  tree: Tree,
  projectConfigsByName: Map<string, ProjectConfiguration>,
  projectName: string,
  targetName: string,
  residual: TargetConfiguration
) {
  const projectConfig = readCachedProjectConfiguration(
    tree,
    projectConfigsByName,
    projectName
  );

  if (Object.keys(residual).length > 0) {
    projectConfig.targets[targetName] = residual;
  } else {
    delete projectConfig.targets[targetName];
  }

  if (!projectConfig['// targets']) {
    projectConfig['// targets'] =
      `to see all targets run: nx show project ${projectName} --web`;
  }

  updateProjectConfiguration(tree, projectName, projectConfig);
}

function readCachedProjectConfiguration(
  tree: Tree,
  projectConfigsByName: Map<string, ProjectConfiguration>,
  projectName: string
): ProjectConfiguration {
  const projectConfig = projectConfigsByName.get(projectName);
  if (projectConfig) {
    return projectConfig;
  }
  const readProjectConfig = readProjectConfiguration(tree, projectName);
  projectConfigsByName.set(projectName, readProjectConfig);
  return readProjectConfig;
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  try {
    deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

/**
 * Phase 3 — the strict-common residual across ALL migrated projects for a
 * target: the values that are deep-equal across every project's residual.
 * Granularity: whole value for top-level target props (`inputs`, `outputs`,
 * `cache`, `dependsOn`, `configurations`, …); per-key for `options`. A key is
 * common only when EVERY residual carries it with an identical value.
 */
export function computeStrictCommon(
  residuals: TargetConfiguration[]
): TargetConfiguration {
  if (residuals.length === 0) {
    return {};
  }

  const [first, ...rest] = residuals;
  const common: TargetConfiguration = {};

  for (const key of Object.keys(first)) {
    if (key === 'options') {
      continue;
    }
    const value = (first as Record<string, unknown>)[key];
    const isCommon = rest.every((residual) => {
      const r = residual as Record<string, unknown>;
      return key in r && isDeepEqual(r[key], value);
    });
    if (isCommon) {
      (common as Record<string, unknown>)[key] = structuredClone(value);
    }
  }

  const firstOptions = first.options as Record<string, unknown> | undefined;
  if (firstOptions && typeof firstOptions === 'object') {
    const commonOptions: Record<string, unknown> = {};
    for (const optKey of Object.keys(firstOptions)) {
      const optValue = firstOptions[optKey];
      const isCommon = rest.every((residual) => {
        const options = residual.options as Record<string, unknown> | undefined;
        return (
          options &&
          typeof options === 'object' &&
          optKey in options &&
          isDeepEqual(options[optKey], optValue)
        );
      });
      if (isCommon) {
        commonOptions[optKey] = structuredClone(optValue);
      }
    }
    if (Object.keys(commonOptions).length > 0) {
      common.options = commonOptions;
    }
  }

  return common;
}

/** `residual` with every property that the strict-common config carries removed. */
function subtractCommon(
  residual: TargetConfiguration,
  common: TargetConfiguration
): TargetConfiguration {
  const deviation = structuredClone(residual);

  for (const key of Object.keys(common)) {
    if (key === 'options') {
      continue;
    }
    const d = deviation as Record<string, unknown>;
    if (
      key in d &&
      isDeepEqual(d[key], (common as Record<string, unknown>)[key])
    ) {
      delete d[key];
    }
  }

  if (common.options && deviation.options) {
    const commonOptions = common.options as Record<string, unknown>;
    const deviationOptions = deviation.options as Record<string, unknown>;
    for (const optKey of Object.keys(commonOptions)) {
      if (
        optKey in deviationOptions &&
        isDeepEqual(deviationOptions[optKey], commonOptions[optKey])
      ) {
        delete deviationOptions[optKey];
      }
    }
    if (Object.keys(deviationOptions).length === 0) {
      delete deviation.options;
    }
  }

  return deviation;
}

/**
 * Whether any target still uses the executor (post-migration). The cached
 * project map is mutated in place by every residual write, so it already
 * carries the post-write state — no whole-workspace re-scan needed.
 */
function isExecutorStillUsed(
  projectConfigsByName: Map<string, ProjectConfiguration>,
  executor: string
): boolean {
  for (const projectConfig of projectConfigsByName.values()) {
    for (const target of Object.values(projectConfig.targets ?? {})) {
      if (target.executor === executor) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Remove the now-dead executor-keyed target default that Phase 2 inlined into
 * every migrated project (mirrors `readTargetDefaultsForExecutor`'s match: the
 * unfiltered entry keyed directly by the executor string).
 */
function removeDeadExecutorTargetDefault(
  nxJson: NxJsonConfiguration,
  executor: string
): void {
  updateTargetDefault(nxJson, { executor }, (_config, info) =>
    info.key === executor && info.filter === undefined ? null : undefined
  );
}

/**
 * Append the hoisted common as a plugin-scoped entry after whatever value the
 * key already holds. Existing entries — the workspace catch-all and any
 * user-authored filtered entries — are never modified, so targets outside this
 * plugin resolve exactly what they resolved before the migration. The entry is
 * appended (never merged into an existing one) so the verification pass can
 * revert precisely this entry and nothing else.
 */
function appendPluginScopedTargetDefault(
  nxJson: NxJsonConfiguration,
  targetName: string,
  pluginPath: string,
  common: TargetConfiguration
): TargetDefaultArrayEntry {
  const entry: TargetDefaultArrayEntry = {
    filter: { plugin: pluginPath },
    ...structuredClone(common),
  };
  nxJson.targetDefaults ??= {};
  const existing = nxJson.targetDefaults[targetName];
  nxJson.targetDefaults[targetName] =
    existing === undefined
      ? [entry]
      : Array.isArray(existing)
        ? [...existing, entry]
        : [existing, entry];
  return entry;
}

/**
 * Remove a previously appended plugin-scoped entry, collapsing the value back
 * to the plain object form when only a lone unfiltered entry remains. The
 * appended entry survives an `updateNxJson`/`readNxJson` round trip only by
 * value, so the last deep-equal occurrence (append order puts ours last) is
 * the one removed.
 */
function removeHoistedTargetDefault(
  nxJson: NxJsonConfiguration,
  targetName: string,
  entry: TargetDefaultArrayEntry
): void {
  const value = nxJson.targetDefaults?.[targetName];
  if (!Array.isArray(value)) {
    return;
  }
  const entryKey = stableStringify(entry);
  const remaining = [...value];
  for (let i = remaining.length - 1; i >= 0; i--) {
    if (stableStringify(remaining[i]) === entryKey) {
      remaining.splice(i, 1);
      break;
    }
  }
  if (remaining.length === 0) {
    delete nxJson.targetDefaults[targetName];
  } else if (remaining.length === 1 && remaining[0].filter === undefined) {
    const { filter: _filter, ...config } = remaining[0];
    nxJson.targetDefaults[targetName] = config;
  } else {
    nxJson.targetDefaults[targetName] = remaining;
  }
}

/**
 * Phase 3 (centralized variant) — hoist the strict-common residual per target
 * into `nx.json` `targetDefaults[targetName]` as a plugin-scoped array entry,
 * remove the dead executor-keyed entries, and write only per-project
 * deviations to project.json. Used for whole-workspace migrations;
 * single-project mode keeps the full residual.
 *
 * Returns the appended entry per target so the verification pass can revert a
 * hoist that turns out to reach a target the migration did not migrate.
 */
function hoistCommonAndWrite<T>(
  tree: Tree,
  projectConfigsByName: Map<string, ProjectConfiguration>,
  scope: MigrationScope<T>,
  residualByProject: ResidualByProject,
  pluginPath: string
): Map<string, TargetDefaultArrayEntry> {
  // Group residuals by target name across all migrated projects.
  const residualsByTarget = new Map<string, TargetConfiguration[]>();
  for (const targetMap of residualByProject.values()) {
    for (const [targetName, entry] of targetMap) {
      if (!residualsByTarget.has(targetName)) {
        residualsByTarget.set(targetName, []);
      }
      residualsByTarget.get(targetName).push(entry.residual);
    }
  }

  const commonByTarget = new Map<string, TargetConfiguration>();
  // Deterministic target-name order for stable nx.json output.
  for (const targetName of [...residualsByTarget.keys()].sort()) {
    const residuals = residualsByTarget.get(targetName);
    // Centralization only pays off when at least two projects share the same
    // target; a single migrated project keeps its full residual in
    // project.json. The hoisted entry is scoped to this plugin's targets via
    // its `filter`, and the verification pass reverts it if a non-migrated
    // root still inherits it — the guard here is about de-bloat, not safety.
    const common = residuals.length >= 2 ? computeStrictCommon(residuals) : {};
    commonByTarget.set(targetName, common);
  }

  // Write per-project deviations first so migrated targets drop their executor
  // before we decide whether an executor-keyed target default is still needed.
  for (const executorScope of scope.executorScopes) {
    for (const [targetName, projectNames] of executorScope.targetAndProjects) {
      const common = commonByTarget.get(targetName) ?? {};
      for (const projectName of projectNames) {
        const entry = residualByProject.get(projectName)?.get(targetName);
        if (!entry) {
          continue;
        }
        writeResidualTarget(
          tree,
          projectConfigsByName,
          projectName,
          targetName,
          subtractCommon(entry.residual, common)
        );
      }
    }
  }

  // Update nx.json targetDefaults: hoist commons, drop dead executor entries.
  const nxJson = readNxJson(tree);
  nxJson.targetDefaults ??= {};

  const hoistedByTarget = new Map<string, TargetDefaultArrayEntry>();
  for (const targetName of [...commonByTarget.keys()].sort()) {
    const common = commonByTarget.get(targetName);
    if (Object.keys(common).length === 0) {
      continue;
    }
    hoistedByTarget.set(
      targetName,
      appendPluginScopedTargetDefault(nxJson, targetName, pluginPath, common)
    );
  }

  const migratedExecutors = new Set(
    scope.executorScopes.map((executorScope) => executorScope.executor)
  );
  for (const executor of migratedExecutors) {
    if (!isExecutorStillUsed(projectConfigsByName, executor)) {
      removeDeadExecutorTargetDefault(nxJson, executor);
    }
  }

  if (
    nxJson.targetDefaults &&
    Object.keys(nxJson.targetDefaults).length === 0
  ) {
    delete nxJson.targetDefaults;
  }

  updateNxJson(tree, nxJson);
  return hoistedByTarget;
}

function mergeInputs(
  target: TargetConfiguration,
  inferredTarget: TargetConfiguration
) {
  const isInputInferred = (input: string | InputDefinition) => {
    return inferredTarget.inputs.some((inferredInput) => {
      try {
        deepStrictEqual(input, inferredInput);
        return true;
      } catch {
        return false;
      }
    });
  };

  if (target.inputs.every(isInputInferred)) {
    delete target.inputs;
    return;
  }

  const inferredTargetExternalDependencyInput = inferredTarget.inputs.find(
    (i): i is { externalDependencies: string[] } =>
      typeof i !== 'string' && 'externalDependencies' in i
  );
  if (!inferredTargetExternalDependencyInput) {
    // plugins should normally have an externalDependencies input, but if it
    // doesn't, there's nothing to merge
    return;
  }

  const targetExternalDependencyInput = target.inputs.find(
    (i): i is { externalDependencies: string[] } =>
      typeof i !== 'string' && 'externalDependencies' in i
  );
  if (!targetExternalDependencyInput) {
    // the target doesn't have an externalDependencies input, so we can just
    // add the inferred one
    target.inputs.push(inferredTargetExternalDependencyInput);
  } else {
    // the target has an externalDependencies input, so we need to merge them
    targetExternalDependencyInput.externalDependencies = Array.from(
      new Set([
        ...targetExternalDependencyInput.externalDependencies,
        ...inferredTargetExternalDependencyInput.externalDependencies,
      ])
    );
  }
}

export class NoTargetsToMigrateError extends Error {
  constructor() {
    super('Could not find any targets to migrate.');
  }
}

export function readTargetDefaultsForExecutor(
  executor: string,
  targetDefaults: NxJsonConfiguration['targetDefaults'] | undefined
): Partial<TargetConfiguration> | undefined {
  // Preserve the legacy record-shape semantics this migrator used before
  // array support: only an unfiltered default keyed directly by executor
  // applies here. Target-scoped or filtered array entries remain opt-in
  // behaviors for callers that can evaluate them in project context.
  const entry = findTargetDefault(targetDefaults, { executor });
  if (!entry) {
    return undefined;
  }

  const config = { ...entry };
  delete config.target;
  delete config.executor;
  delete config.projects;
  delete config.plugin;
  return config;
}

export async function migrateProjectExecutorsToPlugin<T>(
  tree: Tree,
  projectGraph: ProjectGraph,
  pluginPath: string,
  createNodesV2: CreateNodes<T>,
  defaultPluginOptions: T,
  migrations: Array<{
    executors: string[];
    targetPluginOptionMapper: (targetName: string) => Partial<T>;
    postTargetTransformer: PostTargetTransformer;
    skipProjectFilter?: SkipProjectFilter;
    skipTargetFilter?: SkipTargetFilter;
  }>,
  specificProjectToMigrate?: string,
  logger?: typeof devkitLogger
): Promise<Map<string, Record<string, string>>> {
  const projects = await migrateProjects(
    tree,
    projectGraph,
    pluginPath,
    undefined,
    createNodesV2,
    defaultPluginOptions,
    migrations,
    specificProjectToMigrate,
    logger
  );

  return projects;
}

export async function migrateProjectExecutorsToPluginV1<T>(
  tree: Tree,
  projectGraph: ProjectGraph,
  pluginPath: string,
  createNodes: CreateNodes<T>,
  defaultPluginOptions: T,
  migrations: Array<{
    executors: string[];
    targetPluginOptionMapper: (targetName: string) => Partial<T>;
    postTargetTransformer: PostTargetTransformer;
    skipProjectFilter?: SkipProjectFilter;
    skipTargetFilter?: SkipTargetFilter;
  }>,
  specificProjectToMigrate?: string
): Promise<Map<string, Record<string, string>>> {
  const projects = await migrateProjects(
    tree,
    projectGraph,
    pluginPath,
    createNodes,
    undefined,
    defaultPluginOptions,
    migrations,
    specificProjectToMigrate
  );

  return projects;
}

/**
 * Phase 1 — Infer (once per distinct option set). Runs a whole-workspace
 * inference per distinct plugin-option set (usually one) instead of once per
 * target and once per project. Builds `inferredTargetsByOptionSet` (option set
 * id -> project root -> target name -> FULL inferred target; residual
 * computation strips `command` / `options.cwd` at the point of use) that every
 * later phase reads from, plus the matched config files owned by an inferred
 * project root (used for analytic include coverage).
 */
export async function inferOncePerOptionSet<T>(
  tree: Tree,
  pluginPath: string,
  createNodes: CreateNodes<T> | undefined,
  createNodesV2: CreateNodes<T> | undefined,
  nxJson: NxJsonConfiguration,
  scope: MigrationScope<T>
): Promise<{
  inferredTargetsByOptionSet: InferredTargetsByOptionSet;
  matchedConfigFiles: string[];
}> {
  const inferredTargetsByOptionSet: InferredTargetsByOptionSet = new Map();
  const rawMatchedFiles = new Set<string>();
  const inferredRoots = new Set<string>();

  if (scope.optionSetGroups.length === 0) {
    return { inferredTargetsByOptionSet, matchedConfigFiles: [] };
  }

  global.NX_GRAPH_CREATION = true;
  try {
    for (const group of scope.optionSetGroups) {
      const inferredByRoot: InferredTargetsByRoot = new Map();
      inferredTargetsByOptionSet.set(group.id, inferredByRoot);
      const result = await getCreateNodesResultsForPlugin(
        tree,
        { plugin: pluginPath, options: group.options },
        pluginPath,
        createNodes,
        createNodesV2,
        nxJson
      );

      // The plugin's glob pattern is option-independent, so every option set
      // matches the same config files; union defensively.
      for (const file of result?.matchingProjectFiles ?? []) {
        rawMatchedFiles.add(file);
      }

      for (const [root, projectConfig] of Object.entries(
        result?.projects ?? {}
      )) {
        // Every root the plugin produces a project for. Config files whose
        // owning root is NOT one of these produce no project and can be safely
        // excluded by an `include` without changing the inferred set — this is
        // why include-necessity must be judged against inferred roots, not the
        // raw glob (which also matches package.json/project.json/etc.).
        inferredRoots.add(root);

        for (const targetName of group.targetNames) {
          const inferredTarget = projectConfig.targets?.[targetName];
          if (!inferredTarget) {
            continue;
          }
          // Store the FULL inferred (command-based) target. Residual
          // computation strips `command`/`options.cwd` at the point of use;
          // `baselineFinal` (the equivalence oracle) needs the full form.
          if (!inferredByRoot.has(root)) {
            inferredByRoot.set(root, new Map());
          }
          inferredByRoot
            .get(root)
            .set(targetName, structuredClone(inferredTarget));
        }
      }
    }
  } finally {
    global.NX_GRAPH_CREATION = false;
  }

  // Keep only config files owned by an inferred project root (i.e. files that
  // actually contribute a project). Include-coverage is decided against these.
  // Both sets scale with project count — materialize the roots once, not per
  // matched file.
  const roots = [...inferredRoots];
  const matchedConfigFiles = [...rawMatchedFiles].filter((file) =>
    roots.some((root) => isFileUnderRoot(file, root))
  );

  return { inferredTargetsByOptionSet, matchedConfigFiles };
}

/** Whether `file` (workspace-relative) belongs to project root `root`. */
function isFileUnderRoot(file: string, root: string): boolean {
  if (root === '.') {
    // The root project owns workspace-root-level files (no path separator).
    return !file.includes('/');
  }
  return file === root || file.startsWith(`${root}/`);
}

/**
 * Whether a registration's `include` globs already cover every config file the
 * plugin globs that is owned by an inferred project root (so the registration
 * can be left unscoped). Plugin inference is a pure function of the matched
 * config-file set, so this answers what the old per-project
 * `arePluginIncludesRequired` re-inference computed without running any
 * additional inference — differing only on matched files that contribute no
 * project: those are invisible here, so an `include` the old diff-based check
 * kept for their sake is now deleted, letting future config files in such
 * locations infer eagerly. The Phase 4 verification pass guards the current
 * behavioral outcome either way.
 */
function includeCoversAllConfigFiles(
  include: string[] | undefined,
  exclude: string[] | undefined,
  configFiles: string[]
): boolean {
  if (!include || include.length === 0) {
    return true;
  }
  // The bare `minimatch()` helper recompiles its pattern on every call, and
  // both the include list and the config-file list scale with project count —
  // compile each glob exactly once.
  const includeMatchers = include.map(
    (glob) => new Minimatch(glob, { dot: true })
  );
  const excludeMatchers = (exclude ?? []).map(
    (glob) => new Minimatch(glob, { dot: true })
  );
  return configFiles.every(
    (file) =>
      includeMatchers.some((matcher) => matcher.match(file)) &&
      !excludeMatchers.some((matcher) => matcher.match(file))
  );
}

/**
 * Phase 4 — a single verification inference pass over the whole workspace with
 * the updated `nx.json` plugin registrations. One
 * `retrieveProjectConfigurations` call runs every registration for this plugin
 * (the plugin's `createNodes` executes once per registration group). The
 * equivalence oracle + fallback in `verifyAndFallback` consume the result.
 */
async function runVerificationPass<T>(
  tree: Tree,
  pluginPath: string,
  createNodes: CreateNodes<T> | undefined,
  createNodesV2: CreateNodes<T> | undefined
): Promise<{ result: ConfigurationResult | undefined; errors: string[] }> {
  const nxJson = readNxJson(tree);
  const registrations = (nxJson.plugins ?? []).filter(
    (plugin): plugin is string | ExpandedPluginConfiguration =>
      plugin === pluginPath ||
      (typeof plugin !== 'string' && plugin.plugin === pluginPath)
  );
  if (registrations.length === 0) {
    return { result: undefined, errors: [] };
  }

  global.NX_GRAPH_CREATION = true;
  try {
    const plugins = registrations.map(
      (registration) =>
        new LoadedNxPlugin(
          { createNodes, createNodesV2, name: pluginPath },
          registration
        )
    );
    return {
      result: await retrieveProjectConfigurations(
        { specifiedPlugins: plugins, defaultPlugins: [] },
        tree.root,
        nxJson
      ),
      errors: [],
    };
  } catch (e) {
    if (e instanceof ProjectConfigurationsError) {
      // Verify against the partial result, but keep the causes — they are the
      // only diagnostic for why affected projects fall back.
      return {
        result: e.partialProjectConfigurationsResult,
        errors: e.errors.map((error) => error.message ?? String(error)),
      };
    }
    throw e;
  } finally {
    global.NX_GRAPH_CREATION = false;
  }
}

/**
 * Phase 4 — run the single verification inference pass, then apply the
 * equivalence oracle. `retrieveProjectConfigurations` already merges
 * `targetDefaults` into the inferred targets, so the real post-migration
 * effective config for a target is `merge(project.json deviation, verified
 * inferred+targetDefaults)`. It must deep-equal `baselineFinal` (the previous
 * engine's migrated effective config, from Phase 2). Any project that fails —
 * or that the intended target no longer infers for at all — is restored to the
 * exact pre-centralization migration output (a full residual; an empty
 * residual removes the target), and every fallback is summarized in a single
 * `logger.warn` that asks for manual review rather than asserting equivalence
 * the pass could not establish.
 */
async function verifyAndFallback<T>(
  tree: Tree,
  projectGraph: ProjectGraph,
  pluginPath: string,
  createNodes: CreateNodes<T> | undefined,
  createNodesV2: CreateNodes<T> | undefined,
  residualByProject: ResidualByProject,
  projectConfigsByName: Map<string, ProjectConfiguration>,
  hoistedByTarget: Map<string, TargetDefaultArrayEntry>,
  singleProjectMode: boolean,
  logger: typeof devkitLogger | undefined
): Promise<void> {
  // Single-project mode never hoists, so there is nothing to reconcile — and
  // no reason to pay for a whole-workspace verification inference.
  if (singleProjectMode) {
    return;
  }

  const { result: verifyResult, errors: verificationErrors } =
    await runVerificationPass(tree, pluginPath, createNodes, createNodesV2);
  if (!verifyResult) {
    return;
  }

  // The hoist's contract is: behavioral equivalence for migrated targets, no
  // effect on anything else. A root this plugin infers the target for that was
  // NOT migrated (inferred-only, or covered by a pre-existing registration)
  // would inherit the plugin-scoped default, so revert that target's hoist
  // entirely: drop the appended entry and restore every full residual.
  const migratedRootsByTarget = new Map<string, Set<string>>();
  for (const [projectName, targetMap] of residualByProject) {
    const root = projectGraph.nodes[projectName]?.data?.root;
    for (const targetName of targetMap.keys()) {
      if (!migratedRootsByTarget.has(targetName)) {
        migratedRootsByTarget.set(targetName, new Set());
      }
      migratedRootsByTarget.get(targetName).add(root);
    }
  }

  const revertedTargets = new Set<string>();
  for (const [targetName] of hoistedByTarget) {
    const migratedRoots =
      migratedRootsByTarget.get(targetName) ?? new Set<string>();
    const reachesNonMigratedRoot = Object.entries(
      verifyResult.projects ?? {}
    ).some(
      ([root, projectConfig]) =>
        projectConfig.targets?.[targetName] !== undefined &&
        !migratedRoots.has(root)
    );
    if (reachesNonMigratedRoot) {
      revertedTargets.add(targetName);
    }
  }

  if (revertedTargets.size > 0) {
    const nxJson = readNxJson(tree);
    for (const targetName of revertedTargets) {
      removeHoistedTargetDefault(
        nxJson,
        targetName,
        hoistedByTarget.get(targetName)
      );
    }
    updateNxJson(tree, nxJson);
    for (const [projectName, targetMap] of residualByProject) {
      for (const [targetName, entry] of targetMap) {
        if (!revertedTargets.has(targetName)) {
          continue;
        }
        writeResidualTarget(
          tree,
          projectConfigsByName,
          projectName,
          targetName,
          structuredClone(entry.residual)
        );
      }
    }
    (logger ?? devkitLogger).warn(
      `convert-to-inferred kept per-project configuration for target(s) ${[
        ...revertedTargets,
      ]
        .sort()
        .join(
          ', '
        )} instead of centralizing it: other projects inferred by this plugin would have inherited the centralized configuration. The migrated projects keep the same output as before centralization.`
    );
  }

  const fallbacks: string[] = [];
  let anyMissingFromVerification = false;

  for (const [projectName, targetMap] of residualByProject) {
    const root = projectGraph.nodes[projectName]?.data?.root;
    for (const [targetName, entry] of targetMap) {
      if (revertedTargets.has(targetName)) {
        // Restored to the full pre-centralization residual above — already the
        // previous engine's exact output, so there is nothing left to verify.
        continue;
      }
      const verifiedInferred: TargetConfiguration | undefined =
        verifyResult.projects?.[root]?.targets?.[targetName];
      if (!verifiedInferred) {
        anyMissingFromVerification = true;
      }

      let equivalent = false;
      if (verifiedInferred) {
        const projectConfig = readCachedProjectConfiguration(
          tree,
          projectConfigsByName,
          projectName
        );
        const deviation = projectConfig.targets?.[targetName] ?? {};
        const postMigrationFinal = mergeTargetConfigurations(
          structuredClone(deviation),
          structuredClone(verifiedInferred)
        );
        equivalent = isDeepEqual(postMigrationFinal, entry.baselineFinal);
      }

      if (!equivalent) {
        // Drop this project's hoist: restore its full residual as an explicit
        // project.json override (which wins over the shared targetDefaults).
        writeResidualTarget(
          tree,
          projectConfigsByName,
          projectName,
          targetName,
          structuredClone(entry.residual)
        );
        fallbacks.push(`${projectName} > ${targetName}`);
      }
    }
  }

  if (fallbacks.length > 0) {
    // Surface the pass's own errors only when a target vanished from the
    // verification result — the one fallback class an inference error can
    // explain. Divergence fallbacks have a verified config; appending
    // unrelated pass errors to them would misattribute the cause.
    const causes =
      anyMissingFromVerification && verificationErrors.length > 0
        ? ` The verification pass reported errors: ${verificationErrors.join(
            '; '
          )}`
        : '';
    (logger ?? devkitLogger).warn(
      `convert-to-inferred restored the pre-centralization migration output for ${fallbacks.length} target(s) that could not be verified as equivalent after migration: ${fallbacks.join(
        ', '
      )}. Centralized nx.json defaults are shadowed where their keys overlap, but the live inferred configuration may differ from the pre-migration behavior — review these targets manually.${causes}`
    );
  }
}

/**
 * Recover the default option keys a plugin fills into its options object during
 * `createNodes` (Phase 1 mutated each option-set object in place if the plugin
 * does so). A key qualifies only if it is not one of our own
 * `defaultPluginOptions` and appears with an identical value across every
 * option set — the signature of a plugin default fill. (A mapper-provided key
 * that is constant across every option set is indistinguishable and also
 * qualifies; harmless, since per-project options are spread over these.)
 * Reproduces the previous engine's incidental option enrichment without extra
 * inference.
 */
function derivePluginFilledDefaults<T>(
  optionSetGroups: InferenceOptionSet<T>[],
  defaultPluginOptions: T
): Partial<T> {
  const filled: Record<string, unknown> = {};
  if (optionSetGroups.length === 0) {
    return filled as Partial<T>;
  }

  const defaults = (defaultPluginOptions ?? {}) as Record<string, unknown>;
  const seen = new Map<
    string,
    { value: unknown; count: number; consistent: boolean }
  >();
  for (const group of optionSetGroups) {
    for (const [key, value] of Object.entries(
      (group.options ?? {}) as Record<string, unknown>
    )) {
      if (key in defaults) {
        continue;
      }
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, { value, count: 1, consistent: true });
      } else {
        existing.count++;
        if (stableStringify(existing.value) !== stableStringify(value)) {
          existing.consistent = false;
        }
      }
    }
  }

  for (const [key, entry] of seen) {
    if (entry.consistent && entry.count === optionSetGroups.length) {
      filled[key] = entry.value;
    }
  }

  return filled as Partial<T>;
}

async function migrateProjects<T>(
  tree: Tree,
  projectGraph: ProjectGraph,
  pluginPath: string,
  createNodes: CreateNodes<T>,
  createNodesV2: CreateNodes<T>,
  defaultPluginOptions: T,
  migrations: Array<{
    executors: string[];
    targetPluginOptionMapper: (targetName: string) => Partial<T>;
    postTargetTransformer: PostTargetTransformer;
    skipProjectFilter?: SkipProjectFilter;
    skipTargetFilter?: SkipTargetFilter;
  }>,
  specificProjectToMigrate?: string,
  logger?: typeof devkitLogger
): Promise<Map<string, Record<string, string>>> {
  const projects = new Map<string, Record<string, string>>();
  const spinner = globalSpinner.start(
    `Calculating migration scope...`,
    pluginPath
  );

  // Phase 0 — Collect (once): scope + filtering + per-project options.
  const scope = collectMigrationScope(
    tree,
    projectGraph,
    migrations,
    defaultPluginOptions,
    specificProjectToMigrate,
    logger
  );
  const projectConfigsByName = getProjects(tree);

  // Phase 1 — Infer (once per distinct option set) for the whole workspace.
  const nxJson = readNxJson(tree);
  const { inferredTargetsByOptionSet, matchedConfigFiles } =
    await inferOncePerOptionSet(
      tree,
      pluginPath,
      createNodes,
      createNodesV2,
      nxJson,
      scope
    );

  // Phase 2 — Per-project residual (in-memory, no re-inference). Also captures
  // `baselineFinal` (the equivalence oracle consumed in Phase 4).
  const residualByProject = await computeResidualByProject(
    tree,
    projectGraph,
    scope,
    inferredTargetsByOptionSet,
    nxJson,
    projectConfigsByName
  );

  // Phase 3 — Derive strict-common + write. Single-project mode never hoists
  // (would leak shared config to sibling projects), so it keeps the full
  // residual in project.json; whole-workspace mode hoists the common config to
  // a plugin-scoped `targetDefaults` entry and writes only per-project
  // deviations.
  let hoistedByTarget = new Map<string, TargetDefaultArrayEntry>();
  if (specificProjectToMigrate) {
    writeResiduals(
      tree,
      projectConfigsByName,
      projectGraph,
      scope,
      residualByProject
    );
  } else {
    hoistedByTarget = hoistCommonAndWrite(
      tree,
      projectConfigsByName,
      scope,
      residualByProject,
      pluginPath
    );
  }

  // Some plugins' `createNodes` normalize their options object in place (e.g.
  // `options.devTargetName ??= 'dev'`). The previous engine inferred once per
  // project passing the project's registration-options object by reference, so
  // those objects picked up the plugin's default keys. Phase 1 runs the same
  // inference on each option-set object, so recover exactly those plugin-filled
  // default keys (without any extra inference) and merge them back so the
  // emitted registration options stay identical.
  const pluginFilledDefaults = derivePluginFilledDefaults(
    scope.optionSetGroups,
    defaultPluginOptions
  );
  for (const [project, options] of scope.pluginOptionsByProject) {
    projects.set(project, {
      ...pluginFilledDefaults,
      ...options,
    } as Record<string, string>);
  }

  // Phase 3/4 — one-shot plugin registration + analytic include computation.
  addPluginRegistrations(
    tree,
    projects,
    pluginPath,
    defaultPluginOptions,
    projectGraph,
    spinner,
    matchedConfigFiles
  );

  // Phase 4 — single verification inference pass + equivalence oracle. Any
  // project whose centralized config cannot be verified as equivalent falls
  // back to a full project.json override (summarized in one logger.warn).
  await verifyAndFallback(
    tree,
    projectGraph,
    pluginPath,
    createNodes,
    createNodesV2,
    residualByProject,
    projectConfigsByName,
    hoistedByTarget,
    Boolean(specificProjectToMigrate),
    logger
  );

  spinner.succeed(`Migrated configuration for ${projects.size} project(s).\n`);

  return projects;
}

function addPluginRegistrations<T>(
  tree: Tree,
  projects: Map<string, Record<string, string>>,
  pluginPath: string,
  defaultPluginOptions: T,
  projectGraph: ProjectGraph,
  spinner: typeof globalSpinner,
  // The matched config files owned by an inferred project root (the filtered
  // subset from the Phase 1 inference — files outside any inferred root
  // contribute no project and are deliberately excluded). Used to decide
  // analytically whether a registration's `include` globs already cover
  // everything (so it can be left unscoped).
  matchedConfigFiles: string[]
) {
  const nxJson = readNxJson(tree);

  const registrationGroups = new Map<
    string,
    { options: Record<string, string>; include: string[] }
  >();
  for (const [project, options] of projects.entries()) {
    const projectIncludeGlob =
      projectGraph.nodes[project].data.root === '.'
        ? '*'
        : join(projectGraph.nodes[project].data.root, '**/*');
    const key = stableStringify(options);
    if (!registrationGroups.has(key)) {
      registrationGroups.set(key, { options, include: [] });
    }
    registrationGroups.get(key).include.push(projectIncludeGlob);
  }

  let index = 0;
  for (const { options, include } of registrationGroups.values()) {
    index++;
    spinner.updateText(
      `${index}/${registrationGroups.size} - Applying plugin configuration...`
    );
    const existingPlugin = nxJson.plugins?.find(
      (plugin): plugin is ExpandedPluginConfiguration =>
        typeof plugin !== 'string' &&
        plugin.plugin === pluginPath &&
        Object.keys(options).every(
          (key) =>
            plugin.options[key] === options[key] ||
            (plugin.options[key] === undefined &&
              options[key] === defaultPluginOptions[key])
        )
    );

    if (!existingPlugin) {
      nxJson.plugins ??= [];
      const plugin: ExpandedPluginConfiguration = {
        plugin: pluginPath,
        options,
        include: [...include],
      };

      if (
        includeCoversAllConfigFiles(
          plugin.include,
          plugin.exclude,
          matchedConfigFiles
        )
      ) {
        delete plugin.include;
      }

      nxJson.plugins.push(plugin);
    } else if (existingPlugin.include) {
      for (const projectIncludeGlob of include) {
        if (
          !existingPlugin.include.some((include) =>
            minimatch(projectIncludeGlob, include, { dot: true })
          )
        ) {
          existingPlugin.include.push(projectIncludeGlob);
        }
      }

      if (
        includeCoversAllConfigFiles(
          existingPlugin.include,
          existingPlugin.exclude,
          matchedConfigFiles
        )
      ) {
        delete existingPlugin.include;
      }
    }
  }
  spinner.updateText(`Migrations done`);

  updateNxJson(tree, nxJson);
}

async function getCreateNodesResultsForPlugin(
  tree: Tree,
  pluginConfiguration: ExpandedPluginConfiguration,
  pluginPath: string,
  createNodes: CreateNodes | undefined,
  createNodesV2: CreateNodes | undefined,
  nxJson: NxJsonConfiguration
): Promise<ConfigurationResult> {
  let projectConfigs: ConfigurationResult;

  try {
    const plugin = new LoadedNxPlugin(
      { createNodes, createNodesV2, name: pluginPath },
      pluginConfiguration
    );
    projectConfigs = await retrieveProjectConfigurations(
      { specifiedPlugins: [plugin], defaultPlugins: [] },
      tree.root,
      nxJson
    );
  } catch (e) {
    if (e instanceof ProjectConfigurationsError) {
      projectConfigs = e.partialProjectConfigurationsResult;
    } else {
      throw e;
    }
  }

  return projectConfigs;
}
