import { ExecutorContext, logger } from '@nrwl/devkit';
import type { Configuration, Stats } from 'webpack';
import { from, of } from 'rxjs';
import { bufferCount, mergeScan, switchMap, tap } from 'rxjs/operators';
import { eachValueFrom } from 'rxjs-for-await';
import { execSync } from 'child_process';
import { Range, satisfies } from 'semver';
import { basename, join } from 'path';

import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';

import { normalizeWebBuildOptions } from '../../utils/normalize';
import { getWebConfig } from '../../utils/web.config';
import type { BuildBuilderOptions } from '../../utils/shared-models';
import { ExtraEntryPoint } from '../../utils/shared-models';
import { getEmittedFiles, runWebpack } from '../../utils/run-webpack';
import { BuildBrowserFeatures } from '../../utils/webpack/build-browser-features';
import { deleteOutputDir } from '../../utils/fs';
import {
  CrossOriginValue,
  writeIndexHtml,
} from '../../utils/webpack/write-index-html';

export interface WebWebpackExecutorOptions extends BuildBuilderOptions {
  index: string;
  budgets?: any[];
  baseHref?: string;
  deployUrl?: string;

  crossOrigin?: CrossOriginValue;

  polyfills?: string;
  es2015Polyfills?: string;

  scripts: ExtraEntryPoint[];
  styles: ExtraEntryPoint[];

  vendorChunk?: boolean;
  commonChunk?: boolean;

  namedChunks?: boolean;

  stylePreprocessorOptions?: any;
  subresourceIntegrity?: boolean;

  verbose?: boolean;
  buildLibsFromSource?: boolean;

  deleteOutputPath?: boolean;

  generateIndexHtml?: boolean;
}

function getWebpackConfigs(
  options: WebWebpackExecutorOptions,
  context: ExecutorContext
): Configuration[] {
  const metadata = context.workspace.projects[context.projectName];
  const sourceRoot = metadata.sourceRoot;
  const projectRoot = metadata.root;
  options = normalizeWebBuildOptions(options, context.root, sourceRoot);
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

  return [
    // ESM build for modern browsers.
    getWebConfig(
      context.root,
      projectRoot,
      sourceRoot,
      options,
      true,
      isScriptOptimizeOn,
      context.configurationName
    ),
    // ES5 build for legacy browsers.
    isScriptOptimizeOn && buildBrowserFeatures.isDifferentialLoadingNeeded()
      ? getWebConfig(
          context.root,
          projectRoot,
          sourceRoot,
          options,
          false,
          isScriptOptimizeOn,
          context.configurationName
        )
      : undefined,
  ]
    .filter(Boolean)
    .map((config) =>
      options.webpackConfig
        ? require(options.webpackConfig)(config, {
            options,
            configuration: context.configurationName,
          })
        : config
    );
}

export async function* run(
  options: WebWebpackExecutorOptions,
  context: ExecutorContext
) {
  // Node versions 12.2-12.8 has a bug where prod builds will hang for 2-3 minutes
  // after the program exits.
  const nodeVersion = execSync(`node --version`).toString('utf-8').trim();
  const supportedRange = new Range('10 || >=12.9');
  if (!satisfies(nodeVersion, supportedRange)) {
    throw new Error(
      `Node version ${nodeVersion} is not supported. Supported range is "${supportedRange.raw}".`
    );
  }

  process.env.NODE_ENV ||= 'production';

  const metadata = context.workspace.projects[context.projectName];

  if (options.compiler === 'swc') {
    try {
      require.resolve('swc-loader');
      require.resolve('@swc/core');
    } catch {
      logger.error(
        `Missing SWC dependencies: @swc/core, swc-loader. Make sure you install them first.`
      );
      return { success: false };
    }
  }

  if (!options.buildLibsFromSource && context.targetName) {
    const { dependencies } = calculateProjectDependencies(
      readCachedProjectGraph(),
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

    if (
      !checkDependentProjectsHaveBeenBuilt(
        context.root,
        context.projectName,
        context.targetName,
        dependencies
      )
    ) {
      throw new Error();
    }
  }

  // Delete output path before bundling
  if (options.deleteOutputPath) {
    deleteOutputDir(context.root, options.outputPath);
  }

  const configs = getWebpackConfigs(options, context);
  return yield* eachValueFrom(
    from(configs).pipe(
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
        if (options.generateIndexHtml) {
          await writeIndexHtml({
            crossOrigin: options.crossOrigin,
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
        return { success, emittedFiles: [...emittedFiles1, ...emittedFiles2] };
      })
    )
  );
}

export default run;
