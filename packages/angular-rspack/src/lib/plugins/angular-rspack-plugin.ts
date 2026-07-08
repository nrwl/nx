import {
  augmentAppWithServiceWorker,
  type BudgetCalculatorResult,
  checkBudgets,
  ThresholdSeverity,
} from '@angular/build/private';
import {
  buildAndAnalyze,
  DiagnosticModes,
  disposeComponentStylesheetBundler,
  JavaScriptTransformer,
  SourceFileCache,
  maxWorkers,
  setupCompilationWithAngularCompilation,
  AngularCompilation,
  type StylesheetMetafileInputs,
} from '@nx/angular-rspack-compiler';
import { workspaceRoot } from '@nx/devkit';
import {
  type Compilation,
  type Compiler,
  type RspackOptionsNormalized,
  type RspackPluginInstance,
  sources,
} from '@rspack/core';
import { createRequire } from 'node:module';
import { dirname, join, normalize, resolve } from 'node:path';
import {
  type I18nOptions,
  NG_RSPACK_SYMBOL_NAME,
  type NgRspackCompilation,
  type NormalizedAngularRspackPluginOptions,
} from '../models';
import { getLocaleBaseHref } from '../utils/get-locale-base-href';
import { addError, addWarning } from '../utils/rspack-diagnostics';
import { assertNever } from '../utils/misc-helpers';
import { rspackStatsLogger, statsErrorsToString } from '../utils/stats';
import { getStatsOptions } from '../config/config-utils/get-stats-options';

const PLUGIN_NAME = 'AngularRspackPlugin';
type ResolvedJavascriptTransformer = Parameters<typeof buildAndAnalyze>[2];

// A project-scoped directory under the Angular CLI cache directory, with an
// `angular-rspack` leaf so the state never collides with @angular/build's own
// cache for the same project.
function getPersistentCachePath(
  options: NormalizedAngularRspackPluginOptions
): string | undefined {
  if (!options.projectName) {
    return undefined;
  }
  // Same default gating as @angular/build's cache options: disk caching is
  // skipped in CI and in web containers.
  const ci = process.env['CI'];
  if (ci === '1' || ci?.toLowerCase() === 'true') {
    return undefined;
  }
  if (process.versions.webcontainer) {
    return undefined;
  }
  const { version } = createRequire(__filename)('@angular/build/package.json');
  return join(
    workspaceRoot,
    '.angular',
    'cache',
    version,
    options.projectName,
    'angular-rspack'
  );
}

export class AngularRspackPlugin implements RspackPluginInstance {
  #_options: NormalizedAngularRspackPluginOptions;
  #i18n: I18nOptions | undefined;
  #sourceFileCache: SourceFileCache;
  #javascriptTransformer: ResolvedJavascriptTransformer;
  // This will be defined in the apply method correctly
  #angularCompilation: AngularCompilation;
  #collectedStylesheetAssets: Array<{ path: string; text: string }> = [];
  // Latest bundled inputs per stylesheet, persisted across rebuilds since
  // only re-bundled stylesheets produce new results.
  #stylesheetMetafileInputsBySource = new Map<
    string,
    StylesheetMetafileInputs['inputs']
  >();
  #stylesheetMetafileInputs: StylesheetMetafileInputs['inputs'] = {};
  #collectedStylesheetMetafileInputs: StylesheetMetafileInputs[] = [];
  #useTypeScriptTranspilation = true;
  #initializationError: string | undefined;
  #emitError: string | undefined;

  constructor(
    options: NormalizedAngularRspackPluginOptions,
    i18nOptions?: I18nOptions
  ) {
    this.#_options = options;
    this.#i18n = i18nOptions;
    this.#sourceFileCache = new SourceFileCache(
      getPersistentCachePath(options)
    );
    this.#javascriptTransformer = new JavaScriptTransformer(
      {
        /**
         * Matches https://github.com/angular/angular-cli/blob/33ed6e875e509ebbaa0cbdb57be9e932f9915dff/packages/angular/build/src/tools/esbuild/angular/compiler-plugin.ts#L89
         * where pluginOptions.sourcemap is set https://github.com/angular/angular-cli/blob/61d98fde122468978de9b17bd79761befdbf2fac/packages/angular/build/src/tools/esbuild/compiler-plugin-options.ts#L34
         */
        sourcemap: !!(
          this.#_options.sourceMap.scripts &&
          (this.#_options.sourceMap.hidden ? 'external' : true)
        ),
        thirdPartySourcemaps: this.#_options.sourceMap.vendor,
        advancedOptimizations: this.#_options.advancedOptimizations,
        jit: !this.#_options.aot,
      },
      maxWorkers()
    ) as unknown as ResolvedJavascriptTransformer;
  }

  apply(compiler: Compiler) {
    const root = this.#_options.root;
    // Both of these are exclusive to each other - only one of them can be used at a time
    // But they will happen before the compiler is created - so we can use them to set up the parallel compilation once
    compiler.hooks.beforeRun.tapAsync(
      PLUGIN_NAME,
      async (compiler, callback) => {
        await this.setupCompilation(root, compiler.options.resolve.tsConfig);

        compiler.hooks.beforeCompile.tapAsync(
          PLUGIN_NAME,
          async (params, callback) => {
            await this.buildAndAnalyze();
            callback();
          }
        );

        callback();
      }
    );

    let currentWatchingModifiedFiles = new Set<string>();
    let watchRunInitialized = false;

    // Register compilation hook once - adds modified files to dependencies
    compiler.hooks.compilation.tap(PLUGIN_NAME + '_fileDeps', (compilation) => {
      currentWatchingModifiedFiles.forEach((file) => {
        compilation.fileDependencies.add(file);
      });
    });

    compiler.hooks.watchRun.tapAsync(
      PLUGIN_NAME,
      async (compiler, callback) => {
        if (!watchRunInitialized) {
          watchRunInitialized = true;
          compiler.hooks.beforeCompile.tapAsync(
            PLUGIN_NAME,
            async (params, callback) => {
              const watchingCompiler = compiler.watching?.compiler;
              const watchingModifiedFiles = new Set(
                watchingCompiler?.modifiedFiles
              );
              const removedFiles = new Set(watchingCompiler?.removedFiles);
              // Removed files invalidate the compilation like modified ones.
              const changedFiles = new Set([
                ...watchingModifiedFiles,
                ...removedFiles,
              ]);

              if (this.#angularCompilation) {
                this.#sourceFileCache.invalidate(changedFiles);
                this.#sourceFileCache.prune(removedFiles);
                for (const file of changedFiles) {
                  // Inline styles are keyed `<file>?class=...`; drop those
                  // along with the file's own entry.
                  for (const key of this.#stylesheetMetafileInputsBySource.keys()) {
                    if (key === file || key.startsWith(`${file}?`)) {
                      this.#stylesheetMetafileInputsBySource.delete(key);
                    }
                  }
                }
              }
              await this.setupCompilation(
                root,
                compiler.options.resolve.tsConfig,
                changedFiles.size > 0 ? changedFiles : undefined,
                true
              );

              await this.buildAndAnalyze();

              // Update shared state for compilation hook
              currentWatchingModifiedFiles = watchingModifiedFiles;

              callback();
            }
          );
        }

        callback();
      }
    );

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      // Surface a failed Angular compilation as a build error (like
      // @angular/build) instead of an exception that stalls the hooks chain.
      // Watch builds recover on the next rebuild's re-init.
      const angularCompilationError =
        this.#initializationError ?? this.#emitError;
      if (angularCompilationError) {
        addError(compilation, angularCompilationError);
      }

      // Handle errors thrown by loaders that prevent sealing (but ignore for watch mode)
      compilation.hooks.afterSeal.tapAsync(PLUGIN_NAME, (callback) => {
        if (!watchRunInitialized && compilation.errors.length > 0) {
          const stats = compilation.getStats();
          const compilationError = statsErrorsToString(
            stats.toJson(),
            getStatsOptions(this.#_options.verbose)
          );
          callback(new Error(compilationError));
        } else {
          callback();
        }
      });

      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        (assets) => {
          // Emit collected stylesheet assets
          if (this.#collectedStylesheetAssets.length > 0) {
            const { RawSource } = compiler.rspack.sources;

            for (const asset of this.#collectedStylesheetAssets) {
              // Normalize the asset path to ensure correct output location
              let assetPath = asset.path;

              // Extract just the media/filename part from the path
              const mediaMatch = assetPath.match(/media\/[^/]+$/);
              if (mediaMatch) {
                assetPath = mediaMatch[0];
              } else {
                // If not a media path, try to make it relative to the project root
                assetPath = assetPath.replace(/^\/+/, '');
                // Remove absolute path prefix if present
                const projectRootIndex = assetPath.lastIndexOf(
                  this.#_options.root
                );
                if (projectRootIndex >= 0) {
                  assetPath = assetPath.substring(
                    projectRootIndex + this.#_options.root.length + 1
                  );
                }
              }

              // Create the asset source
              const source = new RawSource(asset.text);

              // Emit the asset
              compilation.emitAsset(assetPath, source);
            }

            // Clear the collected assets after emission
            this.#collectedStylesheetAssets.length = 0;
          }

          for (const assetName in assets) {
            const asset = compilation.getAsset(assetName);
            if (!asset) {
              continue;
            }
            const assetHash = asset.info?.contenthash?.[0] ?? '';
            const assetNameWithoutHash = assetName.replace(`.${assetHash}`, '');
            if (assetNameWithoutHash !== 'main.js') {
              continue;
            }
            const originalSource = asset.source;
            let setLocaleContent = '';
            if (this.#i18n?.shouldInline) {
              // When inlining, a placeholder is used to allow the post-processing step to inject the $localize locale identifier.
              setLocaleContent +=
                '(globalThis.$localize ??= {}).locale = "___NG_LOCALE_INSERT___";\n';
            } else if (this.#i18n?.hasDefinedSourceLocale) {
              // If not inlining translations and source locale is defined, inject the locale specifier.
              setLocaleContent += `(globalThis.$localize ??= {}).locale = "${
                this.#i18n.sourceLocale
              }";\n`;
            }

            const concatLocaleSource = new sources.ConcatSource(
              setLocaleContent,
              originalSource
            );

            compilation.updateAsset(
              assetName,
              concatLocaleSource,
              (assetInfo) => assetInfo
            );
          }
        }
      );
    });

    compiler.hooks.emit.tapAsync(PLUGIN_NAME, async (compilation, callback) => {
      // Skip diagnostics when the Angular compilation failed to initialize:
      // there is no (or only stale) compilation state to diagnose and the
      // failure is already reported as a compilation error. After an emit
      // failure diagnostics still run since they usually carry the root
      // cause, matching @angular/build's application builder.
      try {
        if (!this.#_options.skipTypeChecking && !this.#initializationError) {
          const { errors, warnings } =
            await this.#angularCompilation.diagnoseFiles(DiagnosticModes.All);
          for (const error of errors ?? []) {
            compilation.errors.push({
              name: PLUGIN_NAME,
              message: error.text || '',
              file: error.location?.file,
              stack: error.text,
            });
          }
          for (const warning of warnings ?? []) {
            compilation.warnings.push({
              name: PLUGIN_NAME,
              message: warning.text || '',
              file: warning.location?.file,
              stack: warning.text,
            });
          }
        }
      } catch (error) {
        // A diagnostics failure must not leave the loader callback pending
        // and hang the build. Surface it as a build error instead.
        addError(
          compilation,
          `Angular diagnostics failed.\n${formatError(error)}`
        );
      }

      callback();
    });

    // Store compilation reference for budget checking in done hook
    let currentEmitCompilation: Compilation | undefined;

    compiler.hooks.afterEmit.tap(PLUGIN_NAME, (compilation) => {
      currentEmitCompilation = compilation;
    });

    // Register done hook once - checks budgets using stored compilation
    compiler.hooks.done.tap(PLUGIN_NAME + '_budgets', (statsValue) => {
      if (!currentEmitCompilation) return;

      const budgets = this.#_options.budgets;
      const isPlatformServer = Array.isArray(compiler.options.target)
        ? compiler.options.target.some(
            (target) => target === 'node' || target == 'async-node'
          )
        : compiler.options.target === 'node' ||
          compiler.options.target === 'async-node';

      // Early exit - skip expensive toJson() when budgets not needed
      if (!budgets?.length || isPlatformServer) {
        return;
      }

      // Only serialize what's needed for budget checking
      const stats = statsValue.toJson({
        all: false,
        assets: true,
        chunks: true,
      });

      const budgetFailures = [...checkBudgets(budgets, stats)];
      for (const { severity, message } of budgetFailures) {
        switch (severity) {
          case ThresholdSeverity.Warning:
            addWarning(currentEmitCompilation, {
              message,
              name: PLUGIN_NAME,
              hideStack: true,
            });
            break;
          case ThresholdSeverity.Error:
            addError(currentEmitCompilation, {
              message,
              name: PLUGIN_NAME,
              hideStack: true,
            });
            break;
          default:
            assertNever(severity);
        }
      }
    });

    compiler.hooks.afterDone.tap(PLUGIN_NAME, (stats) => {
      // Despite the typings, stats is undefined when the run fails before
      // producing stats (e.g. the afterSeal hook above fails the seal for a
      // build with errors). Rspack reports that failure itself.
      if (!stats) {
        return;
      }

      // Get stats options - merge defaults with user's config if provided
      const configStats = compiler.options.stats;
      const defaultStatsOptions = getStatsOptions(this.#_options.verbose);
      const statsOptions =
        typeof configStats === 'object' && configStats !== null
          ? { ...defaultStatsOptions, ...configStats }
          : defaultStatsOptions;

      rspackStatsLogger(stats, statsOptions);
      // Don't forcibly exit the process with errors when in watch mode
      if (!watchRunInitialized && stats.hasErrors()) {
        process.exit(1);
      }
    });

    // Dispose the shared component stylesheet bundler after a one-shot build so
    // its esbuild service (a child process and sockets, with @angular/build >=
    // 21.2.14) is released and `rspack build` can exit. Safe per-compiler: an
    // SSR build runs the server compiler after the browser one
    // (`dependencies: ['browser']`), never concurrently, and `setupCompilation`
    // lazily recreates the singleton if a later compiler needs it again. Watch
    // builds keep the bundler for incremental rebuilds and tear it down on
    // process shutdown instead.
    compiler.hooks.done.tapAsync(
      `${PLUGIN_NAME}_cleanup`,
      async (_stats, callback) => {
        if (!watchRunInitialized) {
          try {
            await disposeComponentStylesheetBundler();
          } catch {
            // Best-effort cleanup - never fail an otherwise successful build.
          }
        }
        callback();
      }
    );

    // Failed builds skip the done hook, so release the esbuild service here
    // too. The transformer closes only on shutdown: a per-build close would
    // tear down its worker pool on every watch rebuild. Both are idempotent.
    compiler.hooks.shutdown.tapAsync(
      `${PLUGIN_NAME}_cleanup`,
      async (callback) => {
        try {
          await this.#javascriptTransformer.close();
          await disposeComponentStylesheetBundler();
        } catch {
          // Best-effort cleanup that must never fail the compiler teardown.
        }
        callback();
      }
    );

    compiler.hooks.normalModuleFactory.tap(
      PLUGIN_NAME,
      (normalModuleFactory) => {
        normalModuleFactory.hooks.beforeResolve.tap(PLUGIN_NAME, (data) => {
          if (data.request.startsWith('angular:jit:')) {
            const path = data.request.split(';')[1];
            data.request = `${normalize(
              resolve(dirname(data.contextInfo.issuer), path)
            )}?raw`;
          }
        });
      }
    );

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      (compilation as NgRspackCompilation)[NG_RSPACK_SYMBOL_NAME] = () => ({
        javascriptTransformer: this
          .#javascriptTransformer as unknown as JavaScriptTransformer,
        typescriptFileCache: this.#sourceFileCache.typeScriptFileCache,
        babelFileCache: this.#sourceFileCache.babelFileCache,
        useTypeScriptTranspilation: this.#useTypeScriptTranspilation,
        angularCompilationFailed:
          this.#initializationError !== undefined ||
          this.#emitError !== undefined,
        stylesheetMetafileInputs: this.#stylesheetMetafileInputs,
        i18n: this.#i18n,
      });
    });

    if (this.#_options.serviceWorker) {
      compiler.hooks.done.tapAsync(
        PLUGIN_NAME,
        async (compilation, callback) => {
          let providedLocales = this.#_options.localize;
          if (!providedLocales) {
            await augmentAppWithServiceWorker(
              this.#_options.root,
              workspaceRoot,
              this.#_options.outputPath.browser,
              this.#_options.baseHref ?? '/',
              this.#_options.ngswConfigPath
            );
          } else if (providedLocales && this.#i18n) {
            if (typeof providedLocales === 'string') {
              providedLocales = [providedLocales];
            } else if (typeof providedLocales === 'boolean') {
              providedLocales = Array.from(this.#i18n.inlineLocales);
            }
            for (const locale of providedLocales) {
              await augmentAppWithServiceWorker(
                this.#_options.root,
                workspaceRoot,
                join(
                  this.#_options.outputPath.browser,
                  this.#i18n.locales[locale]?.subPath ?? locale
                ),
                getLocaleBaseHref(
                  this.#i18n,
                  locale,
                  this.#_options.baseHref
                ) ??
                  this.#_options.baseHref ??
                  '/',
                this.#_options.ngswConfigPath
              );
            }
          }

          callback();
        }
      );
    }
  }

  private async setupCompilation(
    root: string,
    tsConfig: RspackOptionsNormalized['resolve']['tsConfig'],
    modifiedFiles?: Set<string>,
    watch = false
  ) {
    this.#initializationError = undefined;
    this.#emitError = undefined;
    const tsconfigPath = tsConfig
      ? typeof tsConfig === 'string'
        ? tsConfig
        : tsConfig.configFile
      : this.#_options.tsConfig;
    try {
      const result = await setupCompilationWithAngularCompilation(
        {
          source: {
            tsconfigPath: tsconfigPath,
          },
        },
        {
          root,
          aot: this.#_options.aot,
          tsConfig: tsconfigPath,
          inlineStyleLanguage: this.#_options.inlineStyleLanguage,
          fileReplacements: this.#_options.fileReplacements,
          useTsProjectReferences: this.#_options.useTsProjectReferences,
          hasServer: this.#_options.hasServer,
          includePaths: this.#_options.stylePreprocessorOptions?.includePaths,
          sass: this.#_options.stylePreprocessorOptions?.sass,
          watch,
          sourceMap: this.#_options.sourceMap.scripts,
        },
        this.#sourceFileCache,
        this.#angularCompilation,
        modifiedFiles
      );
      this.#angularCompilation = result.angularCompilation;
      this.#collectedStylesheetAssets = result.collectedStylesheetAssets;
      this.#collectedStylesheetMetafileInputs =
        result.collectedStylesheetMetafileInputs ?? [];
      this.#useTypeScriptTranspilation =
        result.useTypeScriptTranspilation ?? true;
    } catch (error) {
      this.#initializationError = `Angular compilation initialization failed.\n${formatError(
        error
      )}`;
    }
  }

  private async buildAndAnalyze() {
    if (this.#initializationError) {
      return;
    }
    try {
      await buildAndAnalyze(
        this.#angularCompilation,
        this.#sourceFileCache.typeScriptFileCache,
        this.#javascriptTransformer
      );
    } catch (error) {
      this.#emitError = `Angular compilation emit failed.\n${formatError(
        error
      )}`;
    }
    this.#mergeStylesheetMetafileInputs();
  }

  // Fold this build's stylesheet bundling results into the persistent
  // per-stylesheet map and refresh the flattened view exposed to plugins.
  #mergeStylesheetMetafileInputs() {
    for (const { source, inputs } of this.#collectedStylesheetMetafileInputs) {
      this.#stylesheetMetafileInputsBySource.set(source, inputs);
    }
    const flattened: StylesheetMetafileInputs['inputs'] = {};
    for (const inputs of this.#stylesheetMetafileInputsBySource.values()) {
      Object.assign(flattened, inputs);
    }
    this.#stylesheetMetafileInputs = flattened;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}
