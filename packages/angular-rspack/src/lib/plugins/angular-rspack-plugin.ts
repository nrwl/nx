import {
  augmentAppWithServiceWorker,
  type BudgetCalculatorResult,
  checkBudgets,
  ThresholdSeverity,
} from '@angular/build/private';
import {
  buildAndAnalyze,
  DiagnosticModes,
  JavaScriptTransformer,
  SourceFileCache,
  maxWorkers,
  setupCompilationWithAngularCompilation,
  AngularCompilation,
} from '@nx/angular-rspack-compiler';
import { workspaceRoot } from '@nx/devkit';
import {
  type Compiler,
  type RspackOptionsNormalized,
  type RspackPluginInstance,
  sources,
} from '@rspack/core';
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
import { rspackStatsLogger } from '../utils/stats';
import { getStatsOptions } from '../config/config-utils/get-stats-options';

const PLUGIN_NAME = 'AngularRspackPlugin';
type ResolvedJavascriptTransformer = Parameters<typeof buildAndAnalyze>[2];

export class AngularRspackPlugin implements RspackPluginInstance {
  #_options: NormalizedAngularRspackPluginOptions;
  #i18n: I18nOptions | undefined;
  #sourceFileCache: SourceFileCache;
  #javascriptTransformer: ResolvedJavascriptTransformer;
  // This will be defined in the apply method correctly
  #angularCompilation: AngularCompilation;

  constructor(
    options: NormalizedAngularRspackPluginOptions,
    i18nOptions?: I18nOptions
  ) {
    this.#_options = options;
    this.#i18n = i18nOptions;
    this.#sourceFileCache = new SourceFileCache();
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
            await buildAndAnalyze(
              this.#angularCompilation,
              this.#sourceFileCache.typeScriptFileCache,
              this.#javascriptTransformer
            );
            callback();
          }
        );

        callback();
      }
    );

    compiler.hooks.watchRun.tapAsync(
      PLUGIN_NAME,
      async (compiler, callback) => {
        if (
          !compiler.hooks.beforeCompile.taps.some(
            (tap) => tap.name === PLUGIN_NAME
          )
        ) {
          compiler.hooks.beforeCompile.tapAsync(
            PLUGIN_NAME,
            async (params, callback) => {
              const watchingModifiedFiles = compiler.watching?.compiler
                ?.modifiedFiles
                ? new Set(compiler.watching.compiler.modifiedFiles)
                : new Set<string>();

              if (this.#angularCompilation) {
                this.#sourceFileCache.invalidate(watchingModifiedFiles);
              }
              await this.setupCompilation(
                root,
                compiler.options.resolve.tsConfig,
                watchingModifiedFiles.size > 0
                  ? watchingModifiedFiles
                  : undefined
              );

              await buildAndAnalyze(
                this.#angularCompilation,
                this.#sourceFileCache.typeScriptFileCache,
                this.#javascriptTransformer
              );
              compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
                watchingModifiedFiles.forEach((file) => {
                  compilation.fileDependencies.add(file);
                });
              });

              callback();
            }
          );
        }

        callback();
      }
    );

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        (assets) => {
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
      if (!this.#_options.skipTypeChecking) {
        const { errors, warnings } =
          await this.#angularCompilation.diagnoseFiles(DiagnosticModes.All);
        for (const error of errors ?? []) {
          compilation.errors.push({
            name: PLUGIN_NAME,
            message: error.text || '',
            file: error.location?.file,
            loc: `${error.location?.line}:${error.location?.column}`,
            moduleIdentifier: error.location?.file,
            stack: error.text,
          });
        }
        for (const warning of warnings ?? []) {
          compilation.warnings.push({
            name: PLUGIN_NAME,
            message: warning.text || '',
            file: warning.location?.file,
            loc: `${warning.location?.line}:${warning.location?.column}`,
            stack: warning.text,
            moduleIdentifier: warning.location?.file,
          });
        }
      }

      await this.#javascriptTransformer.close();
      callback();
    });

    compiler.hooks.afterEmit.tap(PLUGIN_NAME, (compilation) => {
      // Check for budget errors and display them to the user.
      const budgets = this.#_options.budgets;
      let budgetFailures: BudgetCalculatorResult[] | undefined;

      compiler.hooks.done.tap(PLUGIN_NAME, (statsValue) => {
        const stats = statsValue.toJson();
        const isPlatformServer = Array.isArray(compiler.options.target)
          ? compiler.options.target.some(
              (target) => target === 'node' || target == 'async-node'
            )
          : compiler.options.target === 'node' ||
            compiler.options.target === 'async-node';
        if (budgets?.length && !isPlatformServer) {
          budgetFailures = [...checkBudgets(budgets, stats)];
          for (const { severity, message } of budgetFailures) {
            switch (severity) {
              case ThresholdSeverity.Warning:
                addWarning(compilation, {
                  message,
                  name: PLUGIN_NAME,
                  hideStack: true,
                });
                break;
              case ThresholdSeverity.Error:
                addError(compilation, {
                  message,
                  name: PLUGIN_NAME,
                  hideStack: true,
                });
                break;
              default:
                assertNever(severity);
            }
          }
        }
      });
      compiler.hooks.afterDone.tap(PLUGIN_NAME, (stats) => {
        rspackStatsLogger(stats, getStatsOptions(this.#_options.verbose));
        if (stats.hasErrors()) {
          process.exit(1);
        }
      });
    });

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
    modifiedFiles?: Set<string>
  ) {
    const tsconfigPath = tsConfig
      ? typeof tsConfig === 'string'
        ? tsConfig
        : tsConfig.configFile
      : this.#_options.tsConfig;
    this.#angularCompilation = await setupCompilationWithAngularCompilation(
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
      },
      this.#sourceFileCache,
      this.#angularCompilation,
      modifiedFiles
    );
  }
}
