import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { nxVersion } from '../utils/versions';

export function updateModuleFederationProject(
  host: Tree,
  options: {
    projectName: string;
    appProjectRoot: string;
    devServerPort?: number;
  }
): GeneratorCallback {
  const projectConfig = readProjectConfiguration(host, options.projectName);

  projectConfig.targets.build.options = {
    ...projectConfig.targets.build.options,
    main: `${options.appProjectRoot}/src/main.ts`,
    webpackConfig: `${options.appProjectRoot}/webpack.config.js`,
  };

  projectConfig.targets.build.configurations.production = {
    ...projectConfig.targets.build.configurations.production,
    webpackConfig: `${options.appProjectRoot}/webpack.config.prod.js`,
  };

  projectConfig.targets.serve.executor =
    '@nx/react:module-federation-dev-server';
  projectConfig.targets.serve.options.port = options.devServerPort;

  // `serve-static` for remotes that don't need to be in development mode
  projectConfig.targets['serve-static'] = {
    executor: '@nx/web:file-server',
    defaultConfiguration: 'development',
    options: {
      buildTarget: `${options.projectName}:build`,
      port: options.devServerPort,
    },
    configurations: {
      development: {
        buildTarget: `${options.projectName}:build:development`,
      },
      production: {
        buildTarget: `${options.projectName}:build:production`,
      },
    },
  };

  updateProjectConfiguration(host, options.projectName, projectConfig);

  return addDependenciesToPackageJson(host, {}, { '@nx/web': nxVersion });
}
