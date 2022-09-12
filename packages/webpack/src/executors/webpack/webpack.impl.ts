import { ExecutorContext, logger } from '@nrwl/devkit';
import { eachValueFrom } from '@nrwl/devkit/src/utils/rxjs-for-await';
import type { Configuration, Stats } from 'webpack';
import { from, of } from 'rxjs';
import {
  bufferCount,
  mergeMap,
  mergeScan,
  switchMap,
  tap,
} from 'rxjs/operators';
import { basename, join, resolve } from 'path';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';

import { getWebpackConfig } from './lib/get-webpack-config';
import { getEmittedFiles } from './lib/get-emitted-files';
import { runWebpack } from './lib/run-webpack';
import { BuildBrowserFeatures } from '../../utils/webpack/build-browser-features';
import { deleteOutputDir } from '../../utils/fs';
import { writeIndexHtml } from '../../utils/webpack/write-index-html';
import { resolveCustomWebpackConfig } from '../../utils/webpack/custom-webpack';
import type { WebpackExecutorOptions } from './schema';
import { normalizeOptions } from './lib/normalize-options';
import { EmittedFile } from '../../utils/models';

async function getWebpackConfigs(
  _options: WebpackExecutorOptions,
  context: ExecutorContext
): Promise<Configuration[]> {
  const metadata = context.workspace.projects[context.projectName];
  const sourceRoot = metadata.sourceRoot;
  const projectRoot = metadata.root;
  const options = normalizeOptions(_options, context.root, sourceRoot);
  const isScriptOptimizeOn =
    typeof options.optimization === 'boolean'
      ? options.optimization
      : options.optimization && options.optimization.scripts
      ? options.optimization.scripts
      : false;
  const tsConfig = readTsConfig(options.tsConfig);
  const scriptTarget = tsConfig.options.target;

  const buildBrowserFeatures = new BuildBrowserFeatures(
    projectRoot,
    scriptTarget
  );

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

  return await Promise.all(
    [
      // ESM build for modern browsers.
      getWebpackConfig(context, options, true, isScriptOptimizeOn),
      // ES5 build for legacy browsers.
      options.target === 'web' &&
      isScriptOptimizeOn &&
      buildBrowserFeatures.isDifferentialLoadingNeeded()
        ? getWebpackConfig(context, options, false, isScriptOptimizeOn)
        : undefined,
    ]
      .filter(Boolean)
      .map(async (config) => {
        if (customWebpack) {
          return await customWebpack(config, {
            options,
            context,
            configuration: context.configurationName, // backwards compat
          });
        } else {
          return config;
        }
      })
  );
}

export type WebpackExecutorEvent =
  | { success: false; outfile?: string }
  | {
      success: true;
      outfile: string;
      emittedFiles: EmittedFile[];
    };

export async function* webpackExecutor(
  options: WebpackExecutorOptions,
  context: ExecutorContext
): AsyncGenerator<WebpackExecutorEvent, WebpackExecutorEvent, undefined> {
  const isScriptOptimizeOn =
    typeof options.optimization === 'boolean'
      ? options.optimization
      : options.optimization && options.optimization.scripts
      ? options.optimization.scripts
      : false;

  process.env.NODE_ENV ||= isScriptOptimizeOn ? 'production' : 'development';

  const metadata = context.workspace.projects[context.projectName];

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
      join(context.root, options.tsConfig),
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
    from(configs).pipe(
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
      bufferCount(configs.length),
      switchMap(async ([result1, result2]) => {
        const success =
          result1 && !result1.hasErrors() && (!result2 || !result2.hasErrors());
        const emittedFiles1 = getEmittedFiles(result1);
        const emittedFiles2 = result2 ? getEmittedFiles(result2) : [];
        if (options.index && options.generateIndexHtml) {
          await writeIndexHtml({
            crossOrigin: options.crossOrigin,
            sri: options.subresourceIntegrity,
            outputPath: join(options.outputPath, basename(options.index)),
            indexPath: join(context.root, options.index),
            files: emittedFiles1.filter((x) => x.extension === '.css'),
            noModuleFiles: emittedFiles2,
            moduleFiles: emittedFiles1,
            baseHref: options.baseHref,
            deployUrl: options.deployUrl,
            scripts: options.scripts,
            styles: options.styles,
          });
        }
        return {
          success,
          outfile: resolve(
            context.root,
            options.outputPath,
            options.outputFileName
          ),
          emittedFiles: [...emittedFiles1, ...emittedFiles2],
        };
      })
    )
  );
}

export default webpackExecutor;
