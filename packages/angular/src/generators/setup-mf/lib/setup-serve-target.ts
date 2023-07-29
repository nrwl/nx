import type { Tree } from '@nx/devkit';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { Schema } from '../schema';

export function setupServeTarget(host: Tree, options: Schema) {
  const appConfig = readProjectConfiguration(host, options.appName);

  appConfig.targets['serve'] = {
    ...appConfig.targets['serve'],
    executor:
      options.mfType === 'host'
        ? '@nx/angular:module-federation-dev-server'
        : '@nx/angular:webpack-dev-server',
    options: {
      ...appConfig.targets['serve'].options,
      port: options.port ?? undefined,
      publicHost: `http://localhost:${options.port ?? 4200}`,
    },
  };

  if (options.mfType === 'remote') {
    appConfig.targets['serve-static'] = {
      executor: '@nx/web:file-server',
      defaultConfiguration: 'development',
      options: {
        buildTarget: `${options.appName}:build`,
        port: options.port,
        watch: false,
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
