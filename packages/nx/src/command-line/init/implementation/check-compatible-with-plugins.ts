import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { bold } from 'chalk';

import { retrieveProjectConfigurations } from '../../../project-graph/utils/retrieve-workspace-files';
import {
  ExpandedPluginConfiguration,
  NxJsonConfiguration,
  PluginConfiguration,
  readNxJson,
} from '../../../config/nx-json';
import {
  LoadedNxPlugin,
  loadNxPlugins,
} from '../../../project-graph/plugins/internal-api';
import {
  isAggregateCreateNodesError,
  isMergeNodesError,
  ProjectConfigurationsError,
} from '../../../project-graph/error-types';
import { workspaceRoot } from '../../../utils/workspace-root';
import { readJsonFile, writeJsonFile } from '../../../utils/fileutils';
import { output } from '../../../utils/output';

/**
 * This function checks if the imported project is compatible with the plugins.
 * @param existingPlugins the existing plugins to check compatibility with
 * @param projectRootPathToCheck the path to the project to check
 * @returns a map of plugin names to files that are incompatible with the plugins
 */
export async function checkCompatibleWithPlugins(
  plugins: PluginConfiguration[],
  projectRootPathToCheck: string,
  root: string = workspaceRoot
): Promise<{
  [pluginName: string]: Set<string>;
}> {
  let nxPlugins: LoadedNxPlugin[] = [];
  try {
    nxPlugins = (await loadNxPlugins(plugins, root))[0];
  } catch (e) {
    // If there is an error loading the plugins, return an empty object
    return {};
  }
  let pluginNametoExcludeFiles: {
    [pluginName: string]: Set<string>;
  } = {};
  const nxJson = readNxJson(workspaceRoot);
  try {
    await retrieveProjectConfigurations(
      nxPlugins,
      projectRootPathToCheck,
      nxJson
    );
  } catch (projectConfigurationsError) {
    if (projectConfigurationsError instanceof ProjectConfigurationsError) {
      projectConfigurationsError.errors?.forEach((error) => {
        const { pluginName, excludeFiles } =
          findPluginAndFilesWithError(error) ?? {};
        if (!pluginName || !excludeFiles?.length) {
          return;
        }
        pluginNametoExcludeFiles[pluginName] ??= new Set();
        excludeFiles.forEach((file) =>
          pluginNametoExcludeFiles[pluginName].add(file)
        );
      });
    }
  }
  return pluginNametoExcludeFiles;
}

/**
 * This function finds the plugin name and files that caused the error.
 * @param error the error to find the plugin name and files for
 * @returns pluginName and excludeFiles if found, otherwise undefined
 */
function findPluginAndFilesWithError(
  error: any
): { pluginName: string; excludeFiles: string[] } | undefined {
  let pluginName: string | undefined;
  let excludeFiles: string[] = [];
  if (isAggregateCreateNodesError(error)) {
    pluginName = error.pluginName;
    excludeFiles = error.errors?.map((error) => error?.[0]) ?? [];
  } else if (isMergeNodesError(error)) {
    pluginName = error.pluginName;
    excludeFiles = [error.file];
  }
  excludeFiles = excludeFiles.filter(Boolean);
  if (!pluginName || !excludeFiles.length) {
    return;
  }
  return {
    pluginName,
    excludeFiles,
  };
}

/**
 * This function finds the plugin with the given name.
 * It will modify the plugins array if the plugin is found as a string.
 * @param plugins a list of plugins to search
 * @param pluginName
 * @returns plugin in object type with the given name if found, otherwise undefined
 */
function findPluginWithName(
  plugins: PluginConfiguration[],
  pluginName: string
): ExpandedPluginConfiguration | undefined {
  const foundIndex = plugins.findIndex((plugin) => {
    if (typeof plugin === 'string') {
      if (plugin === pluginName) {
        return true;
      }
    } else {
      return plugin.plugin === pluginName;
    }
  });
  let foundPlugin = foundIndex >= 0 ? plugins[foundIndex] : undefined;
  if (typeof foundPlugin === 'string') {
    // If the plugin is found as a string, convert it to an object
    foundPlugin = { plugin: pluginName };
    plugins[foundIndex] = foundPlugin;
  }
  return foundPlugin;
}

/**
 * This function updates the plugins in the nx.json file with the given plugin names and files to exclude.
 */
export function updatePluginsInNxJson(
  root: string = workspaceRoot,
  pluginNametoExcludeFiles: {
    [pluginName: string]: Set<string>;
  }
): void {
  const nxJsonPath = join(root, 'nx.json');
  if (!existsSync(nxJsonPath)) {
    return;
  }
  let nxJson: NxJsonConfiguration;
  try {
    nxJson = readJsonFile<NxJsonConfiguration>(nxJsonPath);
  } catch {
    // If there is an error reading the nx.json file, no need to update it
    return;
  }
  if (
    !Object.keys(pluginNametoExcludeFiles)?.length ||
    !nxJson?.plugins?.length
  ) {
    return;
  }
  Object.entries(pluginNametoExcludeFiles).forEach(
    ([pluginName, excludeFiles]) => {
      const plugin = findPluginWithName(nxJson.plugins ?? [], pluginName);
      if (!plugin || excludeFiles.size === 0) {
        return;
      }
      output.warn({
        title: `Incompatible projects found for ${pluginName}`,
        bodyLines: [
          `Added the following files to the exclude list for ${pluginName}:`,
          ...Array.from(excludeFiles).map((file) => `  - ${bold(file)}`),
        ],
      });

      (plugin.exclude ?? []).forEach((e) => excludeFiles.add(e));
      plugin.exclude = Array.from(excludeFiles);
    }
  );
  writeJsonFile(nxJsonPath, nxJson);
}
