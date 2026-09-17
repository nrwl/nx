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
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../src/utils/package-manager';
import {
  PackageJsonConfigurationCache,
  readPackageJsonConfigurationCache,
} from '../src/plugins/package-json/cache';

export type { PackageJsonConfigurationCache };
export { readPackageJsonConfigurationCache };

const plugin: NxPlugin = {
  name: 'nx-all-package-jsons-plugin',
  createNodes: [
    '*/**/package.json',
    async (configFiles, options, context) => {
      const cache = readPackageJsonConfigurationCache('all-package-jsons.hash');

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

module.exports = plugin;
module.exports.readPackageJsonConfigurationCache =
  readPackageJsonConfigurationCache;
