import type { Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';

import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export function changeWorkspaceTargets(host: Tree, options: Schema) {
  const appConfig = readProjectConfiguration(host, options.appName);

  appConfig.targets.build.executor = '@nrwl/angular:webpack-browser';
  appConfig.targets.build.options = {
    ...appConfig.targets.build.options,
    customWebpackConfig: {
      path: `${appConfig.root}/webpack.config.js`,
    },
  };

  appConfig.targets.build.configurations.production = {
    ...appConfig.targets.build.configurations.production,
    customWebpackConfig: {
      path: `${appConfig.root}/webpack.prod.config.js`,
    },
  };

  appConfig.targets.serve.executor = '@nrwl/web:file-server';
  appConfig.targets.serve.configurations = {
    production: {
      buildTarget:
        appConfig.targets.serve.configurations.production.browserTarget,
    },
    development: {
      buildTarget:
        appConfig.targets.serve.configurations.development.browserTarget,
    },
  };

  updateProjectConfiguration(host, options.appName, appConfig);
}
