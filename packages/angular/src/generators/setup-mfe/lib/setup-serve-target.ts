import type { Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';

import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export function setupServeTarget(host: Tree, options: Schema) {
  const appConfig = readProjectConfiguration(host, options.appName);

  appConfig.targets['serve'] = {
    ...appConfig.targets['serve'],
    executor:
      options.mfeType === 'host'
        ? '@nrwl/angular:module-federation-dev-server'
        : '@nrwl/angular:webpack-server',
    options: {
      ...appConfig.targets['serve'].options,
      port: options.port ?? undefined,
      publicHost: `http://localhost:${options.port ?? 4200}`,
    },
  };

  updateProjectConfiguration(host, options.appName, appConfig);
}
