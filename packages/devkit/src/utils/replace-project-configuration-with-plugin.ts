import {
  CreateNodes,
  glob,
  ProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
} from 'nx/src/devkit-exports';
import { findProjectForPath, hashObject } from 'nx/src/devkit-internals';

export async function replaceProjectConfigurationsWithPlugin<T = unknown>(
  tree: Tree,
  rootMappings: Map<string, string>,
  pluginPath: string,
  createNodes: CreateNodes<T>,
  pluginOptions: T
): Promise<void> {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    throw new Error('Could not find nx.json in the workspace.');
  }
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string' ? p === pluginPath : p.plugin === pluginPath
  );

  if (hasPlugin) {
    return;
  }

  nxJson.plugins ??= [];
  nxJson.plugins.push({
    plugin: pluginPath,
    options: pluginOptions,
  });
  updateNxJson(tree, nxJson);

  const [pluginGlob, createNodesFunction] = createNodes;
  const configFiles = glob(tree, [pluginGlob]);

  const results = await createNodesFunction(configFiles, pluginOptions, {
    workspaceRoot: tree.root,
    nxJsonConfiguration: readNxJson(tree) ?? nxJson,
  });

  for (const [configFile, nodes] of results) {
    try {
      const projectName = findProjectForPath(configFile, rootMappings);
      if (!projectName) {
        throw new Error(`Could not find a project for ${configFile}.`);
      }
      const projectConfig = readProjectConfiguration(tree, projectName);
      const node = Object.values(nodes.projects ?? {})[0];
      if (!node) {
        throw new Error(`No project was created for ${configFile}.`);
      }

      for (const [targetName, targetConfig] of Object.entries(
        node.targets ?? {}
      )) {
        const projectTargets = projectConfig.targets;
        if (!projectTargets) {
          throw new Error(`Project "${projectName}" has no targets.`);
        }
        const targetFromProjectConfig = projectTargets[targetName];

        if (targetFromProjectConfig?.executor !== targetConfig.executor) {
          continue;
        }
        if (!targetFromProjectConfig) {
          throw new Error(
            `Project "${projectName}" has no "${targetName}" target.`
          );
        }

        removeConfigurationDefinedByPlugin(
          targetName,
          targetFromProjectConfig,
          targetConfig,
          projectTargets
        );
      }

      updateProjectConfiguration(tree, projectName, projectConfig);
    } catch (e) {
      console.error(e);
    }
  }
}

function removeConfigurationDefinedByPlugin(
  targetName: string,
  targetFromProjectConfig: TargetConfiguration,
  targetFromCreateNodes: TargetConfiguration,
  projectTargets: NonNullable<ProjectConfiguration['targets']>
) {
  // Executor
  delete targetFromProjectConfig.executor;

  // Default Configuration
  if (
    targetFromProjectConfig.defaultConfiguration ===
    targetFromCreateNodes.defaultConfiguration
  ) {
    delete targetFromProjectConfig.defaultConfiguration;
  }

  // Cache
  if (targetFromProjectConfig.cache === targetFromCreateNodes.cache) {
    delete targetFromProjectConfig.cache;
  }

  // Depends On
  if (
    targetFromProjectConfig.dependsOn &&
    shouldRemoveArrayProperty(
      targetFromProjectConfig.dependsOn,
      targetFromCreateNodes.dependsOn
    )
  ) {
    delete targetFromProjectConfig.dependsOn;
  }

  // Outputs
  if (
    targetFromProjectConfig.outputs &&
    shouldRemoveArrayProperty(
      targetFromProjectConfig.outputs,
      targetFromCreateNodes.outputs
    )
  ) {
    delete targetFromProjectConfig.outputs;
  }

  // Inputs
  if (
    targetFromProjectConfig.inputs &&
    shouldRemoveArrayProperty(
      targetFromProjectConfig.inputs,
      targetFromCreateNodes.inputs
    )
  ) {
    delete targetFromProjectConfig.inputs;
  }

  // Options
  for (const [optionName, optionValue] of Object.entries(
    targetFromProjectConfig.options ?? {}
  )) {
    if (equals(targetFromCreateNodes.options[optionName], optionValue)) {
      delete targetFromProjectConfig.options[optionName];
    }
  }
  if (Object.keys(targetFromProjectConfig.options).length === 0) {
    delete targetFromProjectConfig.options;
  }

  // Configurations
  const configurations = targetFromProjectConfig.configurations ?? {};
  for (const [configName, configOptions] of Object.entries(configurations)) {
    for (const [optionName, optionValue] of Object.entries(configOptions)) {
      if (
        targetFromCreateNodes.configurations?.[configName]?.[optionName] ===
        optionValue
      ) {
        delete configurations[configName][optionName];
      }
    }
    if (Object.keys(configOptions).length === 0) {
      delete configurations[configName];
    }
  }
  if (Object.keys(targetFromProjectConfig.configurations ?? {}).length === 0) {
    delete targetFromProjectConfig.configurations;
  }

  if (Object.keys(targetFromProjectConfig).length === 0) {
    delete projectTargets[targetName];
  }
}

function equals(a: unknown, b: unknown) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return hashObject(a) === hashObject(b);
  }
  return a === b;
}

function shouldRemoveArrayProperty(
  arrayValuesFromProjectConfiguration: (object | string)[],
  arrayValuesFromCreateNodes: (object | string)[] | undefined
) {
  if (!arrayValuesFromCreateNodes) {
    throw new TypeError('The inferred target is missing an array property.');
  }
  const setOfArrayValuesFromProjectConfiguration = new Set(
    arrayValuesFromProjectConfiguration
  );
  loopThroughArrayValuesFromCreateNodes: for (const arrayValueFromCreateNodes of arrayValuesFromCreateNodes) {
    if (typeof arrayValueFromCreateNodes === 'string') {
      if (
        !setOfArrayValuesFromProjectConfiguration.has(arrayValueFromCreateNodes)
      ) {
        // If the inputs from the project configuration is missing an input from createNodes it was removed
        return false;
      } else {
        setOfArrayValuesFromProjectConfiguration.delete(
          arrayValueFromCreateNodes
        );
      }
    } else {
      for (const arrayValue of setOfArrayValuesFromProjectConfiguration.values()) {
        if (
          typeof arrayValue !== 'string' &&
          hashObject(arrayValue) === hashObject(arrayValueFromCreateNodes)
        ) {
          setOfArrayValuesFromProjectConfiguration.delete(arrayValue);
          // Continue the outer loop, breaking out of this loop
          continue loopThroughArrayValuesFromCreateNodes;
        }
      }
      // If an input was not matched, that means the input was removed
      return false;
    }
  }
  // If there are still inputs in the project configuration, they have added additional inputs
  return setOfArrayValuesFromProjectConfiguration.size === 0;
}
