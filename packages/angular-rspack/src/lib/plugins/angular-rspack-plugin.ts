import {
  Compiler,
  HtmlRspackPlugin,
  RspackOptionsNormalized,
  RspackPluginInstance,
} from '@rspack/core';
import {
  AngularRspackPluginOptions,
  NG_RSPACK_SYMBOL_NAME,
  NgRspackCompilation,
} from '../models';
import {
  maxWorkers,
  buildAndAnalyzeWithParallelCompilation,
  JavaScriptTransformer,
  setupCompilationWithParallelCompilation,
  DiagnosticModes,
} from '@nx/angular-rspack-compiler';
import { dirname, normalize, resolve } from 'path';
import fs_1 from 'fs';

const PLUGIN_NAME = 'AngularRspackPlugin';
type Awaited<T> = T extends Promise<infer U> ? U : T;
type ResolvedJavascriptTransformer = Parameters<
  typeof buildAndAnalyzeWithParallelCompilation
>[2];

export class AngularRspackPlugin implements RspackPluginInstance {
  #_options: AngularRspackPluginOptions;
  #typescriptFileCache: Map<string, string>;
  #javascriptTransformer: ResolvedJavascriptTransformer;
  // This will be defined in the apply method correctly
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  #angularCompilation: Awaited<
    ReturnType<typeof setupCompilationWithParallelCompilation>
  >;

  constructor(options: AngularRspackPluginOptions) {
    this.#_options = options;
    this.#typescriptFileCache = new Map<string, string>();
    this.#javascriptTransformer = new JavaScriptTransformer(
      {
        sourcemap: false,
        thirdPartySourcemaps: false,
        advancedOptimizations: true,
        jit: !this.#_options.aot,
      },
      maxWorkers()
    ) as unknown as ResolvedJavascriptTransformer;
  }

  apply(compiler: Compiler) {
    // Both of these are exclusive to each other - only one of them can be used at a time
    // But they will happen before the compiler is created - so we can use them to set up the parallel compilation once
    compiler.hooks.beforeRun.tapAsync(
      PLUGIN_NAME,
      async (compiler, callback) => {
        await this.setupCompilation(compiler.options.resolve.tsConfig);

        compiler.hooks.beforeCompile.tapAsync(
          PLUGIN_NAME,
          async (params, callback) => {
            await buildAndAnalyzeWithParallelCompilation(
              this.#angularCompilation,
              this.#typescriptFileCache,
              this.#javascriptTransformer
            );
            callback();
          }
        );

        compiler.hooks.done.tap(PLUGIN_NAME, (stats) => {
          if (stats.hasErrors() || stats.hasWarnings()) {
            setTimeout(() => {
              process.exit(stats.hasErrors() ? 1 : 0);
            }, 1000);
          }
        });

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
              await this.setupCompilation(compiler.options.resolve.tsConfig);
              await this.#angularCompilation.update(watchingModifiedFiles);

              await buildAndAnalyzeWithParallelCompilation(
                this.#angularCompilation,
                this.#typescriptFileCache,
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
      await this.#angularCompilation.close();
      await this.#javascriptTransformer.close();
      callback();
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
        typescriptFileCache: this.#typescriptFileCache,
      });
    });

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      const htmlRspackPluginHooks =
        HtmlRspackPlugin.getCompilationHooks(compilation);
      htmlRspackPluginHooks.beforeEmit.tap(PLUGIN_NAME, (data) => {
        const ngJsDispatchEvent = `<script type="text/javascript" id="ng-event-dispatch-contract">
                ${fs_1.readFileSync(
                  require.resolve(
                    '@angular/core/event-dispatch-contract.min.js'
                  ),
                  'utf-8'
                )}
                </script>`;
        data.html = data.html.replace('</body>', `${ngJsDispatchEvent}</body>`);
        return data;
      });
    });
  }

  private async setupCompilation(
    tsConfig: RspackOptionsNormalized['resolve']['tsConfig']
  ) {
    const tsconfigPath = tsConfig
      ? typeof tsConfig === 'string'
        ? tsConfig
        : tsConfig.configFile
      : this.#_options.tsConfig;
    this.#angularCompilation = await setupCompilationWithParallelCompilation(
      {
        source: {
          tsconfigPath: tsconfigPath,
        },
      },
      {
        root: this.#_options.root,
        aot: this.#_options.aot,
        tsConfig: tsconfigPath,
        inlineStyleLanguage: this.#_options.inlineStyleLanguage,
        fileReplacements: this.#_options.fileReplacements,
        useTsProjectReferences: this.#_options.useTsProjectReferences,
        hasServer: this.#_options.hasServer,
      }
    );
  }
}
