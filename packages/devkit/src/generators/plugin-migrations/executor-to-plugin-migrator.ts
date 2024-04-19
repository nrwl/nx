import type { TargetConfiguration } from 'nx/src/config/workspace-json-project-json';
import type {
  ExpandedPluginConfiguration,
  NxJsonConfiguration,
} from 'nx/src/config/nx-json';
import type { Tree } from 'nx/src/generators/tree';
import type {
  CreateNodes,
  CreateNodesContext,
  CreateNodesResult,
} from 'nx/src/project-graph/plugins';
import type { ProjectGraph } from 'nx/src/config/project-graph';
import type { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';

import { minimatch } from 'minimatch';

import { forEachExecutorOptions } from '../executor-options-utils';
import { deleteMatchingProperties } from './plugin-migration-utils';
import { requireNx } from '../../../nx';

const {
  glob,
  readNxJson,
  updateNxJson,
  mergeTargetConfigurations,
  updateProjectConfiguration,
  readProjectConfiguration,
} = requireNx();

type PluginOptionsBuilder<T> = (targetName: string) => T;
type PostTargetTransformer = (
  targetConfiguration: TargetConfiguration
) => TargetConfiguration;
type SkipTargetFilter = (
  targetConfiguration: TargetConfiguration
) => [boolean, string];

export class ExecutorToPluginMigrator<T> {
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
  #createNodes: CreateNodes<T>;
  #configFiles: string[];
  #createNodesContext: CreateNodesContext;
  #createNodesResultsForTargets: Map<string, CreateNodesResult>;

  constructor(
    tree: Tree,
    projectGraph: ProjectGraph,
    executor: string,
    pluginPath: string,
    pluginOptionsBuilder: PluginOptionsBuilder<T>,
    postTargetTransformer: PostTargetTransformer,
    createNodes: CreateNodes<T>,
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
    this.#specificProjectToMigrate = specificProjectToMigrate;
    this.#skipTargetFilter = skipTargetFilter ?? ((...args) => [false, '']);
  }

  async run(): Promise<void> {
    await this.#init();
    for (const targetName of this.#targetAndProjectsToMigrate.keys()) {
      this.#migrateTarget(targetName);
    }
    this.#addPlugins();
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

  #migrateTarget(targetName: string) {
    const include: string[] = [];
    for (const projectName of this.#targetAndProjectsToMigrate.get(
      targetName
    )) {
      include.push(this.#migrateProject(projectName, targetName));
    }

    this.#pluginToAddForTarget.set(targetName, {
      plugin: this.#pluginPath,
      options: this.#pluginOptionsBuilder(targetName),
      include,
    });
  }

  #migrateProject(projectName: string, targetName: string) {
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
    projectTarget = this.#postTargetTransformer(projectTarget);

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
    updateProjectConfiguration(this.tree, projectName, projectConfig);

    return `${projectFromGraph.data.root}/**/*`;
  }

  #addPlugins() {
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
        for (const pluginIncludes of existingPlugin.include) {
          for (const projectPath of plugin.include) {
            if (!minimatch(projectPath, pluginIncludes, { dot: true })) {
              existingPlugin.include.push(projectPath);
            }
          }
        }

        const allConfigFilesAreIncluded = this.#configFiles.every(
          (configFile) => {
            for (const includePattern of existingPlugin.include) {
              if (minimatch(configFile, includePattern, { dot: true })) {
                return true;
              }
            }
            return false;
          }
        );

        if (allConfigFilesAreIncluded) {
          existingPlugin.include = undefined;
        }
      }

      if (!existingPlugin) {
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

    if (this.#targetAndProjectsToMigrate.size === 0) {
      const errorMsg = this.#specificProjectToMigrate
        ? `Project "${
            this.#specificProjectToMigrate
          }" does not contain any targets using the "${
            this.#executor
          }" executor. Please select a project that does.`
        : `Could not find any targets using the "${this.#executor}" executor.`;
      throw new Error(errorMsg);
    }
  }

  #getTargetDefaultsForExecutor() {
    this.#targetDefaultsForExecutor =
      this.#nxJson.targetDefaults?.[this.#executor];
  }

  #getCreatedTargetForProjectRoot(targetName: string, projectRoot: string) {
    const createdProject = Object.entries(
      this.#createNodesResultsForTargets.get(targetName)?.projects ?? {}
    ).find(([root]) => root === projectRoot)[1];
    const createdTarget: TargetConfiguration<RunCommandsOptions> =
      createdProject.targets[targetName];
    delete createdTarget.command;
    delete createdTarget.options?.cwd;

    return createdTarget;
  }

  async #getCreateNodesResults() {
    this.#configFiles = glob(this.tree, [this.#createNodes[0]]);
    this.#createNodesContext = {
      workspaceRoot: this.tree.root,
      nxJsonConfiguration: this.#nxJson,
      configFiles: this.#configFiles,
    };

    for (const targetName of this.#targetAndProjectsToMigrate.keys()) {
      for (const configFile of this.#configFiles) {
        const result = await this.#createNodes[1](
          configFile,
          this.#pluginOptionsBuilder(targetName),
          this.#createNodesContext
        );
        if (!this.#createNodesResultsForTargets.has(targetName)) {
          this.#createNodesResultsForTargets.set(targetName, result);
        } else {
          let existingResult =
            this.#createNodesResultsForTargets.get(targetName);
          existingResult = {
            ...existingResult,
            ...result,
            projects: { ...existingResult.projects, ...result.projects },
          };
          this.#createNodesResultsForTargets.set(targetName, existingResult);
        }
      }
    }
  }
}
