import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { bold } from 'chalk';

import { NxJsonConfiguration } from '../../../config/nx-json';
import {
  isAggregateCreateNodesError,
  isMergeNodesError,
  isProjectsWithNoNameError,
  ProjectGraphError,
} from '../../../project-graph/error-types';
import { workspaceRoot } from '../../../utils/workspace-root';
import { readJsonFile, writeJsonFile } from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import { createProjectGraphAsync } from '../../../project-graph/project-graph';

export interface IncompatibleFiles {
  [pluginIndex: number]: { file: string; error?: any }[];
}

/**
 * This function checks if the imported project is compatible with the plugins.
 * @returns a map of plugin names to files that are incompatible with the plugins
 */
export async function checkCompatibleWithPlugins(): Promise<IncompatibleFiles> {
  let pluginToExcludeFiles: IncompatibleFiles = {};
  try {
    await createProjectGraphAsync();
  } catch (projectGraphError) {
    if (projectGraphError instanceof ProjectGraphError) {
      projectGraphError.getErrors()?.forEach((error) => {
        const { pluginIndex, excludeFiles } =
          findPluginAndFilesWithError(error) ?? {};
        if (pluginIndex !== undefined && excludeFiles?.length) {
          pluginToExcludeFiles[pluginIndex] ??= [];
          pluginToExcludeFiles[pluginIndex].push(...excludeFiles);
        } else if (!isProjectsWithNoNameError(error)) {
          // print error if it is not ProjectsWithNoNameError and unable to exclude files
          output.error({
            title: error.message,
            bodyLines: error.stack?.split('\n'),
          });
        }
      });
    } else {
      output.error({
        title:
          'Failed to process project graph. Run "nx reset" to fix this. Please report the issue if you keep seeing it.',
        bodyLines: projectGraphError.stack?.split('\n'),
      });
    }
  }
  return pluginToExcludeFiles;
}

/**
 * This function finds the plugin name and files that caused the error.
 * @param error the error to find the plugin name and files for
 * @returns pluginName and excludeFiles if found, otherwise undefined
 */
function findPluginAndFilesWithError(
  error: any
):
  | { pluginIndex: number; excludeFiles: { file: string; error?: any }[] }
  | undefined {
  let pluginIndex: number | undefined;
  let excludeFiles: { file: string; error?: any }[] = [];
  if (isAggregateCreateNodesError(error)) {
    pluginIndex = error.pluginIndex;
    excludeFiles =
      error.errors?.map((error) => {
        return {
          file: error?.[0],
          error: error?.[1],
        };
      }) ?? [];
  } else if (isMergeNodesError(error)) {
    pluginIndex = error.pluginIndex;
    excludeFiles = [
      {
        file: error.file,
        error: error,
      },
    ];
  }
  excludeFiles = excludeFiles.filter(Boolean).map((excludeFile) => {
    const file = excludeFile.file;
    excludeFile.file = file.startsWith(workspaceRoot)
      ? relative(workspaceRoot, file)
      : file;
    return excludeFile;
  });
  return {
    pluginIndex,
    excludeFiles,
  };
}

/**
 * This function updates the plugins in the nx.json file with the given plugin names and files to exclude.
 */
export function updatePluginsInNxJson(
  root: string = workspaceRoot,
  pluginToExcludeFiles: IncompatibleFiles
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
  if (!Object.keys(pluginToExcludeFiles)?.length || !nxJson?.plugins?.length) {
    return;
  }
  Object.entries(pluginToExcludeFiles).forEach(
    ([pluginIndex, excludeFiles]) => {
      let plugin = nxJson.plugins[pluginIndex];
      if (!plugin || excludeFiles.length === 0) {
        return;
      }
      if (typeof plugin === 'string') {
        plugin = { plugin };
      }
      output.warn({
        title: `The following files were incompatible with ${plugin.plugin} and has been excluded for now:`,
        bodyLines: excludeFiles
          .map((file: { file: string; error?: any }) => {
            const output = [`  - ${bold(file.file)}`];
            if (file.error?.message) {
              output.push(`    ${file.error.message}`);
            }
            return output;
          })
          .flat(),
      });

      const excludes = new Set(plugin.exclude ?? []);
      excludeFiles.forEach((file) => {
        excludes.add(file.file);
      });
      plugin.exclude = Array.from(excludes);
      nxJson.plugins[pluginIndex] = plugin;
    }
  );
  writeJsonFile(nxJsonPath, nxJson);
}
