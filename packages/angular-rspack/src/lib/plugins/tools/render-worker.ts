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
import {
  type BeastiesRuntime,
  type CriticalCssPlan,
  loadAngularBuildBeasties,
} from '../../utils/beasties';

export interface RenderOptions {
  /** The server index html the route renders into. */
  document: string;
  /** The `ngCspNonce` attribute value of the document. */
  nonce: string | undefined;
  /** The browser index file name, which prerendering "/" replaces. */
  indexFile: string;
  /**
   * Whether the build emits `index.original.html`, which prerendering "/"
   * must then not replace with the browser index.
   */
  emitsOriginalIndex: boolean;
  deployUrl: string;
  inlineCriticalCss: boolean;
  minifyCss: boolean;
  outputPath: string;
  serverBundlePath: string;
  route: string;
}

export interface RenderWorkerData {
  /**
   * The zone.js package loaded during worker initialization, or `false` for
   * zoneless applications.
   */
  zonePackage: string | false;
  /**
   * Set when critical CSS is inlined from compiled plans, which
   * `@angular/build` >= 22.2 does.
   */
  criticalCssPlans: CriticalCssPlan[] | undefined;
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

  /**
   * The main.server default export re-exported by the platform-server-exports
   * loader: a bootstrap function for standalone applications or the
   * AppServerModule class for NgModule ones. Server entries written for the
   * `@angular/ssr` application engine APIs export no default of their own.
   */
  __ngRspackMainServerBootstrap?:
    | (() => Promise<ApplicationRef>)
    | Type<unknown>;
}

interface InlineCriticalCssResult {
  content: string;
  warnings: string[];
  errors: string[];
}

interface LegacyInlineCriticalCssProcessorConstructor {
  new (options: { deployUrl: string; minify: boolean }): {
    process(
      html: string,
      options: { outputPath: string }
    ): Promise<InlineCriticalCssResult>;
  };
}

// The declarations are those of the installed @angular/build, which no
// longer export the processor, so its presence is checked at runtime.
function hasInlineCriticalCssProcessor(
  angularBuildPrivate: object
): angularBuildPrivate is {
  InlineCriticalCssProcessor: LegacyInlineCriticalCssProcessorConstructor;
} {
  return 'InlineCriticalCssProcessor' in angularBuildPrivate;
}

async function processCriticalCss(
  html: string,
  outputPath: string,
  deployUrl: string,
  minify: boolean
): Promise<InlineCriticalCssResult> {
  const angularBuildPrivate = await import('@angular/build/private');
  assert(
    hasInlineCriticalCssProcessor(angularBuildPrivate),
    'The installed "@angular/build" requires compiled critical CSS plans.'
  );
  const { InlineCriticalCssProcessor } = angularBuildPrivate;
  return new InlineCriticalCssProcessor({ deployUrl, minify }).process(html, {
    outputPath,
  });
}

const { zonePackage, criticalCssPlans } = workerData as RenderWorkerData;

let criticalCssProcessor:
  | ReturnType<BeastiesRuntime['createProcessor']>
  | undefined;
/** The warnings of the processor's current run. */
let criticalCssWarnings: string[] = [];

/**
 * Inlines critical CSS the way `@angular/ssr` >= 22.2 does when rendering,
 * from the plans `@angular/build` compiled.
 */
async function inlineCriticalCssFromPlans(
  html: string,
  plans: CriticalCssPlan[],
  nonce: string | undefined
): Promise<{ content: string; warnings: string[] }> {
  criticalCssProcessor ??= (
    await loadAngularBuildBeasties('runtime')
  ).createProcessor(plans, {
    preload: 'media-script',
    preloadFonts: true,
    inlineFonts: true,
    noscriptFallback: true,
    cache: true,
    logger: { warn: (message) => criticalCssWarnings.push(message) },
  });

  const warnings: string[] = (criticalCssWarnings = []);
  try {
    return { content: criticalCssProcessor.process(html, { nonce }), warnings };
  } catch (error) {
    // Like @angular/ssr, a failure leaves the page without critical CSS.
    warnings.push(
      `An error occurred while inlining critical CSS: ${
        error instanceof Error ? error.message : error
      }`
    );
    return { content: html, warnings };
  }
}

/**
 * Renders each route in routes and writes them to <outputPath>/<route>/index.html.
 */
async function render({
  document,
  nonce,
  indexFile,
  emitsOriginalIndex,
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

  // rspack emits a CommonJS server bundle; load with `require` so its named
  // exports resolve (a nodenext `import()` would leave them undefined).
  const {
    ɵSERVER_CONTEXT,
    AppServerModule,
    renderModule,
    renderApplication,
    default: defaultExport,
    __ngRspackMainServerBootstrap,
  } = require(serverBundlePath) as ServerBundleExports;
  const bootstrapAppFn = defaultExport ?? __ngRspackMainServerBootstrap;

  assert(
    ɵSERVER_CONTEXT,
    `ɵSERVER_CONTEXT was not exported from: ${serverBundlePath}.`
  );

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

  if (inlineCriticalCss && criticalCssPlans) {
    const { content, warnings } = await inlineCriticalCssFromPlans(
      html,
      criticalCssPlans,
      nonce
    );
    result.warnings = warnings;
    html = content;
  } else if (inlineCriticalCss) {
    const { content, warnings, errors } = await processCriticalCss(
      html,
      outputPath,
      deployUrl,
      minifyCss
    );
    result.errors = errors;
    result.warnings = warnings;
    html = content;
  }

  // This case happens when we are prerendering "/".
  if (browserIndexOutputPath === outputIndexPath && !emitsOriginalIndex) {
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
