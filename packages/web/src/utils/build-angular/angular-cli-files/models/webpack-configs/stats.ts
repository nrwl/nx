/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { WebpackConfigOptions } from '../build-options';

const webpackOutputOptions = {
  colors: true,
  hash: true, // required by custom stat output
  timings: true, // required by custom stat output
  chunks: true, // required by custom stat output
  chunkModules: false,
  children: false, // listing all children is very noisy in AOT and hides warnings/errors
  modules: false,
  reasons: false,
  warnings: true,
  errors: true,
  assets: true, // required by custom stat output
  version: false,
  errorDetails: false,
  moduleTrace: false,
};

const verboseWebpackOutputOptions = {
  // The verbose output will most likely be piped to a file, so colors just mess it up.
  colors: false,
  usedExports: true,
  maxModules: Infinity,
  optimizationBailout: true,
  reasons: true,
  children: true,
  assets: true,
  version: true,
  chunkModules: true,
  errorDetails: true,
  moduleTrace: true,
};

export function getWebpackStatsConfig(verbose = false) {
  return verbose
    ? Object.assign(webpackOutputOptions, verboseWebpackOutputOptions)
    : webpackOutputOptions;
}

export function getStatsConfig(wco: WebpackConfigOptions) {
  const verbose = !!wco.buildOptions.verbose;

  return { stats: getWebpackStatsConfig(verbose) };
}
