import { Compilation, type Compiler, RspackPluginInstance } from '@rspack/core';
import { augmentAppWithServiceWorker } from '@angular/build/private';
import { workspaceRoot } from '@nx/devkit';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
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
import { RenderOptions, RenderResult } from './tools/render-worker';
import { addError, addWarning } from '../utils/rspack-diagnostics';
import { assertIsError } from '../utils/misc-helpers';

class RoutesSet extends Set<string> {
  override add(value: string): this {
    return super.add(value.charAt(0) === '/' ? value.slice(1) : value);
  }
}

export class PrerenderPlugin implements RspackPluginInstance {
  #_options: NormalizedAngularRspackPluginOptions;
  #i18n: I18nOptions | undefined;

  constructor(
    options: NormalizedAngularRspackPluginOptions,
    i18nOptions?: I18nOptions
  ) {
    this.#_options = options;
    this.#i18n = i18nOptions;
  }

  apply(compiler: Compiler) {
    compiler.hooks.afterEmit.tapAsync(
      'Angular Rspack',
      async (compilation, callback) => {
        await this.#renderUniversal(compilation);
        callback();
      }
    );
  }

  async #renderUniversal(compilation: Compilation) {
    // Users can specify a different base html file e.g. "src/home.html"
    const indexFile = getIndexOutputFile(
      this.#_options.index as IndexExpandedDefinition
    );

    const zonePackage = require.resolve('zone.js', {
      paths: [workspaceRoot],
    });

    const worker = new WorkerPool({
      filename: require.resolve('./tools/render-worker'),
      maxThreads: maxWorkers(),
      workerData: {
        zonePackage,
      },
      recordTiming: false,
    });

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
          const results = (await Promise.all(
            routes.map((route) => {
              const options: RenderOptions = {
                indexFile,
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
          zonePackage: require.resolve('zone.js', { paths: [workspaceRoot] }),
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
}
