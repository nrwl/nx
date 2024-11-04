import type { Tree } from '@nx/devkit';
import type { Schema } from '../schema';

import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';

export function changeBuildTarget(host: Tree, options: Schema) {
  const appConfig = readProjectConfiguration(host, options.appName);

  const configExtName = options.typescriptConfiguration ? 'ts' : 'js';

  appConfig.targets.build.executor = '@nx/angular:webpack-browser';
  appConfig.targets.build.options = {
    ...appConfig.targets.build.options,
    customWebpackConfig: {
      path: `${appConfig.root}/webpack.config.${configExtName}`,
    },
  };

  appConfig.targets.build.configurations.production = {
    ...appConfig.targets.build.configurations.production,
    customWebpackConfig: {
      path: `${appConfig.root}/webpack.prod.config.${configExtName}`,
    },
  };

  updateProjectConfiguration(host, options.appName, appConfig);

  addBuildTargetDefaults(host, '@nx/angular:webpack-browser');
}
