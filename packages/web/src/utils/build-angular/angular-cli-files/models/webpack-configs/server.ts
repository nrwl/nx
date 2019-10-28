/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isAbsolute } from 'path';
import { Configuration } from 'webpack';
import { WebpackConfigOptions } from '../build-options';
import { getSourceMapDevTool } from './utils';

/**
 * Returns a partial specific to creating a bundle for node
 * @param wco Options which are include the build options and app config
 */
export function getServerConfig(wco: WebpackConfigOptions): Configuration {
  const extraPlugins = [];
  if (wco.buildOptions.sourceMap) {
    const { scripts, styles, hidden } = wco.buildOptions.sourceMap;

    extraPlugins.push(getSourceMapDevTool(scripts || false, styles || false, hidden || false));
  }

  const config: Configuration = {
    resolve: {
      mainFields: [...(wco.supportES2015 ? ['es2015'] : []), 'main', 'module'],
    },
    target: 'node',
    output: {
      libraryTarget: 'commonjs',
    },
    plugins: extraPlugins,
    node: false,
  };

  if (wco.buildOptions.bundleDependencies == 'none') {
    config.externals = [
      /^@angular/,
      (context: string, request: string, callback: (error?: null, result?: string) => void) => {
        // Absolute & Relative paths are not externals
        if (/^\.{0,2}\//.test(request) || isAbsolute(request)) {
          return callback();
        }

        try {
          require.resolve(request);
          callback(null, request);
        } catch {
          // Node couldn't find it, so it must be user-aliased
          callback();
        }
      },
    ];
  }

  return config;
}
