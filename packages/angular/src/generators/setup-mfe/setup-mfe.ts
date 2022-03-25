import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';

import { readProjectConfiguration, formatFiles } from '@nrwl/devkit';

import {
  addCypressOnErrorWorkaround,
  addEntryModule,
  addImplicitDeps,
  addRemoteToHost,
  changeBuildTarget,
  fixBootstrap,
  generateWebpackConfig,
  getRemotesWithPorts,
  setupServeTarget,
  updateTsConfigTarget,
} from './lib';

export async function setupMfe(host: Tree, options: Schema) {
  const projectConfig = readProjectConfiguration(host, options.appName);

  const remotesWithPorts = getRemotesWithPorts(host, options);
  addRemoteToHost(host, options);

  generateWebpackConfig(host, options, projectConfig.root, remotesWithPorts);

  addEntryModule(host, options, projectConfig.root);
  addImplicitDeps(host, options);
  changeBuildTarget(host, options);
  updateTsConfigTarget(host, options);
  setupServeTarget(host, options);

  fixBootstrap(host, projectConfig.root);

  addCypressOnErrorWorkaround(host, options);

  // format files
  if (!options.skipFormat) {
    await formatFiles(host);
  }
}

export default setupMfe;
