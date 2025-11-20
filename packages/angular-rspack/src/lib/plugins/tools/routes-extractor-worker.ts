/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import type { ApplicationRef, Type } from '@angular/core';
import type { ɵgetRoutesFromAngularRouterConfig } from '@angular/ssr';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { workerData } from 'node:worker_threads';

export interface RoutesExtractorWorkerData {
  zonePackage: string | false;
  indexFile: string;
  outputPath: string;
  serverBundlePath: string;
}

interface ServerBundleExports {
  /** NgModule to render. */
  AppServerModule?: Type<unknown>;

  /** Standalone application bootstrapping function. */
  default?: (() => Promise<ApplicationRef>) | Type<unknown>;

  /** Method to extract routes from the router config. */
  ɵgetRoutesFromAngularRouterConfig: typeof ɵgetRoutesFromAngularRouterConfig;
}

const { zonePackage, serverBundlePath, outputPath, indexFile } =
  workerData as RoutesExtractorWorkerData;

async function extract(): Promise<string[]> {
  const {
    AppServerModule,
    ɵgetRoutesFromAngularRouterConfig: getRoutesFromAngularRouterConfig,
    default: bootstrapAppFn,
  } = (await import(serverBundlePath)) as ServerBundleExports;

  const browserIndexInputPath = path.join(outputPath, indexFile);
  const document = await fs.promises.readFile(browserIndexInputPath, 'utf8');

  const bootstrapAppFnOrModule = bootstrapAppFn || AppServerModule;
  assert(
    bootstrapAppFnOrModule,
    `The file "${serverBundlePath}" does not have a default export for an AppServerModule or a bootstrapping function.`
  );

  const routes: string[] = [];
  const { routes: extractRoutes } = await getRoutesFromAngularRouterConfig(
    bootstrapAppFnOrModule,
    document,
    new URL('http://localhost')
  );

  for (const { route, redirectTo } of extractRoutes) {
    if (redirectTo === undefined && !/[:*]/.test(route)) {
      routes.push(route);
    }
  }

  return routes;
}

/**
 * Initializes the worker when it is first created by loading the Zone.js package
 * into the worker instance.
 *
 * @returns A promise resolving to the extract function of the worker.
 */
async function initialize() {
  // Setup Zone.js
  if (zonePackage) {
    await import(zonePackage);
  }

  return extract;
}

/**
 * The default export will be the promise returned by the initialize function.
 * This is awaited by piscina prior to using the Worker.
 */
export default initialize();
