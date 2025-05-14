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
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

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
    ssr?: boolean;
  },
  isHost = false
) {
  const projectConfig = readProjectConfiguration(host, options.projectName);

  if (options.bundler !== 'rspack') {
    projectConfig.targets.build.options = {
      ...(projectConfig.targets.build.options ?? {}),
      main: maybeJs(options, `${options.appProjectRoot}/src/main.ts`),
      webpackConfig: `${options.appProjectRoot}/webpack.config.${
        options.typescriptConfiguration && !options.js ? 'ts' : 'js'
      }`,
    };

    projectConfig.targets.build.configurations ??= {};

    projectConfig.targets.build.configurations.production = {
      ...(projectConfig.targets.build.configurations?.production ?? {}),
      webpackConfig: `${options.appProjectRoot}/webpack.config.prod.${
        options.typescriptConfiguration && !options.js ? 'ts' : 'js'
      }`,
    };
  }

  // If host should be configured to use dynamic federation
  if (options.dynamic) {
    if (options.bundler !== 'rspack') {
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

  if (options.bundler !== 'rspack') {
    projectConfig.targets.serve.executor =
      '@nx/react:module-federation-dev-server';
  }
  projectConfig.targets.serve ??= {};
  projectConfig.targets.serve.options ??= {};
  projectConfig.targets.serve.options.port =
    options.bundler === 'rspack' && options.ssr && isHost
      ? 4000
      : options.devServerPort;

  // `serve-static` for remotes that don't need to be in development mode
  if (options.bundler !== 'rspack') {
    const serveStaticExecutor = '@nx/react:module-federation-static-server';
    projectConfig.targets['serve-static'] = {
      executor: serveStaticExecutor,
      defaultConfiguration: 'production',
      options: {
        serveTarget: `${options.projectName}:serve`,
      },
      configurations: {
        development: {
          serveTarget: `${options.projectName}:serve:development`,
        },
        production: {
          serveTarget: `${options.projectName}:serve:production`,
        },
      },
    };
  }

  // Typechecks must be performed first before build and serve to generate remote d.ts files.
  if (isUsingTsSolutionSetup(host)) {
    projectConfig.targets.build ??= {};
    projectConfig.targets.serve ??= {};
    projectConfig.targets.build.dependsOn = ['^build', 'typecheck'];
    projectConfig.targets.serve.dependsOn = ['typecheck'];
  }

  updateProjectConfiguration(host, options.projectName, projectConfig);
}
