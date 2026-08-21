import { createNodesFromFiles, NxPlugin } from '../src/project-graph/plugins';
import { workspaceRoot } from '../src/utils/workspace-root';
import {
  attachPackageDependencies,
  buildPackageJsonWorkspacesMatcher,
  buildPackageJsonPatterns,
  createNodeFromPackageJson,
  preloadWorkspacePackages,
} from '../src/plugins/package-json';
import { workspaceDataDirectory } from '../src/utils/cache-directory';
import { join } from 'path';
import { ProjectConfiguration } from '../src/config/workspace-json-project-json';
import { readJsonFile } from '../src/utils/fileutils';
import { PluginCache } from '../src/utils/plugin-cache-utils';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../src/utils/package-manager';

export type PackageJsonConfigurationCache = PluginCache<ProjectConfiguration>;

const cachePath = join(workspaceDataDirectory, 'package-json.hash');

let packageJsonPluginCache: PluginCache<ProjectConfiguration> | null = null;

export function readPackageJsonConfigurationCache(): PackageJsonConfigurationCache {
  packageJsonPluginCache = new PluginCache<ProjectConfiguration>(cachePath);
  return packageJsonPluginCache;
}

function writeCache() {
  if (packageJsonPluginCache) {
    packageJsonPluginCache.writeToDisk();
  }
}

const plugin: NxPlugin = {
  name: 'nx-all-package-jsons-plugin',
  createNodes: [
    '*/**/package.json',
    (configFiles, options, context) => {
      const cache = readPackageJsonConfigurationCache();

      const patterns = buildPackageJsonPatterns(context.workspaceRoot, (f) =>
        readJsonFile(join(context.workspaceRoot, f))
      );
      const isInPackageJsonWorkspaces =
        buildPackageJsonWorkspacesMatcher(patterns);

      const packageManagerCommand = getPackageManagerCommand(
        detectPackageManager(context.workspaceRoot),
        context.workspaceRoot
      );

      // Every matched package.json becomes a project here, so they all
      // participate in the workspace package-name map.
      const { packageJsonContents, getWorkspacePackageVersion } =
        preloadWorkspacePackages(
          [...configFiles],
          () => true,
          (f) => readJsonFile(join(workspaceRoot, f))
        );

      const result = createNodesFromFiles(
        (packageJsonPath) => {
          const json = packageJsonContents.get(packageJsonPath);
          return attachPackageDependencies(
            createNodeFromPackageJson(
              packageJsonPath,
              workspaceRoot,
              cache,
              isInPackageJsonWorkspaces(packageJsonPath),
              packageManagerCommand,
              json
            ),
            json,
            getWorkspacePackageVersion
          );
        },
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
