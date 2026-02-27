import { createNodesFromFiles, NxPluginV2 } from '../src/project-graph/plugins';
import { workspaceRoot } from '../src/utils/workspace-root';
import {
  buildPackageJsonWorkspacesMatcher,
  buildPackageJsonPatterns,
  createNodeFromPackageJson,
} from '../src/plugins/package-json';
import { workspaceDataDirectory } from '../src/utils/cache-directory';
import { join } from 'path';
import { ProjectConfiguration } from '../src/config/workspace-json-project-json';
import { readJsonFile } from '../src/utils/fileutils';
import { PluginCache, readPluginCache } from '../src/utils/plugin-cache-utils';

export type PackageJsonConfigurationCache = PluginCache<ProjectConfiguration>;

const cachePath = join(workspaceDataDirectory, 'package-json.hash');

let packageJsonPluginCache: PluginCache<ProjectConfiguration> | null = null;

export function readPackageJsonConfigurationCache(): PackageJsonConfigurationCache {
  packageJsonPluginCache = readPluginCache<ProjectConfiguration>(cachePath);
  return packageJsonPluginCache;
}

function writeCache() {
  if (packageJsonPluginCache) {
    packageJsonPluginCache.writeToDisk(cachePath);
  }
}

const plugin: NxPluginV2 = {
  name: 'nx-all-package-jsons-plugin',
  createNodesV2: [
    '*/**/package.json',
    (configFiles, options, context) => {
      const cache = readPackageJsonConfigurationCache();

      const patterns = buildPackageJsonPatterns(context.workspaceRoot, (f) =>
        readJsonFile(join(context.workspaceRoot, f))
      );
      const isInPackageJsonWorkspaces =
        buildPackageJsonWorkspacesMatcher(patterns);

      const result = createNodesFromFiles(
        (packageJsonPath) =>
          createNodeFromPackageJson(
            packageJsonPath,
            workspaceRoot,
            cache,
            isInPackageJsonWorkspaces(packageJsonPath)
          ),
        configFiles,
        options,
        context
      );

      writeCache();

      return result;
    },
  ],
};

module.exports = plugin;
module.exports.readPackageJsonConfigurationCache =
  readPackageJsonConfigurationCache;
