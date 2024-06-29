import { minimatch } from 'minimatch';
import { deepStrictEqual } from 'node:assert';
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
  type CreateNodesV2,
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
} from 'nx/src/devkit-internals';
import type { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';
import type { ConfigurationResult } from 'nx/src/project-graph/utils/project-configuration-utils';
import { forEachExecutorOptions } from '../executor-options-utils';
import { deleteMatchingProperties } from './plugin-migration-utils';

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
  targetConfiguration: TargetConfiguration
) => false | string;
type SkipProjectFilter = (
  projectConfiguration: ProjectConfiguration
) => false | string;

class ExecutorToPluginMigrator<T> {
  readonly tree: Tree;
  readonly #projectGraph: ProjectGraph;
  readonly #executor: string;
  readonly #pluginPath: string;
  readonly #pluginOptionsBuilder: PluginOptionsBuilder<T>;
  readonly #postTargetTransformer: PostTargetTransformer;
  readonly #skipTargetFilter: SkipTargetFilter;
  readonly #skipProjectFilter: SkipProjectFilter;
  readonly #specificProjectToMigrate: string;
  #nxJson: NxJsonConfiguration;
  #targetDefaultsForExecutor: Partial<TargetConfiguration>;
  #targetAndProjectsToMigrate: Map<string, Set<string>>;
  #pluginToAddForTarget: Map<string, ExpandedPluginConfiguration<T>>;
  #createNodes?: CreateNodes<T>;
  #createNodesV2?: CreateNodesV2<T>;
  #createNodesResultsForTargets: Map<string, ConfigurationResult>;
  #skippedProjects: Set<string>;

  constructor(
    tree: Tree,
    projectGraph: ProjectGraph,
    executor: string,
    pluginPath: string,
    pluginOptionsBuilder: PluginOptionsBuilder<T>,
    postTargetTransformer: PostTargetTransformer,
    createNodes?: CreateNodes<T>,
    createNodesV2?: CreateNodesV2<T>,
    specificProjectToMigrate?: string,
    filters?: {
      skipProjectFilter?: SkipProjectFilter;
      skipTargetFilter?: SkipTargetFilter;
    }
  ) {
    this.tree = tree;
    this.#projectGraph = projectGraph;
    this.#executor = executor;
    this.#pluginPath = pluginPath;
    this.#pluginOptionsBuilder = pluginOptionsBuilder;
    this.#postTargetTransformer = postTargetTransformer;
    this.#createNodes = createNodes;
    this.#createNodesV2 = createNodesV2;
    this.#specificProjectToMigrate = specificProjectToMigrate;
    this.#skipProjectFilter =
      filters?.skipProjectFilter ?? ((...args) => false);
    this.#skipTargetFilter = filters?.skipTargetFilter ?? ((...args) => false);
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
    this.#targetAndProjectsToMigrate = new Map();
    this.#pluginToAddForTarget = new Map();
    this.#createNodesResultsForTargets = new Map();
    this.#skippedProjects = new Set();

    this.#getTargetDefaultsForExecutor();
    this.#getTargetAndProjectsToMigrate();
    await this.#getCreateNodesResults();
  }

  async #migrateTarget(targetName: string) {
    const include: string[] = [];
    for (const projectName of this.#targetAndProjectsToMigrate.get(
      targetName
    )) {
      include.push(await this.#migrateProject(projectName, targetName));
    }

    this.#pluginToAddForTarget.set(targetName, {
      plugin: this.#pluginPath,
      options: this.#pluginOptionsBuilder(targetName),
      include,
    });
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
      projectConfig[
        '// targets'
      ] = `to see all targets run: nx show project ${projectName} --web`;
    }

    updateProjectConfiguration(this.tree, projectName, projectConfig);

    return `${projectFromGraph.data.root}/**/*`;
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

  #getTargetAndProjectsToMigrate() {
    forEachExecutorOptions(
      this.tree,
      this.#executor,
      (targetConfiguration, projectName, targetName, configurationName) => {
        if (this.#skippedProjects.has(projectName) || configurationName) {
          return;
        }

        if (
          this.#specificProjectToMigrate &&
          projectName !== this.#specificProjectToMigrate
        ) {
          return;
        }

        const skipProjectReason = this.#skipProjectFilter(
          this.#projectGraph.nodes[projectName].data
        );
        if (skipProjectReason) {
          this.#skippedProjects.add(projectName);
          const errorMsg = `The "${projectName}" project cannot be migrated. ${skipProjectReason}`;
          if (this.#specificProjectToMigrate) {
            throw new Error(errorMsg);
          }

          console.warn(errorMsg);
          return;
        }

        const skipTargetReason = this.#skipTargetFilter(targetConfiguration);
        if (skipTargetReason) {
          const errorMsg = `${targetName} target on project "${projectName}" cannot be migrated. ${skipTargetReason}`;
          if (this.#specificProjectToMigrate) {
            throw new Error(errorMsg);
          } else {
            console.warn(errorMsg);
          }
          return;
        }

        if (this.#targetAndProjectsToMigrate.has(targetName)) {
          this.#targetAndProjectsToMigrate.get(targetName).add(projectName);
        } else {
          this.#targetAndProjectsToMigrate.set(
            targetName,
            new Set([projectName])
          );
        }
      }
    );
  }

  #getTargetDefaultsForExecutor() {
    this.#targetDefaultsForExecutor = structuredClone(
      this.#nxJson.targetDefaults?.[this.#executor]
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

export async function migrateProjectExecutorsToPlugin<T>(
  tree: Tree,
  projectGraph: ProjectGraph,
  pluginPath: string,
  createNodesV2: CreateNodesV2<T>,
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
    undefined,
    createNodesV2,
    defaultPluginOptions,
    migrations,
    specificProjectToMigrate
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
  createNodesV2: CreateNodesV2<T>,
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
  const projects = new Map<string, Record<string, string>>();

  for (const migration of migrations) {
    for (const executor of migration.executors) {
      const migrator = new ExecutorToPluginMigrator(
        tree,
        projectGraph,
        executor,
        pluginPath,
        migration.targetPluginOptionMapper,
        migration.postTargetTransformer,
        createNodes,
        createNodesV2,
        specificProjectToMigrate,
        {
          skipProjectFilter: migration.skipProjectFilter,
          skipTargetFilter: migration.skipTargetFilter,
        }
      );

      const result = await migrator.run();

      // invert the result to have a map of projects to their targets
      for (const [target, projectList] of result.entries()) {
        for (const project of projectList) {
          if (!projects.has(project)) {
            projects.set(project, {});
          }

          projects.set(project, {
            ...projects.get(project),
            ...migration.targetPluginOptionMapper(target),
          });
        }
      }
    }
  }

  // apply default options
  for (const [project, pluginOptions] of projects.entries()) {
    projects.set(project, {
      ...defaultPluginOptions,
      ...pluginOptions,
    });
  }

  await addPluginRegistrations(
    tree,
    projects,
    pluginPath,
    createNodes,
    createNodesV2,
    defaultPluginOptions,
    projectGraph
  );

  return projects;
}

async function addPluginRegistrations<T>(
  tree: Tree,
  projects: Map<string, Record<string, string>>,
  pluginPath: string,
  createNodes: CreateNodes | undefined,
  createNodesV2: CreateNodesV2 | undefined,
  defaultPluginOptions: T,
  projectGraph: ProjectGraph
) {
  const nxJson = readNxJson(tree);

  // collect createNodes results for each project before adding the plugins
  const createNodesResults = new Map<string, ConfigurationResult>();
  global.NX_GRAPH_CREATION = true;
  try {
    for (const [project, options] of projects.entries()) {
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

  for (const [project, options] of projects.entries()) {
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

    const projectIncludeGlob = `${projectGraph.nodes[project].data.root}/**/*`;
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

  updateNxJson(tree, nxJson);
}

async function getCreateNodesResultsForPlugin(
  tree: Tree,
  pluginConfiguration: ExpandedPluginConfiguration,
  pluginPath: string,
  createNodes: CreateNodes | undefined,
  createNodesV2: CreateNodesV2 | undefined,
  nxJson: NxJsonConfiguration
): Promise<ConfigurationResult> {
  let projectConfigs: ConfigurationResult;

  try {
    const plugin = new LoadedNxPlugin(
      { createNodes, createNodesV2, name: pluginPath },
      pluginConfiguration
    );
    projectConfigs = await retrieveProjectConfigurations(
      [plugin],
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
