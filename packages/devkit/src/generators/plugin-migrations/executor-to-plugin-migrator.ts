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
type PluginOptionsBuilder<T> = (targetName: string) => T;
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
        (options, projectName, targetName, configurationName) => {
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

class ExecutorToPluginMigrator<T> {
  readonly tree: Tree;
  readonly #projectGraph: ProjectGraph;
  readonly #executor: string;
  readonly #pluginPath: string;
  readonly #pluginOptionsBuilder: PluginOptionsBuilder<T>;
  readonly #postTargetTransformer: PostTargetTransformer;
  #nxJson: NxJsonConfiguration;
  #targetDefaultsForExecutor: Partial<TargetConfiguration>;
  #targetAndProjectsToMigrate: Map<string, Set<string>>;
  #createNodes?: CreateNodes<T>;
  #createNodesV2?: CreateNodes<T>;
  #createNodesResultsForTargets: Map<string, ConfigurationResult>;

  constructor(
    tree: Tree,
    projectGraph: ProjectGraph,
    executor: string,
    pluginPath: string,
    pluginOptionsBuilder: PluginOptionsBuilder<T>,
    postTargetTransformer: PostTargetTransformer,
    createNodes: CreateNodes<T> | undefined,
    createNodesV2: CreateNodes<T> | undefined,
    // The set of targets/projects to migrate for this executor, precomputed by
    // `collectMigrationScope` (Phase 0). Filtering/skip semantics already ran.
    targetAndProjectsToMigrate: Map<string, Set<string>>
  ) {
    this.tree = tree;
    this.#projectGraph = projectGraph;
    this.#executor = executor;
    this.#pluginPath = pluginPath;
    this.#pluginOptionsBuilder = pluginOptionsBuilder;
    this.#postTargetTransformer = postTargetTransformer;
    this.#createNodes = createNodes;
    this.#createNodesV2 = createNodesV2;
    this.#targetAndProjectsToMigrate = targetAndProjectsToMigrate;
  }

  async run(): Promise<Map<string, Set<string>>> {
    await this.#init();
    if (this.#targetAndProjectsToMigrate.size > 0) {
      for (const targetName of this.#targetAndProjectsToMigrate.keys()) {
        await this.#migrateTarget(targetName);
      }
    }
    return this.#targetAndProjectsToMigrate;
  }

  async #init() {
    const nxJson = readNxJson(this.tree);
    nxJson.plugins ??= [];
    this.#nxJson = nxJson;
    this.#createNodesResultsForTargets = new Map();

    this.#getTargetDefaultsForExecutor();
    await this.#getCreateNodesResults();
  }

  async #migrateTarget(targetName: string) {
    for (const projectName of this.#targetAndProjectsToMigrate.get(
      targetName
    )) {
      await this.#migrateProject(projectName, targetName);
    }
  }

  async #migrateProject(projectName: string, targetName: string) {
    const projectFromGraph = this.#projectGraph.nodes[projectName];
    const projectConfig = readProjectConfiguration(this.tree, projectName);

    const createdTarget = this.#getCreatedTargetForProjectRoot(
      targetName,
      projectFromGraph.data.root
    );
    let projectTarget = projectConfig.targets[targetName];
    projectTarget = mergeTargetConfigurations(
      projectTarget,
      this.#targetDefaultsForExecutor
    );
    delete projectTarget.executor;

    deleteMatchingProperties(projectTarget, createdTarget);

    if (projectTarget.inputs && createdTarget.inputs) {
      this.#mergeInputs(projectTarget, createdTarget);
    }

    projectTarget = await this.#postTargetTransformer(
      projectTarget,
      this.tree,
      { projectName, root: projectFromGraph.data.root },
      { ...createdTarget, name: targetName }
    );

    if (
      projectTarget.options &&
      Object.keys(projectTarget.options).length === 0
    ) {
      delete projectTarget.options;
    }

    if (Object.keys(projectTarget).length > 0) {
      projectConfig.targets[targetName] = projectTarget;
    } else {
      delete projectConfig.targets[targetName];
    }

    if (!projectConfig['// targets']) {
      projectConfig['// targets'] =
        `to see all targets run: nx show project ${projectName} --web`;
    }

    updateProjectConfiguration(this.tree, projectName, projectConfig);
  }

  #mergeInputs(
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

  #getTargetDefaultsForExecutor() {
    this.#targetDefaultsForExecutor = structuredClone(
      readTargetDefaultsForExecutor(
        this.#executor,
        this.#nxJson.targetDefaults
      ) ?? {}
    );
  }

  #getCreatedTargetForProjectRoot(targetName: string, projectRoot: string) {
    const entry = Object.entries(
      this.#createNodesResultsForTargets.get(targetName)?.projects ?? {}
    ).find(([root]) => root === projectRoot);
    if (!entry) {
      throw new Error(
        `The nx plugin did not find a project inside ${projectRoot}. File an issue at https://github.com/nrwl/nx with information about your project structure.`
      );
    }
    const createdProject = entry[1];
    const createdTarget: TargetConfiguration<RunCommandsOptions> =
      structuredClone(createdProject.targets[targetName]);
    delete createdTarget.command;
    delete createdTarget.options?.cwd;

    return createdTarget;
  }

  async #getCreateNodesResults() {
    if (this.#targetAndProjectsToMigrate.size === 0) {
      return;
    }

    global.NX_GRAPH_CREATION = true;
    try {
      for (const targetName of this.#targetAndProjectsToMigrate.keys()) {
        const result = await getCreateNodesResultsForPlugin(
          this.tree,
          {
            plugin: this.#pluginPath,
            options: this.#pluginOptionsBuilder(targetName),
          },
          this.#pluginPath,
          this.#createNodes,
          this.#createNodesV2,
          this.#nxJson
        );
        this.#createNodesResultsForTargets.set(targetName, result);
      }
    } finally {
      global.NX_GRAPH_CREATION = false;
    }
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

  // Per-executor residual writes (unchanged output). The scope has already
  // applied every skip filter, so the migrator no longer re-derives it.
  for (const executorScope of scope.executorScopes) {
    const migrator = new ExecutorToPluginMigrator(
      tree,
      projectGraph,
      executorScope.executor,
      pluginPath,
      executorScope.migration.targetPluginOptionMapper,
      executorScope.migration.postTargetTransformer,
      createNodes,
      createNodesV2,
      executorScope.targetAndProjects
    );
    await migrator.run();
  }

  for (const [project, options] of scope.pluginOptionsByProject) {
    projects.set(project, options as Record<string, string>);
  }

  await addPluginRegistrations(
    tree,
    projects,
    pluginPath,
    createNodes,
    createNodesV2,
    defaultPluginOptions,
    projectGraph,
    spinner
  );
  spinner.succeed(`Migrated configuration for ${projects.size} project(s).\n`);

  return projects;
}

async function addPluginRegistrations<T>(
  tree: Tree,
  projects: Map<string, Record<string, string>>,
  pluginPath: string,
  createNodes: CreateNodes | undefined,
  createNodesV2: CreateNodes | undefined,
  defaultPluginOptions: T,
  projectGraph: ProjectGraph,
  spinner: typeof globalSpinner
) {
  const nxJson = readNxJson(tree);

  // collect createNodes results for each project before adding the plugins
  const createNodesResults = new Map<string, ConfigurationResult>();
  global.NX_GRAPH_CREATION = true;
  try {
    let index = 0;
    for (const [project, options] of projects.entries()) {
      index++;
      spinner.updateText(
        `${index}/${projects.size} - Parsing "${project}" configuration...`
      );
      const projectConfigs = await getCreateNodesResultsForPlugin(
        tree,
        { plugin: pluginPath, options },
        pluginPath,
        createNodes,
        createNodesV2,
        nxJson
      );

      createNodesResults.set(project, projectConfigs);
    }
  } finally {
    global.NX_GRAPH_CREATION = false;
  }

  const arePluginIncludesRequired = async (
    project: string,
    pluginConfiguration: ExpandedPluginConfiguration
  ): Promise<boolean> => {
    global.NX_GRAPH_CREATION = true;
    let result: ConfigurationResult;
    try {
      result = await getCreateNodesResultsForPlugin(
        tree,
        pluginConfiguration,
        pluginPath,
        createNodes,
        createNodesV2,
        nxJson
      );
    } finally {
      global.NX_GRAPH_CREATION = false;
    }

    const originalResults = createNodesResults.get(project);

    return !deepEqual(originalResults, result);
  };

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

      if (!(await arePluginIncludesRequired(project, plugin))) {
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

        if (!(await arePluginIncludesRequired(project, existingPlugin))) {
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

// Checks if two objects are structurely equal, without caring
// about the order of the keys.
function deepEqual<T extends Object>(a: T, b: T, logKey = ''): boolean {
  const aKeys = Object.keys(a);
  const bKeys = new Set(Object.keys(b));

  if (aKeys.length !== bKeys.size) {
    return false;
  }

  for (const key of aKeys) {
    if (!bKeys.has(key)) {
      return false;
    }

    if (typeof a[key] === 'object' && typeof b[key] === 'object') {
      if (!deepEqual(a[key], b[key], logKey + '.' + key)) {
        return false;
      }
    } else if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}
