// Adapted from: https://github.com/mammadataei/cypress-vite

import * as path from 'path';
import type { RollupOutput, RollupWatcher, WatcherOptions } from 'rollup';

type CypressPreprocessor = (
  file: Record<string, any>
) => string | Promise<string>;

/**
 * Cypress preprocessor for running e2e tests using vite.
 *
 * @param {string} userConfigPath
 * @example
 * setupNodeEvents(on) {
 *   on(
 *     'file:preprocessor',
 *     vitePreprocessor(path.resolve(__dirname, './vite.config.ts')),
 *   )
 * },
 */
function vitePreprocessor(userConfigPath?: string): CypressPreprocessor {
  return async (file) => {
    const { outputPath, filePath, shouldWatch } = file;

    const fileName = path.basename(outputPath);
    const filenameWithoutExtension = path.basename(
      outputPath,
      path.extname(outputPath)
    );

    const defaultConfig = {
      logLevel: 'silent',
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      },
      build: {
        emptyOutDir: false,
        minify: false,
        outDir: path.dirname(outputPath),
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
    const { build } = require('vite');

    const watcher = await build({
      configFile: userConfigPath,
      ...defaultConfig,
    });

    if (shouldWatch && isWatcher(watcher)) {
      watcher.on('event', (event) => {
        if (event.code === 'END') {
          file.emit('rerun');
        }

        if (event.code === 'ERROR') {
          console.error(event);
        }
      });

      file.on('close', () => {
        watcher.close();
      });
    }

    return outputPath;
  };
}

function getWatcherConfig(shouldWatch: boolean): WatcherOptions | null {
  return shouldWatch ? {} : null;
}

type BuildResult = RollupWatcher | RollupOutput | RollupOutput[];

function isWatcher(watcher: BuildResult): watcher is RollupWatcher {
  return (watcher as RollupWatcher).on !== undefined;
}

export default vitePreprocessor;
