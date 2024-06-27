import * as webpack from 'webpack';
import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
  targetToTargetString,
} from '@nx/devkit';

import { eachValueFrom } from '@nx/devkit/src/utils/rxjs-for-await';
import { map, tap } from 'rxjs/operators';
import * as WebpackDevServer from 'webpack-dev-server';

import { getDevServerOptions } from './lib/get-dev-server-config';
import {
  calculateProjectBuildableDependencies,
  createTmpTsConfig,
} from '@nx/js/src/utils/buildable-libs-utils';
import { runWebpackDevServer } from '../../utils/run-webpack';
import { resolveUserDefinedWebpackConfig } from '../../utils/webpack/resolve-user-defined-webpack-config';
import { normalizeOptions } from '../webpack/lib/normalize-options';
import { WebpackExecutorOptions } from '../webpack/schema';
import { WebDevServerOptions } from './schema';
import { isNxWebpackComposablePlugin } from '../../utils/config';
import { getRootTsConfigPath } from '@nx/js';

export async function* devServerExecutor(
  serveOptions: WebDevServerOptions,
  context: ExecutorContext
) {
  // Default to dev mode so builds are faster and HMR mode works better.
  (process.env as any).NODE_ENV ??= 'development';

  const { root: projectRoot, sourceRoot } =
    context.projectsConfigurations.projects[context.projectName];
  const buildOptions = normalizeOptions(
    getBuildOptions(serveOptions, context),
    context.root,
    projectRoot,
    sourceRoot
  );

  process.env.NX_BUILD_LIBS_FROM_SOURCE = `${buildOptions.buildLibsFromSource}`;
  process.env.NX_BUILD_TARGET = serveOptions.buildTarget;

  // TODO(jack): Figure out a way to port this into NxWebpackPlugin
  if (!buildOptions.buildLibsFromSource) {
    if (!buildOptions.tsConfig) {
      throw new Error(
        `Cannot find "tsConfig" to remap paths for. Set this option in project.json.`
      );
    }
    const { target, dependencies } = calculateProjectBuildableDependencies(
      context.taskGraph,
      context.projectGraph,
      context.root,
      context.projectName,
      'build', // should be generalized
      context.configurationName
    );
    buildOptions.tsConfig = createTmpTsConfig(
      buildOptions.tsConfig,
      context.root,
      target.data.root,
      dependencies
    );

    process.env.NX_TSCONFIG_PATH = buildOptions.tsConfig;
  }

  let config;

  const devServer = getDevServerOptions(
    context.root,
    serveOptions,
    buildOptions
  );

  if (buildOptions.webpackConfig) {
    let userDefinedWebpackConfig = resolveUserDefinedWebpackConfig(
      buildOptions.webpackConfig,
      getRootTsConfigPath()
    );

    if (typeof userDefinedWebpackConfig.then === 'function') {
      userDefinedWebpackConfig = await userDefinedWebpackConfig;
    }

    // Only add the dev server option if user is composable plugin.
    // Otherwise, user should define `devServer` option directly in their webpack config.
    if (
      typeof userDefinedWebpackConfig === 'function' &&
      (isNxWebpackComposablePlugin(userDefinedWebpackConfig) ||
        !buildOptions.standardWebpackConfigFunction)
    ) {
      config = await userDefinedWebpackConfig(
        { devServer },
        {
          options: buildOptions,
          context,
          configuration: serveOptions.buildTarget.split(':')[2],
        }
      );
    } else if (userDefinedWebpackConfig) {
      // New behavior, we want the webpack config to export object
      // If the config is a function, we assume it's a standard webpack config function and it's async
      if (typeof userDefinedWebpackConfig === 'function') {
        config = await userDefinedWebpackConfig(process.env.NODE_ENV, {});
      } else {
        config = userDefinedWebpackConfig;
      }
      config.devServer ??= devServer;
    }
  }

  return yield* eachValueFrom(
    runWebpackDevServer(config, webpack, WebpackDevServer).pipe(
      tap(({ stats }) => {
        console.info(stats.toString((config as any).stats));
      }),
      map(({ baseUrl, stats }) => {
        return {
          baseUrl,
          success: !stats.hasErrors(),
        };
      })
    )
  );
}

function getBuildOptions(
  options: WebDevServerOptions,
  context: ExecutorContext
): WebpackExecutorOptions {
  const target = parseTargetString(options.buildTarget, context);

  const overrides: Partial<WebpackExecutorOptions> = {
    watch: false,
  };
  if (options.memoryLimit) {
    overrides.memoryLimit = options.memoryLimit;
  }
  if (options.baseHref) {
    overrides.baseHref = options.baseHref;
  }

  const buildOptions = readTargetOptions(target, context);

  return {
    ...buildOptions,
    ...overrides,
  };
}

export default devServerExecutor;
