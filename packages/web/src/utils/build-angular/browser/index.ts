/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import {
  BuildResult,
  EmittedFiles,
  WebpackLoggingCallback,
  runWebpack
} from '@angular-devkit/build-webpack';
import {
  experimental,
  getSystemPath,
  join,
  json,
  logging,
  normalize,
  resolve,
  tags,
  virtualFs
} from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { createHash } from 'crypto';
import * as findCacheDirectory from 'find-cache-dir';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { from, of } from 'rxjs';
import {
  bufferCount,
  catchError,
  concatMap,
  map,
  mergeScan,
  switchMap
} from 'rxjs/operators';
import { ScriptTarget } from 'typescript';
import * as webpack from 'webpack';
// import { NgBuildAnalyticsPlugin } from '../../plugins/webpack/analytics';
import { WebpackConfigOptions } from '../angular-cli-files/models/build-options';
import {
  getAotConfig,
  getBrowserConfig,
  getCommonConfig,
  getNonAotConfig,
  getStatsConfig,
  getStylesConfig,
  getWorkerConfig,
  normalizeExtraEntryPoints
} from '../angular-cli-files/models/webpack-configs';
import {
  IndexHtmlTransform,
  writeIndexHtml
} from '../angular-cli-files/utilities/index-file/write-index-html';
import { readTsconfig } from '../angular-cli-files/utilities/read-tsconfig';
import { augmentAppWithServiceWorker } from '../angular-cli-files/utilities/service-worker';
import {
  generateBuildStats,
  generateBundleStats,
  statsErrorsToString,
  statsToString,
  statsWarningsToString
} from '../angular-cli-files/utilities/stats';
import { ExecutionTransformer } from '../transforms';
import {
  BuildBrowserFeatures,
  deleteOutputDir,
  fullDifferential,
  normalizeOptimization,
  normalizeSourceMaps
} from '../utils';
import {
  ProcessBundleFile,
  ProcessBundleOptions,
  ProcessBundleResult
} from '../utils/process-bundle';
import { assertCompatibleAngularVersion } from '../utils/version';
import {
  generateBrowserWebpackConfigFromContext,
  getIndexInputFile,
  getIndexOutputFile
} from '../utils/webpack-browser-config';
import { BundleActionExecutor } from './action-executor';
import { Schema as BrowserBuilderSchema } from './schema';

const cacache = require('cacache');
const cacheDownlevelPath = findCacheDirectory({ name: 'angular-build-dl' });
const packageVersion = require('../../package.json').version;

export type BrowserBuilderOutput = json.JsonObject &
  BuilderOutput & {
    outputPath: string;
  };

export function createBrowserLoggingCallback(
  verbose: boolean,
  logger: logging.LoggerApi
): WebpackLoggingCallback {
  return (stats, config) => {
    // config.stats contains our own stats settings, added during buildWebpackConfig().
    const json = stats.toJson(config.stats);
    if (verbose) {
      logger.info(stats.toString(config.stats));
    } else {
      logger.info(statsToString(json, config.stats));
    }

    if (stats.hasWarnings()) {
      logger.warn(statsWarningsToString(json, config.stats));
    }
    if (stats.hasErrors()) {
      logger.error(statsErrorsToString(json, config.stats));
    }
  };
}

export async function buildBrowserWebpackConfigFromContext(
  options: BrowserBuilderSchema,
  context: BuilderContext,
  host: virtualFs.Host<fs.Stats> = new NodeJsSyncHost()
): Promise<{
  workspace: experimental.workspace.Workspace;
  config: webpack.Configuration[];
}> {
  return generateBrowserWebpackConfigFromContext(
    options,
    context,
    wco => [
      getCommonConfig(wco),
      getBrowserConfig(wco),
      getStylesConfig(wco),
      getStatsConfig(wco),
      getAnalyticsConfig(wco, context),
      getCompilerConfig(wco),
      wco.buildOptions.webWorkerTsConfig ? getWorkerConfig(wco) : {}
    ],
    host
  );
}

function getAnalyticsConfig(
  wco: WebpackConfigOptions,
  context: BuilderContext
): webpack.Configuration {
  if (context.analytics) {
    // If there's analytics, add our plugin. Otherwise no need to slow down the build.
    let category = 'build';
    if (context.builder) {
      // We already vetted that this is a "safe" package, otherwise the analytics would be noop.
      category =
        context.builder.builderName.split(':')[1] ||
        context.builder.builderName ||
        'build';
    }

    // The category is the builder name if it's an angular builder.
    return {
      plugins: []
    };
  }

  return {};
}

function getCompilerConfig(wco: WebpackConfigOptions): webpack.Configuration {
  if (wco.buildOptions.main || wco.buildOptions.polyfills) {
    return wco.buildOptions.aot ? getAotConfig(wco) : getNonAotConfig(wco);
  }

  return {};
}

async function initialize(
  options: BrowserBuilderSchema,
  context: BuilderContext,
  host: virtualFs.Host<fs.Stats>,
  webpackConfigurationTransform?: ExecutionTransformer<webpack.Configuration>
): Promise<{
  workspace: experimental.workspace.Workspace;
  config: webpack.Configuration[];
}> {
  const { config, workspace } = await buildBrowserWebpackConfigFromContext(
    options,
    context,
    host
  );

  let transformedConfig;
  if (webpackConfigurationTransform) {
    transformedConfig = [];
    for (const c of config) {
      transformedConfig.push(await webpackConfigurationTransform(c));
    }
  }

  if (options.deleteOutputPath) {
    await deleteOutputDir(
      normalize(context.workspaceRoot),
      normalize(options.outputPath),
      host
    ).toPromise();
  }

  return { config: transformedConfig || config, workspace };
}

// tslint:disable-next-line: no-big-function
export function buildWebpackBrowser(
  options: BrowserBuilderSchema,
  context: BuilderContext,
  transforms: {
    webpackConfiguration?: ExecutionTransformer<webpack.Configuration>;
    logging?: WebpackLoggingCallback;
    indexHtml?: IndexHtmlTransform;
  } = {}
) {
  const host = new NodeJsSyncHost();
  const root = normalize(context.workspaceRoot);

  // Check Angular version.
  assertCompatibleAngularVersion(context.workspaceRoot, context.logger);

  return from(
    initialize(options, context, host, transforms.webpackConfiguration)
  ).pipe(
    // tslint:disable-next-line: no-big-function
    switchMap(({ workspace, config: configs }) => {
      const projectName = context.target
        ? context.target.project
        : workspace.getDefaultProjectName();

      if (!projectName) {
        throw new Error(
          'Must either have a target from the context or a default project.'
        );
      }

      const projectRoot = resolve(
        workspace.root,
        normalize(workspace.getProject(projectName).root)
      );

      const tsConfig = readTsconfig(options.tsConfig, context.workspaceRoot);
      const target = tsConfig.options.target || ScriptTarget.ES5;
      const buildBrowserFeatures = new BuildBrowserFeatures(
        getSystemPath(projectRoot),
        target
      );

      const isDifferentialLoadingNeeded = buildBrowserFeatures.isDifferentialLoadingNeeded();

      if (target > ScriptTarget.ES2015 && isDifferentialLoadingNeeded) {
        context.logger.warn(tags.stripIndent`
          WARNING: Using differential loading with targets ES5 and ES2016 or higher may
          cause problems. Browsers with support for ES2015 will load the ES2016+ scripts
          referenced with script[type="module"] but they may not support ES2016+ syntax.
        `);
      }

      const useBundleDownleveling =
        isDifferentialLoadingNeeded && !(fullDifferential || options.watch);
      const startTime = Date.now();

      return from(configs).pipe(
        // the concurrency parameter (3rd parameter of mergeScan) is deliberately
        // set to 1 to make sure the build steps are executed in sequence.
        mergeScan(
          (lastResult, config) => {
            // Make sure to only run the 2nd build step, if 1st one succeeded
            if (lastResult.success) {
              return runWebpack(config, context, {
                logging:
                  transforms.logging ||
                  (useBundleDownleveling
                    ? () => {}
                    : createBrowserLoggingCallback(
                        !!options.verbose,
                        context.logger
                      ))
              });
            } else {
              return of();
            }
          },
          { success: true } as BuildResult,
          1
        ),
        bufferCount(configs.length),
        // tslint:disable-next-line: no-big-function
        switchMap(async buildEvents => {
          configs.length = 0;
          const success = buildEvents.every(r => r.success);
          if (!success && useBundleDownleveling) {
            // If using bundle downleveling then there is only one build
            // If it fails show any diagnostic messages and bail
            const webpackStats = buildEvents[0].webpackStats;
            if (webpackStats && webpackStats.warnings.length > 0) {
              context.logger.warn(
                statsWarningsToString(webpackStats, { colors: true })
              );
            }
            if (webpackStats && webpackStats.errors.length > 0) {
              context.logger.error(
                statsErrorsToString(webpackStats, { colors: true })
              );
            }

            return { success };
          } else if (success) {
            let noModuleFiles: EmittedFiles[] | undefined;
            let moduleFiles: EmittedFiles[] | undefined;
            let files: EmittedFiles[] | undefined;

            const scriptsEntryPointName = normalizeExtraEntryPoints(
              options.scripts || [],
              'scripts'
            ).map(x => x.bundleName);

            const [firstBuild, secondBuild] = buildEvents;
            if (
              isDifferentialLoadingNeeded &&
              (fullDifferential || options.watch)
            ) {
              moduleFiles = firstBuild.emittedFiles || [];
              files = moduleFiles.filter(
                x =>
                  x.extension === '.css' ||
                  (x.name && scriptsEntryPointName.includes(x.name))
              );

              if (buildEvents.length === 2) {
                noModuleFiles = secondBuild.emittedFiles;
              }
            } else if (isDifferentialLoadingNeeded && !fullDifferential) {
              const { emittedFiles = [], webpackStats } = firstBuild;
              moduleFiles = [];
              noModuleFiles = [];

              // Common options for all bundle process actions
              const sourceMapOptions = normalizeSourceMaps(
                options.sourceMap || false
              );
              const actionOptions: Partial<ProcessBundleOptions> = {
                optimize: normalizeOptimization(options.optimization).scripts,
                sourceMaps: sourceMapOptions.scripts,
                hiddenSourceMaps: sourceMapOptions.hidden,
                vendorSourceMaps: sourceMapOptions.vendor,
                integrityAlgorithm: options.subresourceIntegrity
                  ? 'sha384'
                  : undefined
              };

              const actions: ProcessBundleOptions[] = [];
              const seen = new Set<string>();
              for (const file of emittedFiles) {
                // Assets are not processed nor injected into the index
                if (file.asset) {
                  continue;
                }

                // Scripts and non-javascript files are not processed
                if (
                  file.extension !== '.js' ||
                  (file.name && scriptsEntryPointName.includes(file.name))
                ) {
                  if (files === undefined) {
                    files = [];
                  }
                  files.push(file);
                  continue;
                }

                // Ignore already processed files; emittedFiles can contain duplicates
                if (seen.has(file.file)) {
                  continue;
                }
                seen.add(file.file);

                // All files at this point except ES5 polyfills are module scripts
                const es5Polyfills =
                  file.file.startsWith('polyfills-es5') ||
                  file.file.startsWith('polyfills-nomodule-es5');
                if (!es5Polyfills) {
                  moduleFiles.push(file);
                }
                // If not optimizing then ES2015 polyfills do not need processing
                // Unlike other module scripts, it is never downleveled
                const es2015Polyfills = file.file.startsWith(
                  'polyfills-es2015'
                );
                if (!actionOptions.optimize && es2015Polyfills) {
                  continue;
                }

                // Retrieve the content/map for the file
                // NOTE: Additional future optimizations will read directly from memory
                let filename = path.resolve(
                  getSystemPath(root),
                  options.outputPath,
                  file.file
                );
                const code = fs.readFileSync(filename, 'utf8');
                let map;
                if (actionOptions.sourceMaps) {
                  try {
                    map = fs.readFileSync(filename + '.map', 'utf8');
                    if (es5Polyfills) {
                      fs.unlinkSync(filename + '.map');
                    }
                  } catch {}
                }

                if (es5Polyfills) {
                  fs.unlinkSync(filename);
                  filename = filename.replace('-es2015', '');
                }

                // Record the bundle processing action
                // The runtime chunk gets special processing for lazy loaded files
                actions.push({
                  ...actionOptions,
                  filename,
                  code,
                  map,
                  // id is always present for non-assets
                  // tslint:disable-next-line: no-non-null-assertion
                  name: file.id!,
                  runtime: file.file.startsWith('runtime'),
                  ignoreOriginal: es5Polyfills,
                  optimizeOnly: es2015Polyfills
                });

                // ES2015 polyfills are only optimized; optimization check was performed above
                if (es2015Polyfills) {
                  continue;
                }

                // Add the newly created ES5 bundles to the index as nomodule scripts
                const newFilename = es5Polyfills
                  ? file.file.replace('-es2015', '')
                  : file.file.replace('es2015', 'es5');
                noModuleFiles.push({ ...file, file: newFilename });
              }

              // Execute the bundle processing actions
              context.logger.info(
                'Generating ES5 bundles for differential loading...'
              );

              const processActions: typeof actions = [];
              let processRuntimeAction: ProcessBundleOptions | undefined;
              const processResults: ProcessBundleResult[] = [];
              for (const action of actions) {
                // If SRI is enabled always process the runtime bundle
                // Lazy route integrity values are stored in the runtime bundle
                if (action.integrityAlgorithm && action.runtime) {
                  processRuntimeAction = action;
                } else {
                  processActions.push(action);
                }
              }

              const executor = new BundleActionExecutor(
                { cachePath: cacheDownlevelPath },
                options.subresourceIntegrity ? 'sha384' : undefined
              );

              try {
                for await (const result of executor.processAll(
                  processActions
                )) {
                  processResults.push(result);
                }
              } finally {
                executor.stop();
              }

              // Runtime must be processed after all other files
              if (processRuntimeAction) {
                const runtimeOptions = {
                  ...processRuntimeAction,
                  runtimeData: processResults
                };
                processResults.push(
                  await import('../utils/process-bundle').then(m =>
                    m.process(runtimeOptions)
                  )
                );
              }

              context.logger.info('ES5 bundle generation complete.');

              type ArrayElement<A> = A extends ReadonlyArray<infer T>
                ? T
                : never;
              function generateBundleInfoStats(
                id: string | number,
                bundle: ProcessBundleFile,
                chunk:
                  | ArrayElement<webpack.Stats.ToJsonOutput['chunks']>
                  | undefined
              ): string {
                return generateBundleStats(
                  {
                    id,
                    size: bundle.size,
                    files: bundle.map
                      ? [bundle.filename, bundle.map.filename]
                      : [bundle.filename],
                    names: chunk && chunk.names,
                    entry: !!chunk && chunk.names.includes('runtime'),
                    initial: !!chunk && chunk.initial,
                    rendered: true
                  },
                  true
                );
              }

              let bundleInfoText = '';
              const processedNames = new Set<string>();
              for (const result of processResults) {
                processedNames.add(result.name);

                const chunk =
                  webpackStats &&
                  webpackStats.chunks &&
                  webpackStats.chunks.find(
                    c => result.name === c.id.toString()
                  );
                if (result.original) {
                  bundleInfoText +=
                    '\n' +
                    generateBundleInfoStats(
                      result.name,
                      result.original,
                      chunk
                    );
                }
                if (result.downlevel) {
                  bundleInfoText +=
                    '\n' +
                    generateBundleInfoStats(
                      result.name,
                      result.downlevel,
                      chunk
                    );
                }
              }

              if (webpackStats && webpackStats.chunks) {
                for (const chunk of webpackStats.chunks) {
                  if (processedNames.has(chunk.id.toString())) {
                    continue;
                  }

                  const asset =
                    webpackStats.assets &&
                    webpackStats.assets.find(a => a.name === chunk.files[0]);
                  bundleInfoText +=
                    '\n' +
                    generateBundleStats(
                      { ...chunk, size: asset && asset.size },
                      true
                    );
                }
              }

              bundleInfoText +=
                '\n' +
                generateBuildStats(
                  (webpackStats && webpackStats.hash) || '<unknown>',
                  Date.now() - startTime,
                  true
                );
              context.logger.info(bundleInfoText);
              if (webpackStats && webpackStats.warnings.length > 0) {
                context.logger.warn(
                  statsWarningsToString(webpackStats, { colors: true })
                );
              }
              if (webpackStats && webpackStats.errors.length > 0) {
                context.logger.error(
                  statsErrorsToString(webpackStats, { colors: true })
                );
              }
            } else {
              const { emittedFiles = [] } = firstBuild;
              files = emittedFiles.filter(x => x.name !== 'polyfills-es5');
              noModuleFiles = emittedFiles.filter(
                x => x.name === 'polyfills-es5'
              );
            }

            if (options.index) {
              return writeIndexHtml({
                host,
                outputPath: resolve(
                  root,
                  join(
                    normalize(options.outputPath),
                    getIndexOutputFile(options)
                  )
                ),
                indexPath: join(root, getIndexInputFile(options)),
                files,
                noModuleFiles,
                moduleFiles,
                baseHref: options.baseHref,
                deployUrl: options.deployUrl,
                sri: options.subresourceIntegrity,
                scripts: options.scripts,
                styles: options.styles,
                postTransform: transforms.indexHtml,
                crossOrigin: options.crossOrigin
              })
                .pipe(
                  map(() => ({ success: true })),
                  catchError(error =>
                    of({ success: false, error: mapErrorToMessage(error) })
                  )
                )
                .toPromise();
            } else {
              return { success };
            }
          } else {
            return { success };
          }
        }),
        concatMap(buildEvent => {
          if (buildEvent.success && !options.watch && options.serviceWorker) {
            return from(
              augmentAppWithServiceWorker(
                host,
                root,
                projectRoot,
                resolve(root, normalize(options.outputPath)),
                options.baseHref || '/',
                options.ngswConfigPath
              ).then(
                () => ({ success: true }),
                error => ({ success: false, error: mapErrorToMessage(error) })
              )
            );
          } else {
            return of(buildEvent);
          }
        }),
        map(
          event =>
            ({
              ...event,
              // If we use differential loading, both configs have the same outputs
              outputPath: path.resolve(
                context.workspaceRoot,
                options.outputPath
              )
            } as BrowserBuilderOutput)
        )
      );
    })
  );
}

function mapErrorToMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return undefined;
}

export default createBuilder<json.JsonObject & BrowserBuilderSchema>(
  buildWebpackBrowser
);
