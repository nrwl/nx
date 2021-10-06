import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';

import {
  readProjectConfiguration,
  addDependenciesToPackageJson,
  formatFiles,
} from '@nrwl/devkit';

import {
  addEntryModule,
  addImplicitDeps,
  addRemoteToHost,
  changeBuildTarget,
  fixBootstrap,
  generateWebpackConfig,
  getRemotesWithPorts,
  setupServeTarget,
} from './lib';

export async function setupMfe(host: Tree, options: Schema) {
  const projectConfig = readProjectConfiguration(host, options.appName);

  const remotesWithPorts = getRemotesWithPorts(host, options);
  addRemoteToHost(host, options);

  generateWebpackConfig(host, options, projectConfig.root, remotesWithPorts);

  addEntryModule(host, options, projectConfig.root);
  addImplicitDeps(host, options);
  changeBuildTarget(host, options);
  setupServeTarget(host, options);

  fixBootstrap(host, projectConfig.root);

  // add package to install
  const installPackages = addDependenciesToPackageJson(
    host,
    { '@angular-architects/module-federation': '^12.5.3' },
    {}
  );

  // format files
  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return installPackages;
}

export default setupMfe;
