import type { Tree } from '@nrwl/devkit';
import { formatFiles, readProjectConfiguration } from '@nrwl/devkit';
import type { Schema } from './schema';

import {
  addCypressOnErrorWorkaround,
  addEntryModule,
  addRemoteToHost,
  changeBuildTarget,
  fixBootstrap,
  generateWebpackConfig,
  getRemotesWithPorts,
  setupHostIfDynamic,
  setupServeTarget,
  updateTsConfigTarget,
} from './lib';

export async function setupMf(tree: Tree, options: Schema) {
  const projectConfig = readProjectConfiguration(tree, options.appName);

  options.federationType = options.federationType ?? 'static';

  setupHostIfDynamic(tree, options);

  const remotesWithPorts = getRemotesWithPorts(tree, options);
  addRemoteToHost(tree, options);

  generateWebpackConfig(tree, options, projectConfig.root, remotesWithPorts);

  addEntryModule(tree, options, projectConfig.root);
  changeBuildTarget(tree, options);
  updateTsConfigTarget(tree, options);
  setupServeTarget(tree, options);

  fixBootstrap(tree, projectConfig.root, options);

  addCypressOnErrorWorkaround(tree, options);

  // format files
  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default setupMf;
