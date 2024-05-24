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
