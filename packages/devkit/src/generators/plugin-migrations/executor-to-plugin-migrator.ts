import { minimatch } from 'minimatch';
import { deepStrictEqual } from 'node:assert';
import { join } from 'node:path/posix';
import type {
  InputDefinition,
  ProjectConfiguration,
} from 'nx/src/config/workspace-json-project-json';
import {
  readJson,
  readNxJson,
  readProjectConfiguration,
  getProjects,
  updateNxJson,
  updateProjectConfiguration,
  writeJson,
  type CreateNodes,
  type ExpandedPluginConfiguration,
  type NxJsonConfiguration,
  type ProjectGraph,
  type TargetConfiguration,
  type TargetDefaultArrayEntry,
  type Tree,
  logger as devkitLogger,
} from 'nx/src/devkit-exports';
import {
  LoadedNxPlugin,
  ProjectConfigurationsError,
  findMatchingConfigFiles,
  isAggregateCreateNodesError,
  isMergeNodesError,
  isProjectsWithNoNameError,
  isMultipleProjectsWithSameNameError,
  isWorkspaceValidityError,
  findProjectForPath,
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
  /**
   * The object handed to the plugin's `createNodes` — the raw
   * `targetPluginOptionMapper` output. The engine never merges its own
   * `defaultPluginOptions` into it (that is why `derivePluginFilledDefaults`
   * skips keys already in the defaults). NOTE: the plugin itself may mutate this
   * object in place during Phase 1 (e.g. `options.devTargetName ??= 'dev'`);
   * `derivePluginFilledDefaults` relies on exactly that mutation, so after
   * Phase 1 this can carry the plugin's own fills too.
   */
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
 * The result of Phase 0 (Collect). Built by folding `forEachExecutorOptions`
 * over every migration/executor into one scope object, replacing the
 * per-executor scope derivation the migrator used to do internally.
 */
export interface MigrationScope<T> {
  /** project -> resolved plugin registration options (defaults + mappers) */
  pluginOptionsByProject: Map<string, T>;
  /** distinct inference option sets paired with the target names they infer */
  optionSetGroups: InferenceOptionSet<T>[];
  /** per (migration, executor) slice used to drive residual computation */
  executorScopes: ExecutorScope<T>[];
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
  const pluginOptionsByProject = new Map<string, T>();
  const executorScopes: ExecutorScope<T>[] = [];
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

        // Invert to per-project registration options, reusing the single mapper
        // call above (target-grouped insertion order). One call keeps the
        // option-set id and the registration options consistent even if a
        // mapper were impure.
        for (const project of projs) {
          pluginOptionsByProject.set(project, {
            ...(pluginOptionsByProject.get(project) ?? ({} as T)),
            ...inferenceOptions,
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

  return {
    pluginOptionsByProject,
    optionSetGroups: [...optionSetGroupsByKey.values()],
    executorScopes,
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
  const inferredByRoot = inferredTargetsByOptionSet.get(optionSetId);
  const inferredTargetsByName = inferredByRoot?.get(projectRoot);
  if (!inferredTargetsByName) {
    throw new Error(
      `The nx plugin did not find a project inside ${projectRoot}. File an issue at https://github.com/nrwl/nx with information about your project structure.`
    );
  }
  const inferredTarget = inferredTargetsByName.get(targetName);
  if (!inferredTarget) {
    // The plugin found the project but did not infer a "${targetName}" target
    // for it under this option set — the migration and inference disagree on
    // the target name.
    throw new Error(
      `The nx plugin found a project inside ${projectRoot} but did not infer a "${targetName}" target for it. File an issue at https://github.com/nrwl/nx with information about your project structure.`
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
  residualByProject: ResidualByProject,
  logger?: typeof devkitLogger
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
          structuredClone(entry.residual),
          logger
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
  residual: TargetConfiguration,
  logger?: typeof devkitLogger
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

  // `updateProjectConfiguration` writes a package-based project (no
  // project.json) by spreading the config over package.json `nx`, and deletes an
  // empty `targets` from this very (cached) object before the spread. Two
  // consequences: the old `nx.targets` entry (executor included) survives in
  // package.json, and the cache can no longer take a later write (the Phase 4
  // revert). Delete the entry here and keep the cache writable.
  if (!projectConfig.targets) {
    projectConfig.targets = {};
    // With the entry gone, an included package.json script with the same name
    // would author the target in the default plugin layer, replacing the
    // inferred target with `nx:run-script`. Keep the entry (the pre-migration
    // executor) in that case so the target's behavior does not change.
    if (
      packageJsonAuthorsTargetIdentity(tree, projectConfig.root, targetName)
    ) {
      (logger ?? devkitLogger).warn(
        `convert-to-inferred kept the package.json nx.targets entry for target "${targetName}" in project "${projectName}": an included package.json script with the same name would otherwise replace the inferred target with nx:run-script. The target keeps the same behavior as before the migration; rename or exclude the script, then remove the nx.targets entry to let the inferred target take over.`
      );
    } else {
      deletePackageJsonTarget(tree, projectConfig.root, targetName);
    }
  }
}

function deletePackageJsonTarget(
  tree: Tree,
  root: string,
  targetName: string
): void {
  const packageJsonPath = join(root, 'package.json');
  const packageJson = readJson(tree, packageJsonPath);
  if (!packageJson.nx?.targets?.[targetName]) {
    return;
  }
  delete packageJson.nx.targets[targetName];
  if (Object.keys(packageJson.nx.targets).length === 0) {
    delete packageJson.nx.targets;
  }
  writeJson(tree, packageJsonPath, packageJson);
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
 * Whether a project's `package.json` authors an identity for `targetName` in the
 * DEFAULT plugin layer. The package-json plugin turns every included script into
 * an `nx:run-script` target and honors `nx.targets`; either way the target gains
 * an `executor`/`command` in a default layer, which makes Nx's
 * `resolveSourcePlugin` refuse a `filter: { plugin }` targetDefault for it.
 * The hoist uses this to keep the full residual per project instead of silently
 * dropping the centralized keys; the empty-residual write uses it to keep the
 * `nx.targets` entry instead of letting a same-name script take the target over.
 *
 * Read through the Tree so this sees the same in-memory package.json the rest of
 * the generator reads and writes, rather than a possibly-stale copy on disk.
 */
function packageJsonAuthorsTargetIdentity(
  tree: Tree,
  root: string | undefined,
  targetName: string
): boolean {
  if (!root) {
    return false;
  }
  const packageJsonPath = join(root, 'package.json');
  if (!tree.exists(packageJsonPath)) {
    return false;
  }
  let packageJson: {
    scripts?: Record<string, unknown>;
    nx?: {
      includedScripts?: string[];
      targets?: Record<string, { executor?: unknown; command?: unknown }>;
    };
  };
  try {
    packageJson = readJson(tree, packageJsonPath);
  } catch {
    // Nx reads this file with the same jsonc-tolerant parser (`//` comments,
    // trailing commas), so a failure here means inference cannot be trusted for
    // it either. Fail closed: treat the identity as authored rather than hoist
    // on a guess.
    return true;
  }
  const scripts = packageJson?.scripts ?? {};
  // `readTargetsFromPackageJson` turns each *included* script into an
  // `nx:run-script` target (identity). `nx.includedScripts`, when present,
  // restricts which scripts become targets. Normalize a malformed (non-array)
  // value to the default (all scripts) instead of letting `.includes` throw an
  // uncaught TypeError mid-generator.
  const nxIncludedScripts = packageJson?.nx?.includedScripts;
  const includedScripts = Array.isArray(nxIncludedScripts)
    ? nxIncludedScripts
    : Object.keys(scripts);
  if (includedScripts.includes(targetName)) {
    return true;
  }
  // The `nx.targets` check below reads PRE-migration state. In a package-based
  // workspace the target being migrated lives in `nx.targets` itself (that is
  // where its executor is authored), so reading it here would flag every project
  // as authoring its own identity, exclude them all, and centralize nothing.
  // A package-based project's residual is written back to `nx.targets` without
  // the migrated executor (a residual that still carries an executor/command is
  // excluded by the caller before this gate), so post-migration it authors no
  // identity and the hoisted `filter:{plugin}` default resolves. Gate on the
  // same `project.json` signal `updateProjectConfiguration` uses to decide where
  // config lives: only trust an `nx.targets` identity when the project keeps its
  // config in `project.json` (there a package.json `nx.targets` entry is
  // genuinely separate from the migrated target).
  if (!tree.exists(join(root, 'project.json'))) {
    return false;
  }
  // An `nx.targets` entry authors identity only when it says how to run.
  const nxTarget = packageJson?.nx?.targets?.[targetName];
  return (
    nxTarget != null &&
    (nxTarget.executor !== undefined || nxTarget.command !== undefined)
  );
}

function isRegistrationOfPlugin(
  registration: string | ExpandedPluginConfiguration,
  pluginPath: string
): boolean {
  return typeof registration === 'string'
    ? registration === pluginPath
    : registration.plugin === pluginPath;
}

/**
 * Whether every nx.json `plugins` entry after the migrated plugin's first
 * registration is also the migrated plugin. Only then is the migrated plugin
 * guaranteed to merge last for the targets it infers, keeping the
 * executor/command attribution (and with it `filter: { plugin }`
 * target-default resolution) with this plugin. No registration at all fails
 * closed.
 */
function pluginRegistrationsFormTail(
  nxJson: NxJsonConfiguration,
  pluginPath: string
): boolean {
  const plugins = nxJson.plugins ?? [];
  const isMigratedPlugin = (plugin: string | ExpandedPluginConfiguration) =>
    isRegistrationOfPlugin(plugin, pluginPath);
  const firstIndex = plugins.findIndex(isMigratedPlugin);
  if (firstIndex === -1) {
    return false;
  }
  return plugins.slice(firstIndex + 1).every(isMigratedPlugin);
}

/**
 * Phase 3 (centralized variant) — hoist the strict-common residual per target
 * into `nx.json` `targetDefaults[targetName]` as a plugin-scoped array entry,
 * remove the dead executor-keyed entries, and write only per-project
 * deviations to project.json. Used for whole-workspace migrations;
 * single-project mode keeps the full residual. Hoisting also requires the
 * plugin's registrations to form the tail of nx.json `plugins` (see
 * `pluginRegistrationsFormTail`); otherwise every project keeps its full
 * residual.
 *
 * Returns the appended entry per target so the verification pass can revert a
 * hoist that turns out to reach a target the migration did not migrate.
 */
function hoistCommonAndWrite<T>(
  tree: Tree,
  projectConfigsByName: Map<string, ProjectConfiguration>,
  scope: MigrationScope<T>,
  residualByProject: ResidualByProject,
  pluginPath: string,
  projectGraph: ProjectGraph,
  inferredExecutors: Set<string>,
  pluginPreRegistered: boolean,
  logger?: typeof devkitLogger
): Map<string, TargetDefaultArrayEntry> {
  // Group residuals by target name across all migrated projects, tracking which
  // projects contribute each target so we can inspect their default-layer config.
  const residualsByTarget = new Map<string, TargetConfiguration[]>();
  const projectsByTarget = new Map<string, string[]>();
  for (const [projectName, targetMap] of residualByProject) {
    for (const [targetName, entry] of targetMap) {
      if (!residualsByTarget.has(targetName)) {
        residualsByTarget.set(targetName, []);
        projectsByTarget.set(targetName, []);
      }
      residualsByTarget.get(targetName).push(entry.residual);
      projectsByTarget.get(targetName).push(projectName);
    }
  }

  const commonByTarget = new Map<string, TargetConfiguration>();
  // Projects whose target identity is authored in a DEFAULT layer, per target.
  // Nx's `resolveSourcePlugin` refuses a `filter: { plugin }` default for such a
  // target (see nx/.../project-configuration/target-defaults.ts), so those
  // projects can't inherit the hoisted keys and must carry the full config
  // themselves. The partition is PER-PROJECT: one project with authored identity
  // no longer blocks centralization for its siblings.
  const excludedProjectsByTarget = new Map<string, Set<string>>();
  // package.json can reintroduce a migrated executor at resolution after the
  // explicit target is rewritten, invisible to the liveness scan below (the
  // package config is ignored when a sibling project.json exists).
  let packageJsonAuthoredIdentity = false;
  // Deterministic target-name order for stable nx.json output.
  for (const targetName of [...residualsByTarget.keys()].sort()) {
    const residuals = residualsByTarget.get(targetName);
    const projects = projectsByTarget.get(targetName) ?? [];
    // Partition the target's projects. A target's identity is authored in a
    // default layer when either:
    //   - the project.json residual carries `executor`/`command` (e.g. @nx/detox
    //     stamps a per-project `command`), or
    //   - the package-json plugin authors it: a package.json script byte-equal
    //     to the target name becomes an `nx:run-script` target (and `nx.targets`
    //     is honored).
    // Such projects are EXCLUDED from the hoist (they keep the full residual);
    // the rest are hoist-eligible.
    const excludedProjects = new Set<string>();
    const eligibleResiduals: TargetConfiguration[] = [];
    for (let i = 0; i < projects.length; i++) {
      const projectName = projects[i];
      const residual = residuals[i];
      const packageJsonAuthored = packageJsonAuthorsTargetIdentity(
        tree,
        projectConfigsByName.get(projectName)?.root,
        targetName
      );
      if (packageJsonAuthored) {
        packageJsonAuthoredIdentity = true;
      }
      const identityAuthored =
        residual.executor !== undefined ||
        residual.command !== undefined ||
        packageJsonAuthored;
      if (identityAuthored) {
        excludedProjects.add(projectName);
      } else {
        eligibleResiduals.push(residual);
      }
    }
    excludedProjectsByTarget.set(targetName, excludedProjects);
    // Centralization only pays off when at least two ELIGIBLE projects share the
    // target; the common is computed over eligible residuals only, so an excluded
    // project's config never leaks into the shared default.
    const common =
      eligibleResiduals.length >= 2
        ? computeStrictCommon(eligibleResiduals)
        : {};
    commonByTarget.set(targetName, common);
  }

  // A specified plugin registered AFTER the migrated plugin merges later, so a
  // same-name target it authors takes the executor/command attribution;
  // `resolveSourcePlugin` then names that plugin and rejects this plugin's
  // `filter: { plugin }` default, silently dropping the hoisted keys. The
  // verification pass loads only the migrated plugin, so it cannot observe
  // this. Registrations are written before this runs, so the plugins array is
  // final: hoist only when the migrated plugin's registrations form its tail;
  // otherwise keep the full residuals (the previous engine's output).
  if (!pluginRegistrationsFormTail(readNxJson(tree), pluginPath)) {
    const skippedTargets = [...commonByTarget.entries()]
      .filter(([, common]) => Object.keys(common).length > 0)
      .map(([targetName]) => targetName)
      .sort();
    if (skippedTargets.length > 0) {
      for (const targetName of skippedTargets) {
        commonByTarget.set(targetName, {});
      }
      (logger ?? devkitLogger).warn(
        `convert-to-inferred kept per-project configuration for target(s) ${skippedTargets.join(
          ', '
        )} instead of centralizing it: other plugins are registered after this plugin in nx.json, and a plugin registered later can take over a target's identity, which would silently drop the centralized configuration. The migrated projects keep the same output as before the migration.`
      );
    }
  }

  // Write per-project deviations first so migrated targets drop their executor
  // before we decide whether an executor-keyed target default is still needed.
  for (const executorScope of scope.executorScopes) {
    for (const [targetName, projectNames] of executorScope.targetAndProjects) {
      const common = commonByTarget.get(targetName) ?? {};
      const excludedProjects =
        excludedProjectsByTarget.get(targetName) ?? new Set<string>();
      for (const projectName of projectNames) {
        const entry = residualByProject.get(projectName)?.get(targetName);
        if (!entry) {
          continue;
        }
        // Excluded projects keep the FULL residual — the plugin-scoped default
        // won't resolve for them, so nothing may be subtracted. Eligible projects
        // drop the hoisted common and keep only their deviation.
        const toWrite = excludedProjects.has(projectName)
          ? structuredClone(entry.residual)
          : subtractCommon(entry.residual, common);
        writeResidualTarget(
          tree,
          projectConfigsByName,
          projectName,
          targetName,
          toWrite,
          logger
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

  // A pre-existing registration of this plugin (or a plugin after it) can win
  // a migrated pair's identity after the explicit target is rewritten, and a
  // package-authored identity resurfaces the same way. A registration this
  // migration ADDS is appended last and wins identity itself, so only fresh
  // registrations remove dead executor entries; otherwise fail open.
  // `pluginPreRegistered` is captured by the caller BEFORE registrations are
  // written (they now precede this).
  if (!pluginPreRegistered && !packageJsonAuthoredIdentity) {
    // An executor-keyed targetDefault applies to any RESOLVED target carrying
    // the executor, so liveness needs every source of one: post-write explicit
    // targets, graph targets of untouched pairs (migrated pairs still show the
    // pre-write executor), and everything this plugin's own inference emits.
    const liveExecutors = new Set(inferredExecutors);
    for (const projectConfig of projectConfigsByName.values()) {
      for (const target of Object.values(projectConfig.targets ?? {})) {
        if (target.executor) {
          liveExecutors.add(target.executor);
        }
      }
    }
    for (const [projectName, node] of Object.entries(projectGraph.nodes)) {
      for (const [targetName, target] of Object.entries(
        node.data.targets ?? {}
      )) {
        if (
          target.executor &&
          !residualByProject.get(projectName)?.has(targetName)
        ) {
          liveExecutors.add(target.executor);
        }
      }
    }

    for (const executorScope of scope.executorScopes) {
      if (!liveExecutors.has(executorScope.executor)) {
        removeDeadExecutorTargetDefault(nxJson, executorScope.executor);
      }
    }
  }

  if (
    nxJson.targetDefaults &&
    Object.keys(nxJson.targetDefaults).length === 0
  ) {
    delete nxJson.targetDefaults;
  }

  updateNxJson(tree, nxJson);

  // A per-project exclusion is otherwise silent (unlike a Phase 4 revert, which
  // warns): the excluded projects simply keep their full residual and nothing is
  // centralized for them. Surface it so a partial or total non-centralization is
  // never indistinguishable from "centralization did not apply".
  const excludedTargets = [...excludedProjectsByTarget.entries()].filter(
    ([, projects]) => projects.size > 0
  );
  if (excludedTargets.length > 0) {
    const excludedProjectNames = [
      ...new Set(excludedTargets.flatMap(([, projects]) => [...projects])),
    ].sort();
    const targetNames = excludedTargets
      .map(([targetName]) => targetName)
      .sort()
      .join(', ');
    (logger ?? devkitLogger).warn(
      `convert-to-inferred kept per-project configuration for ${
        excludedProjectNames.length
      } project(s) (${excludedProjectNames.join(
        ', '
      )}) on target(s) ${targetNames} instead of centralizing it: their target identity is authored outside the plugin (a project.json executor/command, or a package.json script/nx.targets entry), so a plugin-scoped default would not resolve for them. Those projects keep the same output as before the migration; review them if you expected shared configuration.`
    );
  }

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
 * computation strips `command` / `options.cwd` at the point of use), which
 * Phase 2 (`computeResidualByProject`) reads to compute residuals and
 * `baselineFinal`; plus the matched config files owned by an inferred project
 * root, which Phase 3's registration step reads for analytic include coverage.
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
  erroredConfigFiles: string[];
  rawMatchedConfigFiles: string[];
  inferredExecutors: Set<string>;
  inferredRoots: Set<string>;
}> {
  const inferredTargetsByOptionSet: InferredTargetsByOptionSet = new Map();
  const rawMatchedFiles = new Set<string>();
  const inferredRoots = new Set<string>();
  const erroredConfigFiles = new Set<string>();
  const inferredExecutors = new Set<string>();

  if (scope.optionSetGroups.length === 0) {
    return {
      inferredTargetsByOptionSet,
      rawMatchedConfigFiles: [],
      matchedConfigFiles: [],
      erroredConfigFiles: [],
      inferredExecutors,
      inferredRoots,
    };
  }

  global.NX_GRAPH_CREATION = true;
  try {
    for (const group of scope.optionSetGroups) {
      const inferredByRoot: InferredTargetsByRoot = new Map();
      inferredTargetsByOptionSet.set(group.id, inferredByRoot);
      const { result, erroredConfigFiles: groupErroredConfigFiles } =
        await getCreateNodesResultsForPlugin(
          tree,
          { plugin: pluginPath, options: group.options },
          pluginPath,
          createNodes,
          createNodesV2,
          nxJson
        );
      for (const file of groupErroredConfigFiles) {
        erroredConfigFiles.add(file);
      }

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

        // Executor-keyed targetDefaults can apply to ANY inferred target name,
        // so the Phase 3 dead-entry removal must see every emitted executor.
        for (const target of Object.values(projectConfig.targets ?? {})) {
          if (target.executor) {
            inferredExecutors.add(target.executor);
          }
        }

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
  // Ownership is an O(path depth) ancestor walk against the root Set, not an
  // O(roots) scan per file — both sets scale with project count.
  const matchedConfigFiles = [...rawMatchedFiles].filter((file) =>
    isFileOwnedByAnyRoot(file, inferredRoots)
  );

  return {
    inferredTargetsByOptionSet,
    // Every config file the plugin's glob matched, independent of whether this
    // pass inferred a project from it. The registration step needs the full set
    // to decide include coverage against non-migrated PROJECT roots: a project
    // the plugin infers only on a later pass (e.g. cache/error asymmetry) is
    // absent from `matchedConfigFiles` but its config is still globbed here.
    rawMatchedConfigFiles: [...rawMatchedFiles],
    matchedConfigFiles,
    // Config files the plugin's glob matched but could not infer this pass.
    // These produced no project (so they're absent from `matchedConfigFiles`),
    // yet the registration step must still keep its `include` scoped when one
    // sits outside the migrated roots — otherwise the plugin is widened to that
    // root, re-hits the same failure at verification, and reverts the hoist.
    erroredConfigFiles: [...erroredConfigFiles],
    inferredExecutors,
    inferredRoots,
  };
}

/**
 * Whether `file` (workspace-relative) is owned by any root in `roots`. Walks the
 * file's ancestor directories and checks Set membership — O(path depth), not
 * O(roots). Equivalent to `roots.some((root) => isFileUnderRoot(file, root))`:
 * the root project (`.`) owns workspace-root-level files (no path separator),
 * and a nested root owns the file when it is (or is an ancestor directory of)
 * the file.
 */
function isFileOwnedByAnyRoot(file: string, roots: Set<string>): boolean {
  if (roots.has(file)) {
    return true;
  }
  const firstSlash = file.indexOf('/');
  if (firstSlash === -1) {
    // A workspace-root-level file is owned only by the root project.
    return roots.has('.');
  }
  let dir = file;
  let slash = dir.lastIndexOf('/');
  while (slash !== -1) {
    dir = dir.slice(0, slash);
    if (roots.has(dir)) {
      return true;
    }
    slash = dir.lastIndexOf('/');
  }
  return false;
}

// Minimatch metacharacters plus extglob prefix operators (`!+@()`). A path
// segment containing any of these has glob semantics and cannot be reduced to a
// literal project root.
// Not reused from `isGlobPattern` (nx/src/utils/globs.ts): its `GLOB_CHARACTERS`
// set omits `?`, `!`, `+`, and `@`, so it would treat an extglob/negation as a
// literal root and wrongly widen the include.
const GLOB_METACHARACTERS = /[*?[\]{}!+@()]/;

/**
 * The set of project roots a generated `include` list scopes to, or `undefined`
 * if any entry is not one of the two shapes this generator emits: `*` (the root
 * project) or a literal root followed by a trailing globstar segment (a nested
 * root). A user-authored include or any `exclude` falls back to the glob engine.
 *
 * The globstar branch only qualifies when the root prefix is a LITERAL path.
 * A prefix carrying glob metacharacters (a wildcard, brace, or extglob segment
 * before the trailing globstar) is not a shape this generator emits and can't be
 * reduced to root ownership by string equality, so it falls back to the glob
 * engine.
 */
export function generatedIncludeRoots(
  include: string[]
): Set<string> | undefined {
  const roots = new Set<string>();
  for (const glob of include) {
    if (glob === '*') {
      roots.add('.');
    } else if (glob.endsWith('/**/*') && glob.length > '/**/*'.length) {
      const root = glob.slice(0, -'/**/*'.length);
      if (GLOB_METACHARACTERS.test(root)) {
        return undefined;
      }
      roots.add(root);
    } else {
      return undefined;
    }
  }
  return roots;
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
 *
 * Every glob this generator emits scopes to a single root (`*` for the root
 * project, a nested-root globstar for the rest), so coverage reduces to root
 * ownership with no glob engine — an O(files * path depth) walk instead of
 * running minimatch (whose `#matchGlobstar`/`slashSplit` dominate at scale) per
 * (file, glob). Only user-authored includes or any `exclude` fall through.
 */
function includeCoversAllConfigFiles(
  include: string[] | undefined,
  exclude: string[] | undefined,
  configFiles: string[]
): boolean {
  if (!include || include.length === 0) {
    return true;
  }
  if (!exclude || exclude.length === 0) {
    const includeRoots = generatedIncludeRoots(include);
    if (includeRoots) {
      return configFiles.every((file) =>
        isFileOwnedByAnyRoot(file, includeRoots)
      );
    }
  }
  // Fallback for user-authored includes / any exclude: defer to the SAME matcher
  // Nx uses to bind config files to a registration. A hand-rolled
  // `include.some() && !exclude.some()` cannot express an ordered-override
  // negation like `["packages/**/*", "!packages/legacy/**/*"]`: `.some()` reports
  // every file "covered" and deletes the include, which widens the registration
  // so the fenced-off configs get inferred (and executed). `findMatchingConfigFiles`
  // applies include/exclude with Nx's exact ordered semantics, so coverage holds
  // only when every config file survives the same filter Nx would run.
  return (
    findMatchingConfigFiles(configFiles, include, exclude ?? []).length ===
    configFiles.length
  );
}

/**
 * Harvest the diagnostic messages and the errored config-file paths from a
 * `ProjectConfigurationsError`. `ProjectConfigurationsError.errors` is a closed
 * 5-member union; the two members that name a failing config file are
 * `AggregateCreateNodesError` (a `[file, error]` list) and `MergeNodesError` (a
 * single `.file`). `ProjectsWithNoNameError` / `MultipleProjectsWithSameNameError`
 * are artifacts of running with no `project.json` layer (nothing supplies names),
 * so they are dropped; `WorkspaceValidityError` carries no file and is exempt.
 */
function harvestConfigurationErrors(e: ProjectConfigurationsError): {
  messages: string[];
  erroredConfigFiles: string[];
} {
  const messages: string[] = [];
  const erroredConfigFiles = new Set<string>();
  for (const error of e.errors) {
    if (
      isProjectsWithNoNameError(error) ||
      isMultipleProjectsWithSameNameError(error)
    ) {
      continue;
    }
    messages.push(error.message ?? String(error));
    if (isAggregateCreateNodesError(error)) {
      for (const [file] of error.errors) {
        if (file) {
          erroredConfigFiles.add(file);
        }
      }
    } else if (isMergeNodesError(error)) {
      if (error.file) {
        erroredConfigFiles.add(error.file);
      }
    } else if (isWorkspaceValidityError(error)) {
      // Carries no config file; its message (pushed above) is enough.
    } else {
      // Exhaustiveness guard: `ProjectConfigurationsError.errors` is a closed
      // union. If a sixth member is added, this assignment stops compiling until
      // it is handled here.
      const _exhaustive: never = error;
      void _exhaustive;
    }
  }
  return { messages, erroredConfigFiles: [...erroredConfigFiles] };
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
): Promise<{
  result: ConfigurationResult | undefined;
  errors: string[];
  /**
   * Config files the plugin failed on during verification, harvested by
   * `harvestConfigurationErrors`: both `AggregateCreateNodesError` entries (a
   * `[file, error]` list) and a `MergeNodesError`'s `file`. These are the roots
   * the pass could NOT inspect; the guard fails closed against any that sit
   * outside the migrated set.
   */
  erroredConfigFiles: string[];
}> {
  const nxJson = readNxJson(tree);
  const registrations = (nxJson.plugins ?? []).filter(
    (plugin): plugin is string | ExpandedPluginConfiguration =>
      plugin === pluginPath ||
      (typeof plugin !== 'string' && plugin.plugin === pluginPath)
  );
  if (registrations.length === 0) {
    return { result: undefined, errors: [], erroredConfigFiles: [] };
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
      erroredConfigFiles: [],
    };
  } catch (e) {
    if (e instanceof ProjectConfigurationsError) {
      // Verify against the partial result, but keep the causes — they are the
      // only diagnostic for why affected projects fall back or a hoist reverts.
      // Recording the errored config files is what makes the revert fail-closed:
      // a hoist is reverted when an errored file lies outside every migrated root.
      const { messages, erroredConfigFiles } = harvestConfigurationErrors(e);
      return {
        result: e.partialProjectConfigurationsResult,
        errors: messages,
        erroredConfigFiles,
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
 * effective config for a target is approximated by `merge(project.json
 * deviation, verified inferred+targetDefaults)`. It must deep-equal
 * `baselineFinal` (the previous engine's migrated effective config, from Phase
 * 2). CAVEAT: this pass runs with no DEFAULT layer (neither `project.json` nor
 * `package.json`), so it cannot observe cases where a default layer authors a
 * target's identity and thereby changes whether a `targetDefaults` entry applies
 * at all — e.g. a `filter: { plugin }` entry is rejected by
 * `resolveSourcePlugin` once the target carries `executor` / `command` in a
 * default layer. That identity can come from the project.json residual itself OR
 * from the package-json plugin (a script or `nx.targets` entry byte-equal to the
 * target name). Those targets are kept per-project at the hoist site (they never
 * reach a plugin-scoped entry), not caught here. Any project that fails —
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
  inferredRoots: Set<string>,
  singleProjectMode: boolean,
  logger: typeof devkitLogger | undefined
): Promise<void> {
  // Single-project mode never hoists, so there is nothing to reconcile — and
  // no reason to pay for a whole-workspace verification inference.
  if (singleProjectMode) {
    return;
  }

  const {
    result: verifyResult,
    errors: verificationErrors,
    erroredConfigFiles,
  } = await runVerificationPass(tree, pluginPath, createNodes, createNodesV2);
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

  // Attribution map for errored-config ownership: every root the engine knows
  // owns a project, graph projects plus the roots the plugin itself inferred
  // in Phase 1 (a project discovered from a config file alone has no graph
  // node). Keys are normalized for the `findProjectForPath` walk; values are
  // the raw roots the per-target migrated-root sets hold.
  const normalizeRoot = (root: string) =>
    root === '' ? '.' : root.endsWith('/') ? root.slice(0, -1) : root;
  const ownerRootByPath = new Map<string, string>();
  for (const node of Object.values(projectGraph.nodes)) {
    ownerRootByPath.set(normalizeRoot(node.data.root), node.data.root);
  }
  for (const root of inferredRoots) {
    if (!ownerRootByPath.has(normalizeRoot(root))) {
      ownerRootByPath.set(normalizeRoot(root), root);
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
    // Fail closed on inference errors. `reachesNonMigratedRoot` is keyed on the
    // partial result, so an errored root never appears there, yet it may be an
    // inferred-only root that would inherit the plugin-scoped default once its
    // config is fixed. Attribute each errored file to the CLOSEST known
    // project root (not any migrated ancestor: a nested non-migrated project
    // must not be absorbed by the migrated project above it) and revert unless
    // that root is one of this target's migrated roots (errors on migrated
    // roots are handled by the per-project divergence oracle below).
    const erroredOutsideMigratedRoots = erroredConfigFiles.some((file) => {
      const ownerRoot = findProjectForPath(file, ownerRootByPath);
      return ownerRoot == null || !migratedRoots.has(ownerRoot);
    });
    if (reachesNonMigratedRoot || erroredOutsideMigratedRoots) {
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
          structuredClone(entry.residual),
          logger
        );
      }
    }
    // A revert can be triggered by an inference error the pass could not
    // inspect; surface those errors so the incomplete verification is not silent.
    const causes =
      verificationErrors.length > 0
        ? ` The verification pass reported errors: ${verificationErrors.join(
            '; '
          )}`
        : '';
    (logger ?? devkitLogger).warn(
      `convert-to-inferred kept per-project configuration for target(s) ${[
        ...revertedTargets,
      ]
        .sort()
        .join(
          ', '
        )} instead of centralizing it: other projects inferred by this plugin would have inherited the centralized configuration (or the verification pass could not confirm they would not). The migrated projects keep the same output as before centralization.${causes}`
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
          structuredClone(entry.residual),
          logger
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

  // Whenever the verification pass reported errors they must appear in at least
  // one warning. The revert warning always carries them; the fallback warning
  // carries them only for a target missing from the verification result (a
  // divergence fallback has a verified config, so attaching unrelated errors to
  // it would misattribute the cause). Fire this standalone warning whenever the
  // errors were surfaced by neither — i.e. nothing reverted AND no fallback
  // carried them (no fallback at all, or only divergence fallbacks). Otherwise a
  // broken config file leaves the pass unable to see the whole workspace with no
  // trace. (`verificationErrors` here has already had the no-project-name noise
  // filtered out, so it means inference genuinely broke.)
  const errorsSurfacedByFallbackWarning =
    fallbacks.length > 0 && anyMissingFromVerification;
  if (
    verificationErrors.length > 0 &&
    revertedTargets.size === 0 &&
    !errorsSurfacedByFallbackWarning
  ) {
    // Only claim the migrated targets matched when nothing fell back; a
    // divergence fallback means at least one did not.
    const outcome =
      fallbacks.length === 0
        ? ' The migrated targets matched their pre-migration output, but review any workspace configuration the errors reference.'
        : ' Review any workspace configuration the errors reference.';
    (logger ?? devkitLogger).warn(
      `convert-to-inferred could not fully verify the migration: the verification inference pass reported errors: ${verificationErrors.join(
        '; '
      )}.${outcome}`
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
  const {
    inferredTargetsByOptionSet,
    matchedConfigFiles,
    erroredConfigFiles: erroredConfigFilesFromInference,
    rawMatchedConfigFiles,
    inferredExecutors,
    inferredRoots,
  } = await inferOncePerOptionSet(
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

  // Phase 3 — one-shot plugin registration + analytic include computation.
  // Runs before the hoist: the hoist is gated on the FINAL position of this
  // plugin's registrations in the plugins array (a later registration of
  // another plugin can take a target's identity over), so the array must be in
  // its final state first. The pre-registration state is captured here for the
  // hoist's dead-entry removal gate, which needs to know whether this
  // migration added the registration.
  const pluginPreRegistered = (readNxJson(tree).plugins ?? []).some((plugin) =>
    isRegistrationOfPlugin(plugin, pluginPath)
  );
  addPluginRegistrations(
    tree,
    projects,
    pluginPath,
    defaultPluginOptions,
    projectGraph,
    spinner,
    matchedConfigFiles,
    erroredConfigFilesFromInference,
    rawMatchedConfigFiles
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
      residualByProject,
      logger
    );
  } else {
    hoistedByTarget = hoistCommonAndWrite(
      tree,
      projectConfigsByName,
      scope,
      residualByProject,
      pluginPath,
      projectGraph,
      inferredExecutors,
      pluginPreRegistered,
      logger
    );
  }

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
    inferredRoots,
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
  matchedConfigFiles: string[],
  // Config files the Phase 1 inference could not load. These produce no project
  // (so they're absent from `matchedConfigFiles`), but an errored file OUTSIDE
  // the migrated roots must still keep the `include` scoped: leaving the plugin
  // unscoped would widen it onto that root, where the verification pass re-hits
  // the failure and reverts the whole hoist. A harmless project-free config (a
  // shared/base config that loads fine) is NOT errored, so it does not keep the
  // include — the plugin may safely apply workspace-wide over it.
  erroredConfigFiles: string[],
  // The FULL set of config files the plugin's glob matched, regardless of what
  // this migration's inference pass produced a project from. Used to detect
  // config files owned by NON-MIGRATED projects that the plugin would infer once
  // the registration is workspace-wide — see below.
  rawMatchedConfigFiles: string[]
) {
  const nxJson = readNxJson(tree);

  // Config files owned by a NON-MIGRATED project keep the `include` scoped.
  // `matchedConfigFiles` only lists roots THIS pass inferred; a non-migrated
  // project the plugin infers only later (cache/error asymmetry) is absent from
  // it, so an unscoped registration would let the verification pass infer that
  // root and `reachesNonMigratedRoot` would revert the whole hoist. Judging
  // coverage against project-graph membership — not this pass's inference —
  // closes that hole. (A config owned by NO project, e.g. a shared/base config,
  // is not counted, so it does not force a scoped include.)
  const migratedRoots = new Set<string>();
  for (const project of projects.keys()) {
    const root = projectGraph.nodes[project]?.data?.root;
    if (root) {
      migratedRoots.add(root);
    }
  }
  const nonMigratedProjectRoots = new Set<string>();
  for (const node of Object.values(projectGraph.nodes)) {
    const root = node?.data?.root;
    if (root && !migratedRoots.has(root)) {
      nonMigratedProjectRoots.add(root);
    }
  }
  const nonMigratedProjectConfigFiles = rawMatchedConfigFiles.filter((file) =>
    isFileOwnedByAnyRoot(file, nonMigratedProjectRoots)
  );

  // Fold errored files (broken configs the plugin would fail to infer) and
  // non-migrated project configs (roots the plugin would infer workspace-wide)
  // into the coverage set: an unscoped `include` is chosen only when neither lies
  // outside the migrated roots.
  const coverageConfigFiles = [
    ...matchedConfigFiles,
    ...erroredConfigFiles,
    ...nonMigratedProjectConfigFiles,
  ];

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
          coverageConfigFiles
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
          coverageConfigFiles
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
): Promise<{ result: ConfigurationResult; erroredConfigFiles: string[] }> {
  let projectConfigs: ConfigurationResult;
  let erroredConfigFiles: string[] = [];

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
      // Capture the config files this pass could not infer. The registration
      // step keeps its `include` scoped to migrated roots when an errored file
      // sits outside them, so the plugin is never widened to a root it would
      // fail to infer (which the verification pass would otherwise revert).
      erroredConfigFiles = harvestConfigurationErrors(e).erroredConfigFiles;
    } else {
      throw e;
    }
  }

  return { result: projectConfigs, erroredConfigFiles };
}
