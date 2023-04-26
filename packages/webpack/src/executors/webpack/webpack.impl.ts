import 'dotenv/config';
import { ExecutorContext, logger } from '@nx/devkit';
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
  calculateProjectDependencies,
  createTmpTsConfig,
} from '@nx/js/src/utils/buildable-libs-utils';

import { getWebpackConfig } from './lib/get-webpack-config';
import { runWebpack } from './lib/run-webpack';
import { deleteOutputDir } from '../../utils/fs';
import { resolveCustomWebpackConfig } from '../../utils/webpack/custom-webpack';
import type {
  NormalizedWebpackExecutorOptions,
  WebpackExecutorOptions,
} from './schema';
import { normalizeOptions } from './lib/normalize-options';

async function getWebpackConfigs(
  options: NormalizedWebpackExecutorOptions,
  context: ExecutorContext
): Promise<Configuration | Configuration[]> {
  if (options.isolatedConfig && !options.webpackConfig) {
    throw new Error(
      `Using "isolatedConfig" without a "webpackConfig" is not supported.`
    );
  }

  let customWebpack = null;

  if (options.webpackConfig) {
    customWebpack = resolveCustomWebpackConfig(
      options.webpackConfig,
      options.tsConfig
    );

    if (typeof customWebpack.then === 'function') {
      customWebpack = await customWebpack;
    }
  }

  const config = options.isolatedConfig
    ? {}
    : getWebpackConfig(context, options);

  if (customWebpack) {
    return await customWebpack(config, {
      options,
      context,
      configuration: context.configurationName, // backwards compat
    });
  } else {
    // If the user has no webpackConfig specified then we always have to apply
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
        outfile: resolve(
          context.root,
          options.outputPath,
          options.outputFileName
        ),
        options,
      };
    }
  }

  if (!options.buildLibsFromSource && context.targetName) {
    const { dependencies } = calculateProjectDependencies(
      context.projectGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );
    options.tsConfig = createTmpTsConfig(
      options.tsConfig,
      context.root,
      metadata.root,
      dependencies
    );
  }

  // Delete output path before bundling
  if (options.deleteOutputPath) {
    deleteOutputDir(context.root, options.outputPath);
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
