import type { Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';

import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export function addImplicitDeps(host: Tree, options: Schema) {
  if (
    options.mfeType === 'host' &&
    Array.isArray(options.remotes) &&
    options.remotes.length > 0
  ) {
    const appConfig = readProjectConfiguration(host, options.appName);
    appConfig.implicitDependencies = Array.isArray(
      appConfig.implicitDependencies
    )
      ? [...appConfig.implicitDependencies, ...options.remotes]
      : [...options.remotes];
    updateProjectConfiguration(host, options.appName, appConfig);
  }
}
