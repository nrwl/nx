import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  readProjectConfiguration,
} from '@nx/devkit';
import type { Schema } from './schema';

import {
  addCypressOnErrorWorkaround,
  addRemoteEntry,
  addRemoteToHost,
  changeBuildTarget,
  fixBootstrap,
  generateWebpackConfig,
  getRemotesWithPorts,
  normalizeOptions,
  removeDeadCodeFromRemote,
  setupHostIfDynamic,
  setupTspathForRemote,
  setupServeTarget,
  updateHostAppRoutes,
  updateTsConfig,
} from './lib';
import { nxVersion } from '../../utils/versions';

export async function setupMf(tree: Tree, rawOptions: Schema) {
  const options = normalizeOptions(tree, rawOptions);
  const projectConfig = readProjectConfiguration(tree, options.appName);

  let installTask = () => {};
  if (options.mfType === 'remote') {
    addRemoteToHost(tree, {
      appName: options.appName,
      host: options.host,
      standalone: options.standalone,
      port: options.port,
    });
    addRemoteEntry(tree, options, projectConfig.root);
    removeDeadCodeFromRemote(tree, options);
    setupTspathForRemote(tree, options);
    if (!options.skipPackageJson) {
      installTask = addDependenciesToPackageJson(
        tree,
        {},
        { '@nx/web': nxVersion, '@nx/webpack': nxVersion }
      );
    }
  }

  const remotesWithPorts = getRemotesWithPorts(tree, options);

  generateWebpackConfig(tree, options, projectConfig.root, remotesWithPorts);

  changeBuildTarget(tree, options);
  updateTsConfig(tree, options);
  setupServeTarget(tree, options);

  if (options.mfType === 'host') {
    setupHostIfDynamic(tree, options);
    updateHostAppRoutes(tree, options);
    for (const { remoteName, port } of remotesWithPorts) {
      addRemoteToHost(tree, {
        appName: remoteName,
        host: options.appName,
        standalone: options.standalone,
        port,
      });
    }
    if (!options.skipPackageJson) {
      installTask = addDependenciesToPackageJson(
        tree,
        {},
        { '@nx/webpack': nxVersion }
      );
    }
  }

  fixBootstrap(tree, projectConfig.root, options);

  if (!options.skipE2E) {
    addCypressOnErrorWorkaround(tree, options);
  }

  // format files
  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default setupMf;
