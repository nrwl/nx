import type { PackageJson } from 'nx/src/utils/package-json';

import type { ConfigurationResult } from 'nx/src/project-graph/utils/project-configuration-utils';
import * as yargs from 'yargs-parser';

import {
  CreateNodes,
  CreateNodesV2,
  ProjectConfiguration,
  ProjectGraph,
  readJson,
  readNxJson,
  Tree,
  updateNxJson,
  writeJson,
} from 'nx/src/devkit-exports';
import {
  LoadedNxPlugin,
  ProjectConfigurationsError,
  retrieveProjectConfigurations,
} from 'nx/src/devkit-internals';

/**
 * Iterates through various forms of plugin options to find the one which does not conflict with the current graph

 */
export async function addPlugin<PluginOptions>(
  tree: Tree,
  graph: ProjectGraph,
  pluginName: string,
  createNodesTuple: CreateNodesV2<PluginOptions>,
  options: Partial<
    Record<keyof PluginOptions, PluginOptions[keyof PluginOptions][]>
  >,
  shouldUpdatePackageJsonScripts: boolean
): Promise<void> {
  return _addPluginInternal(
    tree,
    graph,
    pluginName,
    (pluginOptions) =>
      new LoadedNxPlugin(
        {
          name: pluginName,
          createNodesV2: createNodesTuple,
        },
        {
          plugin: pluginName,
          options: pluginOptions,
        }
      ),
    options,
    shouldUpdatePackageJsonScripts
  );
}

/**
 * @deprecated Use `addPlugin` instead
 * Iterates through various forms of plugin options to find the one which does not conflict with the current graph

 */
export async function addPluginV1<PluginOptions>(
  tree: Tree,
  graph: ProjectGraph,
  pluginName: string,
  createNodesTuple: CreateNodes<PluginOptions>,
  options: Partial<
    Record<keyof PluginOptions, PluginOptions[keyof PluginOptions][]>
  >,
  shouldUpdatePackageJsonScripts: boolean
): Promise<void> {
  return _addPluginInternal(
    tree,
    graph,
    pluginName,
    (pluginOptions) =>
      new LoadedNxPlugin(
        {
          name: pluginName,
          createNodes: createNodesTuple,
        },
        {
          plugin: pluginName,
          options: pluginOptions,
        }
      ),
    options,
    shouldUpdatePackageJsonScripts
  );
}

async function _addPluginInternal<PluginOptions>(
  tree: Tree,
  graph: ProjectGraph,
  pluginName: string,
  pluginFactory: (pluginOptions: PluginOptions) => LoadedNxPlugin,
  options: Partial<
    Record<keyof PluginOptions, PluginOptions[keyof PluginOptions][]>
  >,
  shouldUpdatePackageJsonScripts: boolean
) {
  const graphNodes = Object.values(graph.nodes);
  const nxJson = readNxJson(tree);

  let pluginOptions: PluginOptions;
  let projConfigs: ConfigurationResult;
  const combinations = generateCombinations(options);
  optionsLoop: for (const _pluginOptions of combinations) {
    pluginOptions = _pluginOptions as PluginOptions;

    nxJson.plugins ??= [];
    if (
      nxJson.plugins.some((p) =>
        typeof p === 'string'
          ? p === pluginName
          : p.plugin === pluginName && !p.include
      )
    ) {
      // Plugin has already been added
      return;
    }
    global.NX_GRAPH_CREATION = true;
    try {
      projConfigs = await retrieveProjectConfigurations(
        [pluginFactory(pluginOptions)],
        tree.root,
        nxJson
      );
    } catch (e) {
      // Errors are okay for this because we're only running 1 plugin
      if (e instanceof ProjectConfigurationsError) {
        projConfigs = e.partialProjectConfigurationsResult;
      } else {
        throw e;
      }
    }
    global.NX_GRAPH_CREATION = false;

    for (const projConfig of Object.values(projConfigs.projects)) {
      const node = graphNodes.find(
        (node) => node.data.root === projConfig.root
      );

      if (!node) {
        continue;
      }

      for (const targetName in projConfig.targets) {
        if (node.data.targets[targetName]) {
          // Conflicting Target Name, check the next one
          pluginOptions = null;
          continue optionsLoop;
        }
      }
    }

    break;
  }

  if (!pluginOptions) {
    throw new Error(
      'Could not add the plugin in a way which does not conflict with existing targets. Please report this error at: https://github.com/nrwl/nx/issues/new/choose'
    );
  }

  nxJson.plugins.push({
    plugin: pluginName,
    options: pluginOptions,
  });

  updateNxJson(tree, nxJson);

  if (shouldUpdatePackageJsonScripts) {
    updatePackageScripts(tree, projConfigs);
  }
}

type TargetCommand = {
  command: string;
  target: string;
  configuration?: string;
};

function updatePackageScripts(
  tree: Tree,
  projectConfigurations: ConfigurationResult
) {
  for (const projectConfig of Object.values(projectConfigurations.projects)) {
    const projectRoot = projectConfig.root;
    processProject(tree, projectRoot, projectConfig);
  }
}

function processProject(
  tree: Tree,
  projectRoot: string,
  projectConfiguration: ProjectConfiguration
) {
  const packageJsonPath = `${projectRoot}/package.json`;
  if (!tree.exists(packageJsonPath)) {
    return;
  }
  const packageJson = readJson<PackageJson>(tree, packageJsonPath);
  if (!packageJson.scripts || !Object.keys(packageJson.scripts).length) {
    return;
  }

  const targetCommands = getInferredTargetCommands(projectConfiguration);
  if (!targetCommands.length) {
    return;
  }

  const replacedTargets = new Set<string>();
  for (const targetCommand of targetCommands) {
    const { command, target, configuration } = targetCommand;
    const targetCommandRegex = new RegExp(
      `(?<=^|&)((?: )*(?:[^&\\r\\n\\s]+ )*)(${command})((?: [^&\\r\\n\\s]+)*(?: )*)(?=$|&)`,
      'g'
    );
    for (const scriptName of Object.keys(packageJson.scripts)) {
      const script = packageJson.scripts[scriptName];
      // quick check for exact match within the script
      if (targetCommandRegex.test(script)) {
        packageJson.scripts[scriptName] = script.replace(
          targetCommandRegex,
          configuration
            ? `$1nx ${target} --configuration=${configuration}$3`
            : `$1nx ${target}$3`
        );
        replacedTargets.add(target);
      } else {
        /**
         * Parse script and command to handle the following:
         * - if command doesn't match script                  => don't replace
         * - if command has more args                         => don't replace
         * - if command has same args, regardless of order    => replace removing args
         * - if command has less args or with different value => replace leaving args
         */
        const parsedCommand = yargs(command, {
          configuration: { 'strip-dashed': true },
        });

        // this assumes there are no positional args in the command, everything is a command or subcommand
        const commandCommand = parsedCommand._.join(' ');
        const commandRegex = new RegExp(
          `(?<=^|&)((?: )*(?:[^&\\r\\n\\s]+ )*)(${commandCommand})((?: [^&\\r\\n\\s]+)*( )*)(?=$|&)`,
          'g'
        );
        const matches = script.match(commandRegex);
        if (!matches) {
          // the command doesn't match the script, don't replace
          continue;
        }

        for (const match of matches) {
          // parse the matched command within the script
          const parsedScript = yargs(match, {
            configuration: { 'strip-dashed': true },
          });

          let hasArgsWithDifferentValues = false;
          let scriptHasExtraArgs = false;
          let commandHasExtraArgs = false;
          for (const [key, value] of Object.entries(parsedCommand)) {
            if (key === '_') {
              continue;
            }

            if (parsedScript[key] === undefined) {
              commandHasExtraArgs = true;
              break;
            }
            if (parsedScript[key] !== value) {
              hasArgsWithDifferentValues = true;
            }
          }

          if (commandHasExtraArgs) {
            // the command has extra args, don't replace
            continue;
          }

          for (const key of Object.keys(parsedScript)) {
            if (key === '_') {
              continue;
            }

            if (!parsedCommand[key]) {
              scriptHasExtraArgs = true;
              break;
            }
          }

          if (!hasArgsWithDifferentValues && !scriptHasExtraArgs) {
            // they are the same, replace with the command removing the args
            packageJson.scripts[scriptName] = packageJson.scripts[
              scriptName
            ].replace(
              match,
              match.replace(
                commandRegex,
                configuration
                  ? `$1nx ${target} --configuration=${configuration}$4`
                  : `$1nx ${target}$4`
              )
            );
            replacedTargets.add(target);
          } else {
            // there are different args or the script has extra args, replace with the command leaving the args
            packageJson.scripts[scriptName] = packageJson.scripts[
              scriptName
            ].replace(
              match,
              match.replace(
                commandRegex,
                configuration
                  ? `$1nx ${target} --configuration=${configuration}$3`
                  : `$1nx ${target}$3`
              )
            );
            replacedTargets.add(target);
          }
        }
      }
    }
  }

  writeJson(tree, packageJsonPath, packageJson);
}

function getInferredTargetCommands(
  project: ProjectConfiguration
): TargetCommand[] {
  const targetCommands: TargetCommand[] = [];

  for (const [targetName, target] of Object.entries(project.targets ?? {})) {
    if (target.command) {
      targetCommands.push({ command: target.command, target: targetName });
    } else if (
      target.executor === 'nx:run-commands' &&
      target.options?.command
    ) {
      targetCommands.push({
        command: target.options.command,
        target: targetName,
      });
    }

    if (!target.configurations) {
      continue;
    }

    for (const [configurationName, configuration] of Object.entries(
      target.configurations
    )) {
      if (configuration.command) {
        targetCommands.push({
          command: configuration.command,
          target: targetName,
          configuration: configurationName,
        });
      } else if (
        target.executor === 'nx:run-commands' &&
        configuration.options?.command
      ) {
        targetCommands.push({
          command: configuration.options.command,
          target: targetName,
          configuration: configurationName,
        });
      }
    }
  }

  return targetCommands;
}

export function generateCombinations<T>(
  input: Record<string, T[]>
): Record<string, T>[] {
  // This is reversed so that combinations have the first defined property updated first
  const keys = Object.keys(input).reverse();
  return _generateCombinations(Object.values(input).reverse()).map(
    (combination) => {
      const result = {};
      combination.reverse().forEach((combo, i) => {
        result[keys[keys.length - i - 1]] = combo;
      });

      return result;
    }
  );
}

/**
 * Generate all possible combinations of a 2-dimensional array.
 *
 * Useful for generating all possible combinations of options for a plugin
 */
function _generateCombinations<T>(input: T[][]): T[][] {
  if (input.length === 0) {
    return [[]];
  } else {
    const [first, ...rest] = input;
    const partialCombinations = _generateCombinations(rest);
    return first.flatMap((value) =>
      partialCombinations.map((combination) => [value, ...combination])
    );
  }
}
