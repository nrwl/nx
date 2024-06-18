import type { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';

import { minimatch } from 'minimatch';
import { deepStrictEqual } from 'node:assert';

import { forEachExecutorOptions } from '../executor-options-utils';
import { deleteMatchingProperties } from './plugin-migration-utils';

import {
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  readProjectConfiguration,
  ProjectGraph,
  ExpandedPluginConfiguration,
  NxJsonConfiguration,
  TargetConfiguration,
  Tree,
  CreateNodes,
  CreateNodesV2,
} from 'nx/src/devkit-exports';

import {
  mergeTargetConfigurations,
  retrieveProjectConfigurations,
  LoadedNxPlugin,
  ProjectConfigurationsError,
} from 'nx/src/devkit-internals';
import type { ConfigurationResult } from 'nx/src/project-graph/utils/project-configuration-utils';
import type { InputDefinition } from 'nx/src/config/workspace-json-project-json';

type PluginOptionsBuilder<T> = (targetName: string) => T;
type PostTargetTransformer = (
  targetConfiguration: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: TargetConfiguration
) => TargetConfiguration | Promise<TargetConfiguration>;
type SkipTargetFilter = (
  targetConfiguration: TargetConfiguration
) => [boolean, string];

class ExecutorToPluginMigrator<T> {
  readonly tree: Tree;
  readonly #projectGraph: ProjectGraph;
  readonly #executor: string;
  readonly #pluginPath: string;
  readonly #pluginOptionsBuilder: PluginOptionsBuilder<T>;
  readonly #postTargetTransformer: PostTargetTransformer;
  readonly #skipTargetFilter: SkipTargetFilter;
  readonly #specificProjectToMigrate: string;
  #nxJson: NxJsonConfiguration;
  #targetDefaultsForExecutor: Partial<TargetConfiguration>;
  #targetAndProjectsToMigrate: Map<string, Set<string>>;
  #pluginToAddForTarget: Map<string, ExpandedPluginConfiguration<T>>;
  #createNodes?: CreateNodes<T>;
  #createNodesV2?: CreateNodesV2<T>;
  #createNodesResultsForTargets: Map<string, ConfigurationResult>;

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
    skipTargetFilter?: SkipTargetFilter
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
    this.#skipTargetFilter = skipTargetFilter ?? ((...args) => [false, '']);
  }

  async run(): Promise<Map<string, Set<string>>> {
    await this.#init();
    if (this.#targetAndProjectsToMigrate.size > 0) {
      for (const targetName of this.#targetAndProjectsToMigrate.keys()) {
        await this.#migrateTarget(targetName);
      }
      await this.#addPlugins();
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
      createdTarget
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

  async #pluginRequiresIncludes(
    targetName: string,
    plugin: ExpandedPluginConfiguration<T>
  ) {
    const loadedPlugin = new LoadedNxPlugin(
      {
        createNodesV2: this.#createNodesV2,
        createNodes: this.#createNodes,
        name: this.#pluginPath,
      },
      plugin
    );

    const originalResults = this.#createNodesResultsForTargets.get(targetName);

    let resultsWithIncludes: ConfigurationResult;
    try {
      resultsWithIncludes = await retrieveProjectConfigurations(
        [loadedPlugin],
        this.tree.root,
        this.#nxJson
      );
    } catch (e) {
      if (e instanceof ProjectConfigurationsError) {
        resultsWithIncludes = e.partialProjectConfigurationsResult;
      } else {
        throw e;
      }
    }

    return !deepEqual(originalResults, resultsWithIncludes);
  }

  async #addPlugins() {
    for (const [targetName, plugin] of this.#pluginToAddForTarget.entries()) {
      const pluginOptions = this.#pluginOptionsBuilder(targetName);

      const existingPlugin = this.#nxJson.plugins.find(
        (plugin: ExpandedPluginConfiguration<T>) => {
          if (
            typeof plugin === 'string' ||
            plugin.plugin !== this.#pluginPath
          ) {
            return;
          }

          for (const key in plugin.options) {
            if (plugin.options[key] !== pluginOptions[key]) {
              return false;
            }
          }

          return true;
        }
      ) as ExpandedPluginConfiguration<T>;

      if (existingPlugin?.include) {
        // Add to the existing plugin includes
        existingPlugin.include = existingPlugin.include.concat(
          // Any include that is in the new plugin's include list
          plugin.include.filter(
            (projectPath) =>
              // And is not already covered by the existing plugin's include list
              !existingPlugin.include.some((pluginIncludes) =>
                minimatch(projectPath, pluginIncludes, { dot: true })
              )
          )
        );

        if (!(await this.#pluginRequiresIncludes(targetName, existingPlugin))) {
          delete existingPlugin.include;
        }
      }

      if (!existingPlugin) {
        if (!(await this.#pluginRequiresIncludes(targetName, plugin))) {
          plugin.include = undefined;
        }
        this.#nxJson.plugins.push(plugin);
      }
    }

    updateNxJson(this.tree, this.#nxJson);
  }

  #getTargetAndProjectsToMigrate() {
    forEachExecutorOptions(
      this.tree,
      this.#executor,
      (targetConfiguration, projectName, targetName, configurationName) => {
        if (configurationName) {
          return;
        }

        if (
          this.#specificProjectToMigrate &&
          projectName !== this.#specificProjectToMigrate
        ) {
          return;
        }

        const [skipTarget, reasonTargetWasSkipped] =
          this.#skipTargetFilter(targetConfiguration);
        if (skipTarget) {
          const errorMsg = `${targetName} target on project "${projectName}" cannot be migrated. ${reasonTargetWasSkipped}`;
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

    for (const targetName of this.#targetAndProjectsToMigrate.keys()) {
      const loadedPlugin = new LoadedNxPlugin(
        {
          createNodesV2: this.#createNodesV2,
          createNodes: this.#createNodes,
          name: this.#pluginPath,
        },
        {
          plugin: this.#pluginPath,
          options: this.#pluginOptionsBuilder(targetName),
        }
      );
      let projectConfigs: ConfigurationResult;
      try {
        projectConfigs = await retrieveProjectConfigurations(
          [loadedPlugin],
          this.tree.root,
          this.#nxJson
        );
      } catch (e) {
        if (e instanceof ProjectConfigurationsError) {
          projectConfigs = e.partialProjectConfigurationsResult;
        } else {
          throw e;
        }
      }

      this.#createNodesResultsForTargets.set(targetName, projectConfigs);
    }
  }
}

export async function migrateExecutorToPlugin<T>(
  tree: Tree,
  projectGraph: ProjectGraph,
  executor: string,
  pluginPath: string,
  pluginOptionsBuilder: PluginOptionsBuilder<T>,
  postTargetTransformer: PostTargetTransformer,
  createNodes: CreateNodesV2<T>,
  specificProjectToMigrate?: string,
  skipTargetFilter?: SkipTargetFilter
): Promise<Map<string, Set<string>>> {
  const migrator = new ExecutorToPluginMigrator<T>(
    tree,
    projectGraph,
    executor,
    pluginPath,
    pluginOptionsBuilder,
    postTargetTransformer,
    undefined,
    createNodes,
    specificProjectToMigrate,
    skipTargetFilter
  );
  return await migrator.run();
}

export async function migrateExecutorToPluginV1<T>(
  tree: Tree,
  projectGraph: ProjectGraph,
  executor: string,
  pluginPath: string,
  pluginOptionsBuilder: PluginOptionsBuilder<T>,
  postTargetTransformer: PostTargetTransformer,
  createNodes: CreateNodes<T>,
  specificProjectToMigrate?: string,
  skipTargetFilter?: SkipTargetFilter
): Promise<Map<string, Set<string>>> {
  const migrator = new ExecutorToPluginMigrator<T>(
    tree,
    projectGraph,
    executor,
    pluginPath,
    pluginOptionsBuilder,
    postTargetTransformer,
    createNodes,
    undefined,
    specificProjectToMigrate,
    skipTargetFilter
  );
  return await migrator.run();
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
