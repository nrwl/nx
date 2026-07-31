import { minimatch } from 'minimatch';
import { deepStrictEqual } from 'node:assert';
import { join } from 'node:path/posix';
import type {
  InputDefinition,
  ProjectConfiguration,
} from 'nx/src/config/workspace-json-project-json';
import {
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  type CreateNodes,
  type ExpandedPluginConfiguration,
  type NxJsonConfiguration,
  type ProjectGraph,
  type TargetConfiguration,
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
import { findTargetDefault } from '../target-defaults-utils';
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
  options: T;
  targetNames: Set<string>;
}

interface ExecutorScope<T> {
  executor: string;
  migration: MigrationDefinition<T>;
  targetAndProjects: Map<string, Set<string>>;
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
  /** distinct inference option sets (deduped `targetPluginOptionMapper` output) */
  distinctOptionSets: T[];
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
  specificProjectToMigrate: string | undefined,
  logger: typeof devkitLogger | undefined
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

      executorScopes.push({ executor, migration, targetAndProjects });

      for (const [targetName, projs] of targetAndProjects) {
        if (!targetsToMigrate.has(targetName)) {
          targetsToMigrate.set(targetName, new Set());
        }
        const globalSet = targetsToMigrate.get(targetName);
        for (const project of projs) {
          globalSet.add(project);
        }

        const inferenceOptions = migration.targetPluginOptionMapper(
          targetName
        ) as T;
        const key = stableStringify(inferenceOptions);
        if (!optionSetGroupsByKey.has(key)) {
          optionSetGroupsByKey.set(key, {
            options: inferenceOptions,
            targetNames: new Set(),
          });
        }
        optionSetGroupsByKey.get(key).targetNames.add(targetName);

        // Invert to per-project registration options, mirroring the previous
        // `migrateProjects` inversion loop (target-grouped insertion order).
        for (const project of projs) {
          pluginOptionsByProject.set(project, {
            ...(pluginOptionsByProject.get(project) ?? ({} as T)),
            ...migration.targetPluginOptionMapper(targetName),
          } as T);
        }
      }
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
  inferredByRoot: Map<string, Map<string, TargetConfiguration>>,
  projectRoot: string,
  targetName: string
): TargetConfiguration {
  const inferredTarget = inferredByRoot.get(projectRoot)?.get(targetName);
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
  inferredByRoot: Map<string, Map<string, TargetConfiguration>>,
  nxJson: NxJsonConfiguration
): Promise<ResidualByProject> {
  const residualByProject: ResidualByProject = new Map();

  for (const executorScope of scope.executorScopes) {
    const targetDefaultsForExecutor = structuredClone(
      readTargetDefaultsForExecutor(executorScope.executor, nxJson.targetDefaults) ??
        {}
    );

    for (const [targetName, projectNames] of executorScope.targetAndProjects) {
      for (const projectName of projectNames) {
        const root = projectGraph.nodes[projectName].data.root;
        const fullInferredTarget = getFullInferredTarget(
          inferredByRoot,
          root,
          targetName
        );
        const strippedInferredTarget = stripInferredTarget(fullInferredTarget);

        const projectConfig = readProjectConfiguration(tree, projectName);
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
 * Phase 3 (residual-only variant used until centralization lands) — write the
 * full residual into each project.json, exactly reproducing the previous
 * per-(project, target) write sequence.
 */
function writeResiduals<T>(
  tree: Tree,
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
  projectName: string,
  targetName: string,
  residual: TargetConfiguration
) {
  const projectConfig = readProjectConfiguration(tree, projectName);

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
 * target and once per project. Builds `inferredByRoot` (project root -> target
 * name -> stripped inferred target) that every later phase reads from, plus the
 * set of config files the plugin globs (used for analytic include coverage).
 */
export async function inferOncePerOptionSet<T>(
  tree: Tree,
  pluginPath: string,
  createNodes: CreateNodes<T> | undefined,
  createNodesV2: CreateNodes<T> | undefined,
  nxJson: NxJsonConfiguration,
  scope: MigrationScope<T>
): Promise<{
  inferredByRoot: Map<string, Map<string, TargetConfiguration>>;
  matchedConfigFiles: string[];
}> {
  const inferredByRoot = new Map<string, Map<string, TargetConfiguration>>();
  const rawMatchedFiles = new Set<string>();
  const inferredRoots = new Set<string>();

  if (scope.optionSetGroups.length === 0) {
    return { inferredByRoot, matchedConfigFiles: [] };
  }

  global.NX_GRAPH_CREATION = true;
  try {
    for (const group of scope.optionSetGroups) {
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
          inferredByRoot.get(root).set(targetName, structuredClone(inferredTarget));
        }
      }
    }
  } finally {
    global.NX_GRAPH_CREATION = false;
  }

  // Keep only config files owned by an inferred project root (i.e. files that
  // actually contribute a project). Include-coverage is decided against these.
  const matchedConfigFiles = [...rawMatchedFiles].filter((file) =>
    [...inferredRoots].some((root) => isFileUnderRoot(file, root))
  );

  return { inferredByRoot, matchedConfigFiles };
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
 * plugin globs (so the registration can be left unscoped). Because plugin
 * inference is a pure function of the matched config-file set, this is exactly
 * the answer the old per-project `arePluginIncludesRequired` inference computed,
 * without running any additional inference.
 */
function includeCoversAllConfigFiles(
  include: string[] | undefined,
  exclude: string[] | undefined,
  configFiles: string[]
): boolean {
  if (!include || include.length === 0) {
    return true;
  }
  const excludeGlobs = exclude ?? [];
  return configFiles.every(
    (file) =>
      include.some((glob) => minimatch(file, glob, { dot: true })) &&
      !excludeGlobs.some((glob) => minimatch(file, glob, { dot: true }))
  );
}

/**
 * Phase 4 — a single verification inference pass over the whole workspace with
 * the updated `nx.json` plugin registrations. Runs every registration for this
 * plugin at once (one `retrieveProjectConfigurations` call). The equivalence
 * oracle + fallback that consume this result are added in a later task.
 */
async function runVerificationPass<T>(
  tree: Tree,
  pluginPath: string,
  createNodes: CreateNodes<T> | undefined,
  createNodesV2: CreateNodes<T> | undefined
): Promise<ConfigurationResult | undefined> {
  const nxJson = readNxJson(tree);
  const registrations = (nxJson.plugins ?? []).filter(
    (plugin): plugin is string | ExpandedPluginConfiguration =>
      plugin === pluginPath ||
      (typeof plugin !== 'string' && plugin.plugin === pluginPath)
  );
  if (registrations.length === 0) {
    return undefined;
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
    return await retrieveProjectConfigurations(
      { specifiedPlugins: plugins, defaultPlugins: [] },
      tree.root,
      nxJson
    );
  } catch (e) {
    if (e instanceof ProjectConfigurationsError) {
      return e.partialProjectConfigurationsResult;
    }
    throw e;
  } finally {
    global.NX_GRAPH_CREATION = false;
  }
}

/**
 * Recover the default option keys a plugin fills into its options object during
 * `createNodes` (Phase 1 mutated each option-set object in place if the plugin
 * does so). A key qualifies only if it is not one of our own
 * `defaultPluginOptions` and appears with an identical value across every
 * option set — that is exactly a plugin default fill, never a per-target
 * (mapper-provided) value. Reproduces the previous engine's incidental option
 * enrichment without extra inference.
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

  // Phase 1 — Infer (once per distinct option set) for the whole workspace.
  const nxJson = readNxJson(tree);
  const { inferredByRoot, matchedConfigFiles } = await inferOncePerOptionSet(
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
    inferredByRoot,
    nxJson
  );

  // Phase 3 — write the full residual per project.json (centralization lands in
  // a later task; output stays unchanged).
  writeResiduals(tree, projectGraph, scope, residualByProject);

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

  // Phase 4 — single verification inference pass over the whole workspace.
  await runVerificationPass(tree, pluginPath, createNodes, createNodesV2);

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
  // The config files the plugin globs across the whole workspace (from the
  // Phase 1 inference). Used to decide analytically whether a registration's
  // `include` globs already cover everything (so it can be left unscoped).
  matchedConfigFiles: string[]
) {
  const nxJson = readNxJson(tree);

  let index = 0;
  for (const [project, options] of projects.entries()) {
    index++;
    spinner.updateText(
      `${index}/${projects.size} - Applying "${project}" configuration...`
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

    const projectIncludeGlob =
      projectGraph.nodes[project].data.root === '.'
        ? '*'
        : join(projectGraph.nodes[project].data.root, '**/*');
    if (!existingPlugin) {
      nxJson.plugins ??= [];
      const plugin: ExpandedPluginConfiguration = {
        plugin: pluginPath,
        options,
        include: [projectIncludeGlob],
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
      if (
        !existingPlugin.include.some((include) =>
          minimatch(projectIncludeGlob, include, { dot: true })
        )
      ) {
        existingPlugin.include.push(projectIncludeGlob);

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
