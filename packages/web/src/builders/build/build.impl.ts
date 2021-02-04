import { ExecutorContext } from '@nrwl/devkit';
import * as webpack from 'webpack';
import { Stats } from 'webpack';

import { from, of } from 'rxjs';
import { bufferCount, mergeScan, switchMap, tap } from 'rxjs/operators';
import { eachValueFrom } from 'rxjs-for-await';
import { execSync } from 'child_process';
import { Range, satisfies } from 'semver';
import { basename, join } from 'path';

import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import {
  getEmittedFiles,
  runWebpack,
} from '@nrwl/workspace/src/utilities/run-webpack';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';

import { writeIndexHtml } from '../../utils/third-party/cli-files/utilities/index-file/write-index-html';
import { CrossOriginValue } from '../../utils/third-party/cli-files/utilities/index-file/augment-index-html';
import { BuildBrowserFeatures } from '../../utils/third-party/utils/build-browser-features';

import { normalizeWebBuildOptions } from '../../utils/normalize';
import { getWebConfig } from '../../utils/web.config';
import { BuildBuilderOptions } from '../../utils/types';
import { deleteOutputDir } from '../../utils/delete-output-dir';
import { ExtraEntryPoint } from '../../utils/third-party/browser/schema';

export interface WebBuildBuilderOptions extends BuildBuilderOptions {
  index: string;
  budgets?: any[];
  baseHref?: string;
  deployUrl?: string;

  extractCss?: boolean;
  crossOrigin?: CrossOriginValue;

  polyfills?: string;
  es2015Polyfills?: string;

  scripts: ExtraEntryPoint[];
  styles: ExtraEntryPoint[];

  vendorChunk?: boolean;
  commonChunk?: boolean;

  namedChunks?: boolean;

  stylePreprocessingOptions?: any;
  subresourceIntegrity?: boolean;

  verbose?: boolean;
  buildLibsFromSource?: boolean;

  deleteOutputPath?: boolean;
}

function getWebpackConfigs(
  options: WebBuildBuilderOptions,
  context: ExecutorContext
): webpack.Configuration[] {
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

export function run(options: WebBuildBuilderOptions, context: ExecutorContext) {
  // Node versions 12.2-12.8 has a bug where prod builds will hang for 2-3 minutes
  // after the program exits.
  const nodeVersion = execSync(`node --version`).toString('utf-8').trim();
  const supportedRange = new Range('10 || >=12.9');
  if (!satisfies(nodeVersion, supportedRange)) {
    throw new Error(
      `Node version ${nodeVersion} is not supported. Supported range is "${supportedRange.raw}".`
    );
  }
  const metadata = context.workspace.projects[context.projectName];

  if (!options.buildLibsFromSource && context.targetName) {
    const projGraph = createProjectGraph();
    const { dependencies } = calculateProjectDependencies(
      projGraph,
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
  return eachValueFrom(
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
        if (options.optimization) {
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
