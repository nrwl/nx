import type { Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';

import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export function changeBuildTarget(host: Tree, options: Schema) {
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

  updateProjectConfiguration(host, options.appName, appConfig);
}
