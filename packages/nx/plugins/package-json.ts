import { createNodesFromFiles, NxPlugin } from '../src/project-graph/plugins';
import {
  buildPackageJsonWorkspacesMatcher,
  buildPackageJsonPatterns,
  createSharedPackageJsonInputs,
  createNodeFromPackageJson,
  getPackageJsonConfigurationHashes,
} from '../src/plugins/package-json';
import { join } from 'node:path';
import { readJsonFile } from '../src/utils/fileutils';
import type { ProjectConfiguration } from '../src/config/workspace-json-project-json';
import { workspaceDataDirectory } from '../src/utils/cache-directory';
import { PluginCache, readPluginCache } from '../src/utils/plugin-cache-utils';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../src/utils/package-manager';
import {
  type CachedPackageJsonProject,
  readPackageJsonConfigurationCache as readInferenceCache,
} from '../src/plugins/package-json/cache';

export type PackageJsonConfigurationCache = PluginCache<ProjectConfiguration>;

const cacheFileName = 'all-package-jsons.hash';

export function readPackageJsonConfigurationCache(): PackageJsonConfigurationCache {
  const cachePath = join(workspaceDataDirectory, cacheFileName);
  const { entries, accessOrder } = readPluginCache<
    CachedPackageJsonProject | ProjectConfiguration
  >(cachePath);
  const projects: Record<string, ProjectConfiguration> = {};
  for (const key of Object.keys(entries)) {
    const entry = entries[key];
    projects[key] = 'root' in entry ? entry : entry.project;
  }
  return new PluginCache(cachePath, projects, accessOrder);
}

const plugin: NxPlugin = {
  name: 'nx-all-package-jsons-plugin',
  createNodes: [
    '*/**/package.json',
    async (configFiles, options, context) => {
      const cache = readInferenceCache(cacheFileName);

      const patterns = buildPackageJsonPatterns(context.workspaceRoot, (f) =>
        readJsonFile(join(context.workspaceRoot, f))
      );
      const isInPackageJsonWorkspaces =
        buildPackageJsonWorkspacesMatcher(patterns);

      const packageManagerCommand = getPackageManagerCommand(
        detectPackageManager(context.workspaceRoot),
        context.workspaceRoot
      );
      const sharedInputs = createSharedPackageJsonInputs(
        context.nxJsonConfiguration,
        packageManagerCommand
      );
      const configurationHashes = await getPackageJsonConfigurationHashes(
        context.workspaceRoot,
        configFiles
      );

      const result = await createNodesFromFiles(
        (packageJsonPath, _, __, index) =>
          createNodeFromPackageJson(
            packageJsonPath,
            context.workspaceRoot,
            cache,
            isInPackageJsonWorkspaces(packageJsonPath),
            sharedInputs,
            configurationHashes[index]
          ),
        configFiles,
        options,
        context
      );

      cache.writeToDiskIfChanged();

      return result;
    },
  ],
};

export const createNodes = plugin.createNodes;

module.exports = plugin;
module.exports.readPackageJsonConfigurationCache =
  readPackageJsonConfigurationCache;
