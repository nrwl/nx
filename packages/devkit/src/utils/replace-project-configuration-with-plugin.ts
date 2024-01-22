import type {
  ProjectConfiguration,
  TargetConfiguration,
} from 'nx/src/config/workspace-json-project-json';
import type { Tree } from 'nx/src/generators/tree';
import type { CreateNodes } from 'nx/src/utils/nx-plugin';
import { requireNx } from '../../nx';
const {
  readNxJson,
  updateNxJson,
  glob,
  hashObject,
  findProjectForPath,
  readProjectConfiguration,
  updateProjectConfiguration,
} = requireNx();

export async function replaceProjectConfigurationsWithPlugin<T = unknown>(
  tree: Tree,
  rootMappings: Map<string, string>,
  pluginPath: string,
  createNodes: CreateNodes<T>,
  pluginOptions: T
): Promise<void> {
  const nxJson = readNxJson(tree);
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

  for (const configFile of configFiles) {
    try {
      const projectName = findProjectForPath(configFile, rootMappings);
      const projectConfig = readProjectConfiguration(tree, projectName);
      const nodes = await createNodesFunction(configFile, pluginOptions, {
        workspaceRoot: tree.root,
        nxJsonConfiguration: readNxJson(tree),
      });
      const node = nodes.projects[Object.keys(nodes.projects)[0]];

      for (const [targetName, targetConfig] of Object.entries(node.targets)) {
        const targetFromProjectConfig = projectConfig.targets[targetName];

        if (targetFromProjectConfig?.executor !== targetConfig.executor) {
          continue;
        }

        const targetFromCreateNodes = node.targets[targetName];

        removeConfigurationDefinedByPlugin(
          targetName,
          targetFromProjectConfig,
          targetFromCreateNodes,
          projectConfig
        );
      }

      updateProjectConfiguration(tree, projectName, projectConfig);
    } catch (e) {
      console.error(e);
    }
  }
}

function removeConfigurationDefinedByPlugin<T>(
  targetName: string,
  targetFromProjectConfig: TargetConfiguration<T>,
  targetFromCreateNodes: TargetConfiguration<T>,
  projectConfig: ProjectConfiguration
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
  for (const [configName, configOptions] of Object.entries(
    targetFromProjectConfig.configurations ?? {}
  )) {
    for (const [optionName, optionValue] of Object.entries(configOptions)) {
      if (
        targetFromCreateNodes.configurations?.[configName]?.[optionName] ===
        optionValue
      ) {
        delete targetFromProjectConfig.configurations[configName][optionName];
      }
    }
    if (Object.keys(configOptions).length === 0) {
      delete targetFromProjectConfig.configurations[configName];
    }
  }
  if (Object.keys(targetFromProjectConfig.configurations ?? {}).length === 0) {
    delete targetFromProjectConfig.configurations;
  }

  if (Object.keys(targetFromProjectConfig).length === 0) {
    delete projectConfig.targets[targetName];
  }
}

function equals<T extends unknown>(a: T, b: T) {
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
  arrayValuesFromCreateNodes: (object | string)[]
) {
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
