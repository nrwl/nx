import { Tree } from 'nx/src/shared/tree';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export function updateMfeProject(
  host: Tree,
  options: { name: string; appProjectRoot: string; devServerPort?: number }
) {
  let projectConfig = readProjectConfiguration(host, options.name);
  projectConfig.targets.build.options = {
    ...projectConfig.targets.build.options,
    main: `${options.appProjectRoot}/src/main.ts`,
    webpackConfig: `${options.appProjectRoot}/webpack.config.js`,
  };
  projectConfig.targets.build.configurations.production = {
    ...projectConfig.targets.build.configurations.production,
    webpackConfig: `${options.appProjectRoot}/webpack.config.prod.js`,
  };
  projectConfig.targets.serve.executor = '@nrwl/react:mfe-dev-server';
  projectConfig.targets.serve.options.port = options.devServerPort;
  updateProjectConfiguration(host, options.name, projectConfig);
}
