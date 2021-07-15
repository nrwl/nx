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
    executor: '@nrwl/angular:webpack-server',
  };

  if (options.mfeType === 'remote') {
    const port = options.port ?? 4200;

    appConfig.targets['mfe-serve'] = {
      executor: '@nrwl/workspace:run-commands',
      options: {
        command: `nx serve ${options.appName}`,
        port,
      },
    };
  }
  updateProjectConfiguration(host, options.appName, appConfig);
}
