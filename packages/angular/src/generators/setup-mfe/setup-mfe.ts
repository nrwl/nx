import type { Tree } from '@nrwl/devkit';
import type { Schema } from './schema';

import {
  readProjectConfiguration,
  addDependenciesToPackageJson,
  formatFiles,
} from '@nrwl/devkit';

import {
  addImplicitDeps,
  changeWorkspaceTargets,
  fixBootstrap,
  generateWebpackConfig,
  getRemotesWithPorts,
  setupServeTarget,
} from './lib';
import { nxVersion } from '../../utils/versions';

export async function setupMfe(host: Tree, options: Schema) {
  const projectConfig = readProjectConfiguration(host, options.appName);

  const remotesWithPorts = getRemotesWithPorts(host, options);

  generateWebpackConfig(host, options, projectConfig.root, remotesWithPorts);

  addImplicitDeps(host, options);
  changeWorkspaceTargets(host, options);
  setupServeTarget(host, options);

  fixBootstrap(host, projectConfig.root);

  // add package to install
  const installPackages = addDependenciesToPackageJson(
    host,
    {
      '@angular-architects/module-federation': '^12.2.0',
      '@nrwl/web': nxVersion,
    },
    {}
  );

  // format files
  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return installPackages;
}

export default setupMfe;
