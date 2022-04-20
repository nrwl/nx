import {
  Tree,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export function updateModuleFederationProject(
  host: Tree,
  options: { name: string; appProjectRoot: string; devServerPort?: number }
) {
  const projectConfig = readProjectConfiguration(host, options.name);

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
    '@nrwl/react:module-federation-dev-server';
  projectConfig.targets.serve.options.port = options.devServerPort;

  // `serve-static` for remotes that don't need to be in development mode
  projectConfig.targets['serve-static'] = {
    executor: '@nrwl/web:file-server',
    defaultConfiguration: 'development',
    options: {
      buildTarget: `${options.name}:build`,
      port: options.devServerPort,
    },
    configurations: {
      development: {
        buildTarget: `${options.name}:build:development`,
      },
      production: {
        buildTarget: `${options.name}:build:production`,
      },
    },
  };

  updateProjectConfiguration(host, options.name, projectConfig);
}
