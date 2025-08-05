/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import type { ApplicationRef, StaticProvider, Type } from '@angular/core';
import type {
  renderApplication,
  renderModule,
  ɵSERVER_CONTEXT,
} from '@angular/platform-server';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { workerData } from 'node:worker_threads';

export interface RenderOptions {
  indexFile: string;
  deployUrl: string;
  inlineCriticalCss: boolean;
  minifyCss: boolean;
  outputPath: string;
  serverBundlePath: string;
  route: string;
}

export interface RenderResult {
  errors?: string[];
  warnings?: string[];
}

interface ServerBundleExports {
  /** An internal token that allows providing extra information about the server context. */
  ɵSERVER_CONTEXT?: typeof ɵSERVER_CONTEXT;

  /** Render an NgModule application. */
  renderModule?: typeof renderModule;

  /** NgModule to render. */
  AppServerModule?: Type<unknown>;

  /** Method to render a standalone application. */
  renderApplication?: typeof renderApplication;

  /** Standalone application bootstrapping function. */
  default?: (() => Promise<ApplicationRef>) | Type<unknown>;
}

/**
 * The fully resolved path to the zone.js package that will be loaded during worker initialization.
 * This is passed as workerData when setting up the worker via the `piscina` package.
 */
const { zonePackage } = workerData as {
  zonePackage: string | false;
};

/**
 * Renders each route in routes and writes them to <outputPath>/<route>/index.html.
 */
async function render({
  indexFile,
  deployUrl,
  minifyCss,
  outputPath,
  serverBundlePath,
  route,
  inlineCriticalCss,
}: RenderOptions): Promise<RenderResult> {
  const result = {} as RenderResult;
  const browserIndexOutputPath = path.join(outputPath, indexFile);
  const outputFolderPath = path.join(outputPath, route);
  const outputIndexPath = path.join(outputFolderPath, 'index.html');

  const {
    ɵSERVER_CONTEXT,
    AppServerModule,
    renderModule,
    renderApplication,
    default: bootstrapAppFn,
  } = (await import(serverBundlePath)) as ServerBundleExports;

  assert(
    ɵSERVER_CONTEXT,
    `ɵSERVER_CONTEXT was not exported from: ${serverBundlePath}.`
  );

  const indexBaseName = fs.existsSync(
    path.join(outputPath, 'index.original.html')
  )
    ? 'index.original.html'
    : indexFile;
  const browserIndexInputPath = path.join(outputPath, indexBaseName);
  const document = await fs.promises.readFile(browserIndexInputPath, 'utf8');

  const platformProviders: StaticProvider[] = [
    {
      provide: ɵSERVER_CONTEXT,
      useValue: 'ssg',
    },
  ];

  let html: string;

  // Render platform server module
  if (isBootstrapFn(bootstrapAppFn)) {
    assert(
      renderApplication,
      `renderApplication was not exported from: ${serverBundlePath}.`
    );

    html = await renderApplication(bootstrapAppFn, {
      document,
      url: route,
      platformProviders,
    });
  } else {
    assert(
      renderModule,
      `renderModule was not exported from: ${serverBundlePath}.`
    );

    const moduleClass = bootstrapAppFn || AppServerModule;
    assert(
      moduleClass,
      `Neither an AppServerModule nor a bootstrapping function was exported from: ${serverBundlePath}.`
    );

    html = await renderModule(moduleClass, {
      document,
      url: route,
      extraProviders: platformProviders,
    });
  }

  if (inlineCriticalCss) {
    const { InlineCriticalCssProcessor } = await import(
      '@angular/build/private'
    );

    const inlineCriticalCssProcessor = new InlineCriticalCssProcessor({
      deployUrl: deployUrl,
      minify: minifyCss,
    });

    const { content, warnings, errors } =
      await inlineCriticalCssProcessor.process(html, {
        outputPath,
      });
    result.errors = errors;
    result.warnings = warnings;
    html = content;
  }

  // This case happens when we are prerendering "/".
  if (browserIndexOutputPath === outputIndexPath) {
    const browserIndexOutputPathOriginal = path.join(
      outputPath,
      'index.original.html'
    );
    fs.renameSync(browserIndexOutputPath, browserIndexOutputPathOriginal);
  }

  fs.mkdirSync(outputFolderPath, { recursive: true });
  fs.writeFileSync(outputIndexPath, html);

  return result;
}

function isBootstrapFn(value: unknown): value is () => Promise<ApplicationRef> {
  // We can differentiate between a module and a bootstrap function by reading compiler-generated `ɵmod` static property:
  return typeof value === 'function' && !('ɵmod' in value);
}

/**
 * Initializes the worker when it is first created by loading the Zone.js package
 * into the worker instance.
 *
 * @returns A promise resolving to the render function of the worker.
 */
async function initialize() {
  // Setup Zone.js
  if (zonePackage) {
    await import(zonePackage);
  }

  // Return the render function for use
  return render;
}

/**
 * The default export will be the promise returned by the initialize function.
 * This is awaited by piscina prior to using the Worker.
 */
export default initialize();
