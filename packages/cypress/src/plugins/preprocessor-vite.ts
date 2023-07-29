/**
 * https://github.com/mammadataei/cypress-vite
 *
 * MIT License
 *
 * Copyright (c) 2022 Mohammad Ataei
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 **/

import { dirname, basename, extname } from 'path';
import type { RollupOutput, RollupWatcher, WatcherOptions } from 'rollup';
import type { InlineConfig } from 'vite';

type CypressPreprocessor = (
  file: Record<string, any>
) => string | Promise<string>;

type BuildResult = RollupWatcher | RollupOutput | RollupOutput[];

const cache = new Map<string, string>();

/**
 * Use Vite as a file preprocess for Cypress test files.
 * This preprocessor shouldn't be used directly.
 * Instead, use the nxE2EPreset(__filename, { bundler: 'vite' }) function instead.
 */
function vitePreprocessor(userConfigPath?: string): CypressPreprocessor {
  return async (file) => {
    const { outputPath, filePath, shouldWatch } = file;

    if (cache.has(filePath)) {
      return cache.get(filePath);
    }

    const fileName = basename(outputPath);
    const filenameWithoutExtension = basename(outputPath, extname(outputPath));

    const defaultConfig: InlineConfig = {
      logLevel: 'silent',
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      },
      build: {
        emptyOutDir: false,
        minify: false,
        outDir: dirname(outputPath),
        sourcemap: true,
        write: true,
        watch: getWatcherConfig(shouldWatch),
        lib: {
          entry: filePath,
          fileName: () => fileName,
          formats: ['umd'],
          name: filenameWithoutExtension,
        },
      },
    };

    cache.set(filePath, outputPath);

    const { build } = require('vite');

    const watcher = (await build({
      configFile: userConfigPath,
      ...defaultConfig,
    })) as BuildResult;

    return new Promise((resolve, reject) => {
      if (shouldWatch && isWatcher(watcher)) {
        watcher.on('event', (event) => {
          if (event.code === 'END') {
            resolve(outputPath);
            file.emit('rerun');
          }

          if (event.code === 'ERROR') {
            console.error(event);
            reject(new Error(event.error.message));
          }
        });

        file.on('close', () => {
          cache.delete(filePath);
          watcher.close();
        });
      } else {
        resolve(outputPath);
      }
    });
  };
}

function isWatcher(maybeWatcher: any): maybeWatcher is RollupWatcher {
  return maybeWatcher.on !== undefined;
}

function getWatcherConfig(shouldWatch: boolean): WatcherOptions | null {
  return shouldWatch ? {} : null;
}

export default vitePreprocessor;
