import { type NxJsonConfiguration } from 'nx/src/config/nx-json';
import { type Tree } from 'nx/src/generators/tree';
import { forEachExecutorOptions } from '../executor-options-utils';

type TargetNameOptions<T extends object, K extends keyof T = keyof T> = {
  [key in K]: string;
};

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
 * @param pluginToAdd The name of the plugin to add to NxJson if it does not exist
 * @param preferredTargetNames The record of the targets and the desired names for them
 * @param defaultTargetNames The record of the default names for the targets
 * @param nxJson The current NxJson Configuration
 *
 * @return NxJsonConfiguration The potentially updated NxJson
 */
export function addPluginWithPreferredTargetNames<T extends object>(
  pluginToAdd: string,
  preferredTargetNames: TargetNameOptions<T>,
  defaultTargetNames: TargetNameOptions<T>,
  nxJson: NxJsonConfiguration
): NxJsonConfiguration {
  nxJson.plugins ??= [];

  let preferredTargetNamesMatchDefaults = true;
  for (const key in preferredTargetNames) {
    if (preferredTargetNames[key] !== defaultTargetNames[key]) {
      preferredTargetNamesMatchDefaults = false;
    }
  }

  let addNewPluginEntry = true;
  for (let i = 0; i < nxJson.plugins.length; i++) {
    const plugin = nxJson.plugins[i];
    if (
      typeof plugin === 'string' &&
      plugin === pluginToAdd &&
      preferredTargetNamesMatchDefaults
    ) {
      addNewPluginEntry = false;
    } else if (typeof plugin === 'object' && plugin.plugin === pluginToAdd) {
      const pluginOptions = plugin.options as T;
      if (!pluginOptions && preferredTargetNamesMatchDefaults) {
        addNewPluginEntry = false;
      } else if (
        Object.entries(pluginOptions).every(
          ([targetName, targetNameValue]) =>
            preferredTargetNames[targetName] === targetNameValue
        )
      ) {
        addNewPluginEntry = false;
      }
    }
  }

  if (addNewPluginEntry) {
    nxJson.plugins.push({
      plugin: pluginToAdd,
      options: preferredTargetNames,
    });
  }

  return nxJson;
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
