import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { nxVersion } from '../utils/versions';
import { maybeJs } from '../utils/maybe-js';

export function updateModuleFederationProject(
  host: Tree,
  options: {
    js?: boolean;
    projectName: string;
    appProjectRoot: string;
    devServerPort?: number;
    typescriptConfiguration?: boolean;
    dynamic?: boolean;
    bundler?: 'rspack' | 'webpack';
  }
): GeneratorCallback {
  const projectConfig = readProjectConfiguration(host, options.projectName);

  if (options.bundler === 'rspack') {
    projectConfig.targets.build.executor = '@nx/rspack:rspack';
    projectConfig.targets.build.options = {
      ...projectConfig.targets.build.options,
      main: maybeJs(options, `${options.appProjectRoot}/src/main.ts`),
      rspackConfig: `${options.appProjectRoot}/rspack.config.${
        options.typescriptConfiguration && !options.js ? 'ts' : 'js'
      }`,
      target: 'web',
    };

    projectConfig.targets.build.configurations.production = {
      ...projectConfig.targets.build.configurations.production,
      rspackConfig: `${options.appProjectRoot}/rspack.config.prod.${
        options.typescriptConfiguration && !options.js ? 'ts' : 'js'
      }`,
    };
  } else {
    projectConfig.targets.build.options = {
      ...projectConfig.targets.build.options,
      main: maybeJs(options, `${options.appProjectRoot}/src/main.ts`),
      webpackConfig: `${options.appProjectRoot}/webpack.config.${
        options.typescriptConfiguration && !options.js ? 'ts' : 'js'
      }`,
    };

    projectConfig.targets.build.configurations.production = {
      ...projectConfig.targets.build.configurations.production,
      webpackConfig: `${options.appProjectRoot}/webpack.config.prod.${
        options.typescriptConfiguration && !options.js ? 'ts' : 'js'
      }`,
    };
  }

  // If host should be configured to use dynamic federation
  if (options.dynamic) {
    if (options.bundler === 'rspack') {
      const pathToProdRspackConfig = joinPathFragments(
        projectConfig.root,
        `rspack.prod.config.${
          options.typescriptConfiguration && !options.js ? 'ts' : 'js'
        }`
      );
      if (host.exists(pathToProdRspackConfig)) {
        host.delete(pathToProdRspackConfig);
      }

      delete projectConfig.targets.build.configurations.production
        ?.rspackConfig;
    } else {
      const pathToProdWebpackConfig = joinPathFragments(
        projectConfig.root,
        `webpack.prod.config.${
          options.typescriptConfiguration && !options.js ? 'ts' : 'js'
        }`
      );
      if (host.exists(pathToProdWebpackConfig)) {
        host.delete(pathToProdWebpackConfig);
      }

      delete projectConfig.targets.build.configurations.production
        ?.webpackConfig;
    }
  }

  if (options.bundler === 'rspack') {
    projectConfig.targets.serve.executor =
      '@nx/rspack:module-federation-dev-server';
  } else {
    projectConfig.targets.serve.executor =
      '@nx/react:module-federation-dev-server';
  }
  projectConfig.targets.serve.options.port = options.devServerPort;

  // `serve-static` for remotes that don't need to be in development mode
  projectConfig.targets['serve-static'] = {
    executor: '@nx/web:file-server',
    defaultConfiguration: 'production',
    options: {
      buildTarget: `${options.projectName}:build`,
      watch: false,
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
