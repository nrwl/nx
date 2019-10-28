/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { resolve } from 'path';
import { Configuration } from 'webpack';
import { WebpackConfigOptions } from '../build-options';
import { getTypescriptWorkerPlugin } from './typescript';

const WorkerPlugin = require('worker-plugin');


export function getWorkerConfig(wco: WebpackConfigOptions): Configuration {
  const { buildOptions } = wco;

  if (!buildOptions.webWorkerTsConfig) {
    return {};
  }

  if (typeof buildOptions.webWorkerTsConfig != 'string') {
    throw new Error('The `webWorkerTsConfig` must be a string.');
  }

  const workerTsConfigPath = resolve(wco.root, buildOptions.webWorkerTsConfig);

  return {
    plugins: [new WorkerPlugin({
      globalObject: false,
      plugins: [getTypescriptWorkerPlugin(wco, workerTsConfigPath)],
    })],
  };
}
