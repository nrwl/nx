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
  createNodes: CreateNodes<T>
): Promise<{ targetName: string; include: string[] }> {
  const { projects, targetName } = getProjectsToMigrate(tree, executor);
  const nxJsonConfiguration = readNxJson(tree);
  const targetDefaultsForExecutor =
    nxJsonConfiguration.targetDefaults?.[executor];

  const configFiles = glob(tree, [createNodes[0]]);
  let include: string[] = [];
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
    delete target.options?.config;

    deleteMatchingProperties(target, createdTarget);

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

  return { targetName, include };
}

/**
 * Add the plugin to nx.json using the preferred target names
 *
 * @example
 * let nxJson = readNxJson(tree);
 * // Will set `test` and `test-ci` as the targetNames
 * nxJson = addPlugin<PlaywrightPluginOptions>(
 *    '@nx/playwright/plugin',
 *    { targetName: 'test', ciTargetName: 'test-ci' },
 *    { targetName: 'e2e', ciTargetName: 'e2e-ci' },
 *    nxJson
 * );
 * updateNxJson(tree, nxJson);
 *
 * @param pluginPath The name of the plugin to add to NxJson if it does not exist
 * @param preferredTargetNames The record of the targets and the desired names for them
 * @param defaultTargetNames The record of the default names for the targets
 * @param nxJson The current NxJson Configuration
 *
 * @return NxJsonConfiguration The potentially updated NxJson
 */
export function addPluginWithOptions<T extends object>(
  tree: Tree,
  pluginPath: string,
  include: string[],
  pluginOptions: T
): NxJsonConfiguration {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  // TODO: Remove these comments or move them somewhere else
  // 1. We had executors
  // 2. We simplified it down to 1 target to replace
  // 3. 1 plugin can replace multiple executors by creating multiple targets

  // 1. If the plugin does not exist, add it with those options
  // 2. If the plugin exists AND the options match the options that are being added, do nothing
  // 3. If the plugin exists AND the options do not match, add the plugin with the new options

  // 1. User uses @nx/playwright/plugin for test
  //   a. NxJson has { options: { targetName: test } }
  // 2. User uses @nx/playwright:playwright for e2e
  // 3. We want to add { options: { targetName: e2e }, includes: [] }

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
      return true;
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
        targetToMigrate[key].every((v) => createdTarget[key].includes(v)) &&
        targetToMigrate[key].length === createdTarget[key].length
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
 * @return {{ projects: string[]; targetName: string }} - Array of projects that can be migrated and the most common target name
 */
export function getProjectsToMigrate(
  tree: Tree,
  executor: string
): { projects: string[]; targetName: string } {
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
  };
}
