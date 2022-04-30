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

  if (options.mfeType === 'remote') {
    appConfig.targets['serve-static'] = {
      executor: '@nrwl/angular:file-server',
      defaultConfiguration: 'development',
      options: {
        buildTarget: `${options.appName}:build`,
        port: options.port,
      },
      configurations: {
        development: {
          buildTarget: `${options.appName}:build:development`,
        },
        production: {
          buildTarget: `${options.appName}:build:production`,
        },
      },
    };
  }

  updateProjectConfiguration(host, options.appName, appConfig);
}
