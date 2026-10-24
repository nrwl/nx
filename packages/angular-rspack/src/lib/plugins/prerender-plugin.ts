import { Compilation, type Compiler, RspackPluginInstance } from '@rspack/core';
import { augmentAppWithServiceWorker } from '@angular/build/private';
import { workspaceRoot } from '@nx/devkit';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import assert from 'assert';
import {
  type I18nOptions,
  IndexExpandedDefinition,
  NormalizedAngularRspackPluginOptions,
} from '../models';
import { getIndexOutputFile } from '../utils/index-file/get-index-output-file';
import { WorkerPool } from './tools/worker-pool';
import { maxWorkers } from '../utils/max-workers';
import { ensureOutputPaths, getLocaleOutputPaths } from '../utils/i18n';
import type {
  RenderOptions,
  RenderResult,
  RenderWorkerData,
} from './tools/render-worker';
import { addError, addWarning } from '../utils/rspack-diagnostics';
import { assertIsError } from '../utils/misc-helpers';
import {
  emitsServerIndexAsOriginal,
  type ServerRenderingInputs,
  type SharedServerRenderingInputs,
} from './index-html-plugin';

class RoutesSet extends Set<string> {
  override add(value: string): this {
    return super.add(value.charAt(0) === '/' ? value.slice(1) : value);
  }
}

export class PrerenderPlugin implements RspackPluginInstance {
  #_options: NormalizedAngularRspackPluginOptions;
  #i18n: I18nOptions | undefined;
  #serverRenderingInputs: SharedServerRenderingInputs | undefined;

  constructor(
    options: NormalizedAngularRspackPluginOptions,
    i18nOptions?: I18nOptions,
    serverRenderingInputs?: SharedServerRenderingInputs
  ) {
    this.#_options = options;
    this.#i18n = i18nOptions;
    this.#serverRenderingInputs = serverRenderingInputs;
  }

  apply(compiler: Compiler) {
    compiler.hooks.afterEmit.tapAsync(
      'Angular Rspack',
      async (compilation, callback) => {
        const inputs = this.#serverRenderingInputs?.current;
        if (!inputs) {
          addError(
            compilation,
            'Could not prerender because the browser build did not generate the index html.'
          );
          callback();
          return;
        }

        const prerenderedRoutes = new Set<string>();
        if (this.#_options.appShell) {
          await this.#prerenderAppShell(compilation, inputs);
          prerenderedRoutes.add('/');
        }
        if (this.#_options.prerender) {
          for (const route of await this.#prerenderSSGUniversal(
            compilation,
            inputs
          )) {
            // RoutesSet stores routes without the leading slash; the manifest
            // keys carry it, matching the esbuild application builder.
            prerenderedRoutes.add(`/${route}`);
          }
        }
        await this.#writePrerenderedRoutesManifest(
          compilation,
          prerenderedRoutes
        );
        callback();
      }
    );
  }

  /**
   * Overwrites the empty `prerendered-routes.json` emitted at the output root
   * by the browser compiler with the routes that were prerendered.
   */
  async #writePrerenderedRoutesManifest(
    compilation: Compilation,
    prerenderedRoutes: Set<string>
  ): Promise<void> {
    // fromEntries keeps a route literally named "__proto__" an own key.
    const routes = Object.fromEntries(
      [...prerenderedRoutes].sort().map((route) => [route, {}])
    );

    try {
      await writeFile(
        join(this.#_options.outputPath.base, 'prerendered-routes.json'),
        JSON.stringify({ routes }, null, 2)
      );
    } catch (error) {
      assertIsError(error);
      addError(compilation, error.message);
    }
  }

  async #prerenderAppShell(
    compilation: Compilation,
    inputs: ServerRenderingInputs
  ) {
    // Users can specify a different base html file e.g. "src/home.html"
    const indexFile = getIndexOutputFile(
      this.#_options.index as IndexExpandedDefinition
    );

    const worker = this.#createRenderWorkerPool(inputs);

    try {
      const outputPaths = this.#i18n
        ? ensureOutputPaths(this.#_options.outputPath.browser, this.#i18n)
        : new Map([['', this.#_options.outputPath.browser]]);
      const localeOutputPaths = this.#i18n
        ? getLocaleOutputPaths(this.#i18n)
        : new Map();
      for (const [locale, outputPath] of outputPaths.entries()) {
        const normalizedOutputPath = join(
          this.#_options.outputPath.browser,
          outputPath
        );
        const serverBundlePath = locale
          ? join(
              this.#_options.outputPath.server,
              localeOutputPaths.get(locale),
              'server.js'
            )
          : join(this.#_options.outputPath.server, 'server.js');

        if (!existsSync(serverBundlePath)) {
          throw new Error(
            `Could not find the main bundle: ${serverBundlePath}`
          );
        }

        try {
          const options: RenderOptions = {
            ...this.#getDocumentRenderOptions(inputs, locale),
            indexFile,
            emitsOriginalIndex: emitsServerIndexAsOriginal(
              this.#_options.index as IndexExpandedDefinition
            ),
            deployUrl: this.#_options.deployUrl || '',
            inlineCriticalCss:
              !!this.#_options.optimization.styles.inlineCritical,
            minifyCss: !!this.#_options.optimization.styles.minify,
            outputPath: normalizedOutputPath,
            route: '/',
            serverBundlePath,
          };

          const { errors, warnings } = await worker.run(options);
          errors?.forEach((e) => addError(compilation, e));
          warnings?.forEach((e) => addWarning(compilation, e));
        } catch (error) {
          assertIsError(error);
          addError(compilation, error.message);
        }

        if (this.#_options.serviceWorker && this.#_options.ngswConfigPath) {
          try {
            await augmentAppWithServiceWorker(
              this.#_options.root,
              workspaceRoot,
              outputPath,
              this.#_options.baseHref || '/',
              this.#_options.ngswConfigPath
            );
          } catch (error) {
            assertIsError(error);
            addError(compilation, error.message);
          }
        }
      }
    } catch (error) {
      assertIsError(error);
      addError(compilation, error.message);
    } finally {
      void worker.destroy();
    }
  }

  async #prerenderSSGUniversal(
    compilation: Compilation,
    inputs: ServerRenderingInputs
  ): Promise<string[]> {
    // Users can specify a different base html file e.g. "src/home.html"
    const indexFile = getIndexOutputFile(
      this.#_options.index as IndexExpandedDefinition
    );

    const worker = this.#createRenderWorkerPool(inputs);

    let routes: string[] | undefined;

    try {
      const outputPaths = this.#i18n
        ? ensureOutputPaths(this.#_options.outputPath.browser, this.#i18n)
        : new Map([['', this.#_options.outputPath.browser]]);
      const localeOutputPaths = this.#i18n
        ? getLocaleOutputPaths(this.#i18n)
        : new Map();
      for (const [locale, outputPath] of outputPaths.entries()) {
        const normalizedOutputPath = join(
          this.#_options.outputPath.browser,
          outputPath
        );
        const serverBundlePath = locale
          ? join(
              this.#_options.outputPath.server,
              localeOutputPaths.get(locale),
              'server.js'
            )
          : join(this.#_options.outputPath.server, 'server.js');

        if (!existsSync(serverBundlePath)) {
          throw new Error(
            `Could not find the main bundle: ${serverBundlePath}`
          );
        }

        routes ??= await this.#getRoutes(
          indexFile,
          normalizedOutputPath,
          serverBundlePath,
          workspaceRoot
        );

        try {
          const documentRenderOptions = this.#getDocumentRenderOptions(
            inputs,
            locale
          );
          const emitsOriginalIndex = emitsServerIndexAsOriginal(
            this.#_options.index as IndexExpandedDefinition
          );
          const results = (await Promise.all(
            routes.map((route) => {
              const options: RenderOptions = {
                ...documentRenderOptions,
                indexFile,
                emitsOriginalIndex,
                deployUrl: this.#_options.deployUrl || '',
                inlineCriticalCss:
                  !!this.#_options.optimization.styles.inlineCritical,
                minifyCss: !!this.#_options.optimization.styles.minify,
                outputPath: normalizedOutputPath,
                route,
                serverBundlePath,
              };

              return worker.run(options);
            })
          )) as RenderResult[];

          for (const { errors, warnings } of results) {
            errors?.forEach((e) => addError(compilation, e));
            warnings?.forEach((e) => addWarning(compilation, e));
          }
        } catch (error) {
          assertIsError(error);
          addError(compilation, error.message);
        }

        if (this.#_options.serviceWorker && this.#_options.ngswConfigPath) {
          try {
            await augmentAppWithServiceWorker(
              this.#_options.root,
              workspaceRoot,
              outputPath,
              this.#_options.baseHref || '/',
              this.#_options.ngswConfigPath
            );
          } catch (error) {
            assertIsError(error);
            addError(compilation, error.message);
          }
        }
      }
    } finally {
      void worker.destroy();
    }

    return routes ?? [];
  }

  async #getRoutes(
    indexFile: string,
    outputPath: string,
    serverBundlePath: string,
    workspaceRoot: string
  ): Promise<string[]> {
    const {
      routes: extraRoutes = [],
      routesFile,
      discoverRoutes,
    } = this.#normalizePrerenderOptions();
    const routes = new RoutesSet(extraRoutes);

    if (routesFile) {
      const routesFromFile = (
        await readFile(join(workspaceRoot, routesFile), 'utf8')
      ).split(/\r?\n/);
      for (const route of routesFromFile) {
        routes.add(route);
      }
    }

    if (discoverRoutes) {
      const renderWorker = new WorkerPool({
        filename: require.resolve('./tools/routes-extractor-worker'),
        maxThreads: maxWorkers(),
        workerData: {
          indexFile,
          outputPath,
          serverBundlePath,
          zonePackage: this.#resolveZonePackage(workspaceRoot),
        },
        recordTiming: false,
      });

      const extractedRoutes: string[] = await renderWorker
        .run({})
        .finally(() => void renderWorker.destroy());

      for (const route of extractedRoutes) {
        routes.add(route);
      }
    }

    if (routes.size === 0) {
      throw new Error('Could not find any routes to prerender.');
    }

    return [...routes];
  }

  #normalizePrerenderOptions() {
    assert(this.#_options.prerender, 'Prerendering is not enabled.');
    if (typeof this.#_options.prerender === 'boolean') {
      return {
        routes: [],
        routesFile: undefined,
        discoverRoutes: true,
      };
    }

    return this.#_options.prerender;
  }

  #createRenderWorkerPool(inputs: ServerRenderingInputs): WorkerPool {
    return new WorkerPool({
      filename: require.resolve('./tools/render-worker'),
      maxThreads: maxWorkers(),
      workerData: {
        zonePackage: this.#resolveZonePackage(workspaceRoot),
        criticalCssPlans: inputs.criticalCssPlans,
      } satisfies RenderWorkerData,
      recordTiming: false,
    });
  }

  #getDocumentRenderOptions(
    inputs: ServerRenderingInputs,
    locale: string
  ): Pick<RenderOptions, 'document' | 'nonce'> {
    const indexHtml = inputs.indexHtml.get(locale);
    if (!indexHtml) {
      throw new Error(
        `Could not find the index html generated for the "${locale}" locale.`
      );
    }
    return { document: indexHtml.server, nonce: indexHtml.nonce };
  }

  #resolveZonePackage(workspaceRoot: string): string | false {
    if (this.#_options.zoneless) return false;
    return require.resolve('zone.js', { paths: [workspaceRoot] });
  }
}
