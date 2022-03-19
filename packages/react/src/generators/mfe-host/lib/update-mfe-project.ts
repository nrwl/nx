import { Tree } from 'nx/src/shared/tree';
import { NormalizedSchema } from '@nrwl/react/src/generators/application/schema';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export function updateMfeProject(host: Tree, options: NormalizedSchema) {
  let projectConfig = readProjectConfiguration(host, options.name);
  projectConfig.targets.build.options = {
    ...projectConfig.targets.build.options,
    main: `${options.appProjectRoot}/src/main.ts`,
    webpackConfig: `${options.appProjectRoot}/webpack.config.js`,
  };
  projectConfig.targets.serve.executor = '@nrwl/react:mfe-dev-server';
  projectConfig.targets.serve.options.port = options.devServerPort;
  updateProjectConfiguration(host, options.name, projectConfig);
}
