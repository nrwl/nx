import { relative, resolve } from 'node:path/posix';
import { workspaceRoot, type TargetConfiguration } from 'nx/src/devkit-exports';
import { interpolate } from 'nx/src/devkit-internals';

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

export function processTargetOutputs(
  target: TargetConfiguration,
  renamedOutputOptions: Array<{ newName: string; oldName: string }>,
  inferredTarget: TargetConfiguration,
  projectDetails: { projectName: string; projectRoot: string }
): void {
  const interpolatedInferredOutputs = (inferredTarget.outputs ?? []).map(
    (output) =>
      interpolate(output, {
        workspaceRoot: '',
        projectRoot: projectDetails.projectRoot,
        projectName: projectDetails.projectName,
      })
  );
  const targetOutputs = (target.outputs ?? []).map((output) =>
    updateOutput(output, renamedOutputOptions)
  );
  const interpolatedOutputs = targetOutputs.map((output) =>
    interpolate(output, {
      workspaceRoot: '',
      projectRoot: projectDetails.projectRoot,
      projectName: projectDetails.projectName,
    })
  );

  const shouldDelete = interpolatedOutputs.every((output) =>
    interpolatedInferredOutputs.includes(output)
  );
  if (shouldDelete) {
    // all existing outputs are already inferred
    delete target.outputs;
    return;
  }

  // move extra inferred outputs to the target outputs
  for (let i = 0; i < interpolatedInferredOutputs.length; i++) {
    if (!interpolatedOutputs.includes(interpolatedInferredOutputs[i])) {
      targetOutputs.push(inferredTarget.outputs[i]);
      interpolatedOutputs.push(interpolatedInferredOutputs[i]);
    }
  }

  target.outputs = targetOutputs;
}

export function toProjectRelativePath(
  path: string,
  projectRoot: string
): string {
  if (projectRoot === '.') {
    // workspace and project root are the same, we add a leading './' which is
    // required by some tools (e.g. Jest)
    return path.startsWith('.') ? path : `./${path}`;
  }

  const relativePath = relative(
    resolve(workspaceRoot, projectRoot),
    resolve(workspaceRoot, path)
  );

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function updateOutputRenamingOption(
  output: string,
  option: string,
  previousName: string
): string {
  const newOptionToken = `{options.${option}}`;
  const oldOptionToken = `{options.${previousName}}`;

  if (
    !output.startsWith('{workspaceRoot}') &&
    !output.startsWith('{projectRoot}')
  ) {
    return `{projectRoot}/${output.replace(oldOptionToken, newOptionToken)}`;
  }

  if (
    output.startsWith('{workspaceRoot}') &&
    !output.startsWith('{workspaceRoot}/{projectRoot}')
  ) {
    return output
      .replace('{workspaceRoot}', '{projectRoot}')
      .replace(oldOptionToken, newOptionToken);
  }

  return output.replace(oldOptionToken, newOptionToken);
}

function updateOutput(
  output: string,
  renamedOutputOptions: Array<{ newName: string; oldName: string }>
): string {
  if (!/{options\..*}/.test(output)) {
    // output does not contain any option tokens
    return output;
  }

  for (const { newName, oldName } of renamedOutputOptions) {
    const optionToken = `{options.${oldName}}`;
    if (output.includes(optionToken)) {
      return updateOutputRenamingOption(output, newName, oldName);
    }
  }

  if (
    !output.startsWith('{workspaceRoot}') &&
    !output.startsWith('{projectRoot}')
  ) {
    return `{projectRoot}/${output}`;
  }

  if (
    output.startsWith('{workspaceRoot}') &&
    !output.startsWith('{workspaceRoot}/{projectRoot}')
  ) {
    return output.replace('{workspaceRoot}', '{projectRoot}');
  }

  return output;
}
