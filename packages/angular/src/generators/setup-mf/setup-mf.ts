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
  setupServeTarget,
  updateHostAppRoutes,
  updateTsConfigTarget,
} from './lib';
import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import { nxVersion } from '../../utils/versions';
import { lt } from 'semver';

export async function setupMf(tree: Tree, rawOptions: Schema) {
  const installedAngularInfo = getInstalledAngularVersionInfo(tree);
  if (lt(installedAngularInfo.version, '14.1.0') && rawOptions.standalone) {
    throw new Error(
      `The --standalone flag is not supported in your current version of Angular (${installedAngularInfo.version}). Please update to a version of Angular that supports Standalone Components (>= 14.1.0).`
    );
  }

  const options = normalizeOptions(tree, rawOptions);
  const projectConfig = readProjectConfiguration(tree, options.appName);

  let installTask = () => {};
  if (options.mfType === 'remote') {
    addRemoteToHost(tree, options);
    addRemoteEntry(tree, options, projectConfig.root);
    removeDeadCodeFromRemote(tree, options);
    installTask = addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/web': nxVersion }
    );
  }

  const remotesWithPorts = getRemotesWithPorts(tree, options);

  generateWebpackConfig(tree, options, projectConfig.root, remotesWithPorts);

  changeBuildTarget(tree, options);
  updateTsConfigTarget(tree, options);
  setupServeTarget(tree, options);

  fixBootstrap(tree, projectConfig.root, options);

  if (options.mfType === 'host') {
    setupHostIfDynamic(tree, options);
    updateHostAppRoutes(tree, options);
  }

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
