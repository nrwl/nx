import {
  ExecutorContext,
  logger,
  stripIndents,
  targetToTargetString,
} from '@nx/devkit';
import { eachValueFrom } from '@nx/devkit/src/utils/rxjs-for-await';
import type { Configuration, Stats } from 'webpack';
import { from, of } from 'rxjs';
import {
  bufferCount,
  mergeMap,
  mergeScan,
  switchMap,
  tap,
} from 'rxjs/operators';
import { resolve } from 'path';
import {
  calculateProjectBuildableDependencies,
  createTmpTsConfig,
} from '@nx/js/src/utils/buildable-libs-utils';
import { runWebpack } from './lib/run-webpack';
import { deleteOutputDir } from '../../utils/fs';
import { resolveUserDefinedWebpackConfig } from '../../utils/webpack/resolve-user-defined-webpack-config';
import type {
  NormalizedWebpackExecutorOptions,
  WebpackExecutorOptions,
} from './schema';
import { normalizeOptions } from './lib/normalize-options';
import {
  composePluginsSync,
  isNxWebpackComposablePlugin,
} from '../../utils/config';
import { withNx } from '../../utils/with-nx';
import { getRootTsConfigPath } from '@nx/js';
import { withWeb } from '../../utils/with-web';

async function getWebpackConfigs(
  options: NormalizedWebpackExecutorOptions,
  context: ExecutorContext
): Promise<Configuration | Configuration[]> {
  if (options.isolatedConfig && !options.webpackConfig) {
    throw new Error(
      `Using "isolatedConfig" without a "webpackConfig" is not supported.`
    );
  }

  let userDefinedWebpackConfig = null;
  if (options.webpackConfig) {
    userDefinedWebpackConfig = resolveUserDefinedWebpackConfig(
      options.webpackConfig,
      getRootTsConfigPath()
    );

    if (typeof userDefinedWebpackConfig.then === 'function') {
      userDefinedWebpackConfig = await userDefinedWebpackConfig;
    }
  }

  const config = options.isolatedConfig
    ? {}
    : (options.target === 'web'
        ? composePluginsSync(withNx(options), withWeb(options))
        : withNx(options))({}, { options, context });

  if (
    typeof userDefinedWebpackConfig === 'function' &&
    (isNxWebpackComposablePlugin(userDefinedWebpackConfig) ||
      !options.standardWebpackConfigFunction)
  ) {
    // Old behavior, call the Nx-specific webpack config function that user exports
    return await userDefinedWebpackConfig(config, {
      options,
      context,
      configuration: context.configurationName, // backwards compat
    });
  } else if (userDefinedWebpackConfig) {
    // New behavior, we want the webpack config to export object
    return userDefinedWebpackConfig;
  } else {
    // Fallback case, if we cannot find a webpack config path
    return config;
  }
}

export type WebpackExecutorEvent =
  | {
      success: false;
      outfile?: string;
      options?: WebpackExecutorOptions;
    }
  | {
      success: true;
      outfile: string;
      options?: WebpackExecutorOptions;
    };

export async function* webpackExecutor(
  _options: WebpackExecutorOptions,
  context: ExecutorContext
): AsyncGenerator<WebpackExecutorEvent, WebpackExecutorEvent, undefined> {
  // Default to production build.
  process.env['NODE_ENV'] ||= 'production';

  const metadata = context.projectsConfigurations.projects[context.projectName];
  const sourceRoot = metadata.sourceRoot;
  const options = normalizeOptions(
    _options,
    context.root,
    metadata.root,
    sourceRoot
  );
  const isScriptOptimizeOn =
    typeof options.optimization === 'boolean'
      ? options.optimization
      : options.optimization && options.optimization.scripts
      ? options.optimization.scripts
      : false;

  (process.env as any).NODE_ENV ||= isScriptOptimizeOn
    ? 'production'
    : 'development';

  process.env.NX_BUILD_LIBS_FROM_SOURCE = `${options.buildLibsFromSource}`;
  process.env.NX_BUILD_TARGET = targetToTargetString({
    project: context.projectName,
    target: context.targetName,
    configuration: context.configurationName,
  });

  if (options.compiler === 'swc') {
    try {
      require.resolve('swc-loader');
      require.resolve('@swc/core');
    } catch {
      logger.error(
        `Missing SWC dependencies: @swc/core, swc-loader. Make sure you install them first.`
      );
      return {
        success: false,
        options,
      };
    }
  }

  // Delete output path before bundling
  if (options.deleteOutputPath && options.outputPath) {
    deleteOutputDir(context.root, options.outputPath);
  }

  if (options.generatePackageJson && metadata.projectType !== 'application') {
    logger.warn(
      stripIndents`The project ${context.projectName} is using the 'generatePackageJson' option which is deprecated for library projects. It should only be used for applications.
        For libraries, configure the project to use the '@nx/dependency-checks' ESLint rule instead (https://nx.dev/nx-api/eslint-plugin/documents/dependency-checks).`
    );
  }

  const configs = await getWebpackConfigs(options, context);

  return yield* eachValueFrom(
    of(configs).pipe(
      mergeMap((config) => (Array.isArray(config) ? from(config) : of(config))),
      // Run build sequentially and bail when first one fails.
      mergeScan(
        (acc, config) => {
          if (!acc.hasErrors()) {
            return runWebpack(config).pipe(
              tap((stats) => {
                console.info(stats.toString(config.stats));
              })
            );
          } else {
            return of();
          }
        },
        { hasErrors: () => false } as Stats,
        1
      ),
      // Collect build results as an array.
      bufferCount(Array.isArray(configs) ? configs.length : 1),
      switchMap(async (results) => {
        const success = results.every(
          (result) => Boolean(result) && !result.hasErrors()
        );
        // TODO(jack): This should read output from webpack config if provided.
        // The outfile is only used by NestJS, where `@nx/js:node` executor requires it to run the file.
        return {
          success,
          outfile: resolve(
            context.root,
            options.outputPath,
            options.outputFileName
          ),
          options,
        };
      })
    )
  );
}

export default webpackExecutor;
