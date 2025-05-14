import { createNodesFromFiles, NxPluginV2 } from '../src/project-graph/plugins';
import { workspaceRoot } from '../src/utils/workspace-root';
import {
  buildPackageJsonWorkspacesMatcher,
  createNodeFromPackageJson,
} from '../src/plugins/package-json';
import { workspaceDataDirectory } from '../src/utils/cache-directory';
import { join } from 'path';
import { ProjectConfiguration } from '../src/config/workspace-json-project-json';
import { readJsonFile, writeJsonFile } from '../src/utils/fileutils';

export type PackageJsonConfigurationCache = {
  [hash: string]: ProjectConfiguration;
};

const cachePath = join(workspaceDataDirectory, 'package-json.hash');

export function readPackageJsonConfigurationCache() {
  try {
    return readJsonFile<PackageJsonConfigurationCache>(cachePath);
  } catch (e) {
    return {};
  }
}

function writeCache(cache: PackageJsonConfigurationCache) {
  writeJsonFile(cachePath, cache);
}

const plugin: NxPluginV2 = {
  name: 'nx-all-package-jsons-plugin',
  createNodesV2: [
    '*/**/package.json',
    (configFiles, options, context) => {
      const cache = readPackageJsonConfigurationCache();

      const isInPackageJsonWorkspaces = buildPackageJsonWorkspacesMatcher(
        context.workspaceRoot,
        (f) => readJsonFile(join(context.workspaceRoot, f))
      );

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

      writeCache(cache);

      return result;
    },
  ],
};

module.exports = plugin;
module.exports.readPackageJsonConfigurationCache =
  readPackageJsonConfigurationCache;
