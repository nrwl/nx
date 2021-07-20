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

  if (options.mfeType === 'host') {
    appConfig.targets['mfe-serve'] = {
      executor: '@nrwl/workspace:run-commands',
      options: {
        commands: [`nx serve ${options.appName}"`],
      },
    };
  }
  updateProjectConfiguration(host, options.appName, appConfig);
}
