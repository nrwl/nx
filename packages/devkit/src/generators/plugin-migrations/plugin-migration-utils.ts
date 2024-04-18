import type {
  ExpandedPluginConfiguration,
  NxJsonConfiguration,
} from 'nx/src/config/nx-json';
import type { Tree } from 'nx/src/generators/tree';
import type { TargetConfiguration } from 'nx/src/config/workspace-json-project-json';
import type { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';
import type {
  CreateNodes,
  CreateNodesContext,
  CreateNodesResult,
} from 'nx/src/project-graph/plugins';
import type { ProjectGraph } from 'nx/src/config/project-graph';

import { forEachExecutorOptions } from '../executor-options-utils';

import { requireNx } from '../../../nx';
import { minimatch } from 'minimatch';

const {
  glob,
  readNxJson,
  updateNxJson,
  mergeTargetConfigurations,
  updateProjectConfiguration,
  readProjectConfiguration,
} = requireNx();

/**
 * Migrate project targets using a specified executor to its plugin equivalent
 * Get the targetName that should be used for the plugin and an optional list of include paths for the projects the plugin applies to
 *
 * @example
 * function createProjectConfigs(
 *   tree: Tree,
 *   root: string,
 *   targetName: string,
 *   context: CreateNodesContext
 * ) {
 *   const playwrightConfigPath = ['js', 'ts', 'cjs', 'cts', 'mjs', 'mts']
 *     .map((ext) => joinPathFragments(root, `playwright.config.${ext}`))
 *     .find((path) => tree.exists(path));
 *   if (!playwrightConfigPath) {
 *     return;
 *   }
 *
 *   return createNodes[1](
 *     playwrightConfigPath,
 *     {
 *       targetName,
 *     },
 *     context
 *   );
 * }
 *
 * function postTargetTransformer(
 *   target: TargetConfiguration
 * ): TargetConfiguration {
 *   if (target.options) {
 *     for (const [key, value] of Object.entries(target.options)) {
 *       const newKeyName = names(key).fileName;
 *       delete target.options[key];
 *       target.options[newKeyName] = value;
 *     }
 *   }
 *
 *   return target;
 * }
 *
 * const { targetName, include } = await migrateExecutorToPlugin(
 *   tree,
 *   projectGraph,
 *   createProjectConfigs,
 *   '@nx/playwright:playwright',
 *   createNodes,
 *   postTargetTransformer
 * );
 *
 *
 * @param tree Virtual Tree
 * @param projectGraph ProjectGraph
 * @param createProjectsConfig Function returning the CreateNodesResult for the plugin using the projects that have been marked for migration
 * @param executor The executor to migrate from
 * @param createNodes The CreateNodes tuple used by the plugin
 * @param postTargetTransformer Apply transformations to the project's target after matching properties have been deleted
 */
export async function migrateExecutorToPlugin<T>(
  tree: Tree,
  projectGraph: ProjectGraph,
  createProjectsConfig: (
    tree: Tree,
    projectRoot: string,
    targetName: string,
    context: CreateNodesContext
  ) => CreateNodesResult | Promise<CreateNodesResult>,
  executor: string,
  createNodes: CreateNodes<T>,
  postTargetTransformer: (
    target: TargetConfiguration,
    tree?: Tree,
    projectRoot?: string
  ) => TargetConfiguration = (targetConfiguration) => targetConfiguration
): Promise<{
  targetName: string;
  include: string[] | undefined;
  migratedProjects: string[];
}> {
  const { projects, targetName } = getProjectsToMigrate(tree, executor);
  const nxJsonConfiguration = readNxJson(tree);
  const targetDefaultsForExecutor =
    nxJsonConfiguration.targetDefaults?.[executor];

  const configFiles = glob(tree, [createNodes[0]]);
  let include: string[] = [];
  const migratedProjects = [];
  for (const projectName of projects) {
    const projectFromGraph = projectGraph.nodes[projectName];

    const context = {
      workspaceRoot: tree.root,
      nxJsonConfiguration,
      configFiles,
    };
    const projectConfigurations = await createProjectsConfig(
      tree,
      projectFromGraph.data.root,
      targetName,
      context
    );

    if (!projectConfigurations) {
      continue;
    }

    include.push(`${projectFromGraph.data.root}/**/*`);
    migratedProjects.push(projectName);

    const createdProject = Object.entries(
      projectConfigurations?.projects ?? {}
    ).find(([root]) => root === projectFromGraph.data.root)[1];

    const createdTarget: TargetConfiguration<RunCommandsOptions> =
      createdProject.targets[targetName];
    delete createdTarget.command;
    delete createdTarget.options?.cwd;

    const projectConfig = readProjectConfiguration(tree, projectName);
    let target = projectConfig.targets[targetName];

    target = mergeTargetConfigurations(target, targetDefaultsForExecutor);
    delete target.executor;

    deleteMatchingProperties(target, createdTarget);

    target = postTargetTransformer(target, tree, projectFromGraph.data.root);

    if (Object.keys(target).length > 0) {
      projectConfig.targets[targetName] = target;
    } else {
      delete projectConfig.targets[targetName];
    }
    updateProjectConfiguration(tree, projectName, projectConfig);
  }

  const allConfigFilesAreIncluded = configFiles.every((configFile) => {
    for (const includePattern of include) {
      if (minimatch(configFile, includePattern, { dot: true })) {
        return true;
      }
    }
    return false;
  });

  if (allConfigFilesAreIncluded) {
    include = undefined;
  }

  return { targetName, include, migratedProjects };
}

/**
 * Add the plugin to nx.json using the specified target names
 *
 * If the plugin does not exist, add it with the specified target names
 * If the plugin exists and the target names match the existing plugin, do nothing
 * If the plugin exists and the target names do not match, add a new plugin entry scoped to just the projects listed in the include paths
 *
 * @example
 * // Will set `test` and `test-ci` as the targetNames
 *
 * const include = ["myapp\/**\/*"];
 * addPluginWithOptions<PlaywrightPluginOptions>(
 *    tree,
 *    '@nx/playwright/plugin',
 *    include
 *    { targetName: 'test', ciTargetName: 'test-ci' },
 * );
 *
 * @param tree Virtual Tree
 * @param pluginPath The name of the plugin to add to NxJson if it does not exist
 * @param include Optional - An array of project paths that this plugin should only apply to
 * @param pluginOptions The record of the names for the targets
 */
export function addPluginWithOptions<T extends object>(
  tree: Tree,
  pluginPath: string,
  include: string[] | undefined,
  pluginOptions: T
): void {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  const pluginExists = nxJson.plugins.find(
    (plugin: ExpandedPluginConfiguration<T>) => {
      if (typeof plugin === 'string' || plugin.plugin !== pluginPath) {
        return;
      }
      for (const key in plugin.options) {
        if (plugin.options[key] !== pluginOptions[key]) {
          return false;
        }
      }

      let includesContainsAllNewIncludePaths = !(!include && plugin.include);

      if (include && plugin.include) {
        for (const pluginIncludes of plugin.include) {
          for (const projectPath of include) {
            if (!minimatch(projectPath, pluginIncludes, { dot: true })) {
              includesContainsAllNewIncludePaths = false;
            }
          }
        }
      }

      return includesContainsAllNewIncludePaths;
    }
  );
  if (pluginExists) {
    return;
  }

  nxJson.plugins.push({
    plugin: pluginPath,
    include,
    options: pluginOptions,
  });

  updateNxJson(tree, nxJson);
}

/**
 * Iterate through the current target in the project.json and its options comparing it to the target created by the Plugin itself
 * Delete matching properties from current target.
 *
 * _Note: Deletes by reference_
 *
 * @example
 * // Run the plugin to get all the projects
 * const { projects } = await createNodes[1](
 *    playwrightConfigPath,
 *    { targetName, ciTargetName: 'e2e-ci' },
 *    { workspaceRoot: tree.root, nxJsonConfiguration, configFiles }
 * );
 *
 * // Find the project that matches the one that is being migrated
 * const createdProject = Object.entries(projects ?? {}).find(
 *  ([root]) => root === projectFromGraph.data.root
 * )[1];
 *
 * // Get the created TargetConfiguration for the target being migrated
 * const createdTarget: TargetConfiguration<RunCommandsOptions> =
 *    createdProject.targets[targetName];
 *
 * // Delete specific run-commands options
 * delete createdTarget.command;
 * delete createdTarget.options?.cwd;
 *
 * // Get the TargetConfiguration for the target being migrated from project.json
 * const projectConfig = readProjectConfiguration(tree, projectName);
 * let targetToMigrate = projectConfig.targets[targetName];
 *
 * // Merge the target defaults for the executor to the target being migrated
 * target = mergeTargetConfigurations(targetToMigrate, targetDefaultsForExecutor);
 *
 * // Delete executor and any additional options that are no longer necessary
 * delete target.executor;
 * delete target.options?.config;
 *
 * // Run deleteMatchingProperties to delete further options that match what the plugin creates
 * deleteMatchingProperties(target, createdTarget);
 *
 * // Delete the target if it is now empty, otherwise, set it to the updated TargetConfiguration
 * if (Object.keys(target).length > 0) {
 *    projectConfig.targets[targetName] = target;
 * } else {
 *    delete projectConfig.targets[targetName];
 * }
 *
 * updateProjectConfiguration(tree, projectName, projectConfig);
 *
 * @param targetToMigrate The target from project.json
 * @param createdTarget The target created by the Plugin
 */
export function deleteMatchingProperties(
  targetToMigrate: object,
  createdTarget: object
): void {
  for (const key in targetToMigrate) {
    if (Array.isArray(targetToMigrate[key])) {
      if (
        targetToMigrate[key].every((v) => createdTarget[key]?.includes(v)) &&
        targetToMigrate[key].length === createdTarget[key]?.length
      ) {
        delete targetToMigrate[key];
      }
    } else if (
      typeof targetToMigrate[key] === 'object' &&
      typeof createdTarget[key] === 'object'
    ) {
      deleteMatchingProperties(targetToMigrate[key], createdTarget[key]);
    } else if (targetToMigrate[key] === createdTarget[key]) {
      delete targetToMigrate[key];
    }
    if (
      typeof targetToMigrate[key] === 'object' &&
      Object.keys(targetToMigrate[key]).length === 0
    ) {
      delete targetToMigrate[key];
    }
  }
}

/**
 * Collect all the projects using the given executor and the most common target name it is being used with
 * Only the projects using the most common target name will be returned
 *
 * @example
 * const { projects, targetName } = getProjectsToMigrate(
 *    tree,
 *    '@nx/playwright:playwright'
 * );
 *
 * @param tree Virtual Tree
 * @param executor Executor that is being migrated
 * @return {{ projects: string[]; targetName: string, allProjectsWithExecutor: Set<string> }} - Array of projects that can be migrated, the most common target name and all the projects containing the executor
 */
export function getProjectsToMigrate(
  tree: Tree,
  executor: string
): {
  projects: string[];
  targetName: string;
  allProjectsWithExecutor: Set<string>;
} {
  const allProjectsWithExecutor = new Map<string, Set<string>>();
  const targetCounts = new Map<string, number>();

  forEachExecutorOptions(
    tree,
    executor,
    (_, projectName, targetName, configurationName) => {
      if (configurationName) {
        return;
      }

      if (allProjectsWithExecutor.has(projectName)) {
        allProjectsWithExecutor.get(projectName).add(targetName);
      } else {
        allProjectsWithExecutor.set(projectName, new Set([targetName]));
      }

      if (targetCounts.has(targetName)) {
        targetCounts.set(targetName, targetCounts.get(targetName) + 1);
      } else {
        targetCounts.set(targetName, 1);
      }
    }
  );

  let preferredTargetName: string = Array.from(targetCounts.keys())[0];
  for (const [targetName, count] of targetCounts) {
    if (count > targetCounts.get(preferredTargetName)) {
      preferredTargetName = targetName;
    }
  }

  const projects = Array.from(allProjectsWithExecutor)
    .filter(([_, targets]) => {
      return targets.has(preferredTargetName);
    })
    .map(([projectName, _]) => projectName);

  return {
    projects,
    targetName: preferredTargetName,
    allProjectsWithExecutor: new Set(allProjectsWithExecutor.keys()),
  };
}
