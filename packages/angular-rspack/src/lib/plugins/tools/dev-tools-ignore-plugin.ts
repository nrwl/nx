/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { Compilation, Compiler, RspackPluginInstance } from '@rspack/core';

// Following the naming conventions from
// https://sourcemaps.info/spec.html#h.ghqpj1ytqjbm
const IGNORE_LIST = 'x_google_ignoreList';

const PLUGIN_NAME = 'devtools-ignore-plugin';

interface SourceMap {
  sources: string[];
  [IGNORE_LIST]: number[];
}

/**
 * This plugin adds a field to source maps that identifies which sources are
 * vendored or runtime-injected (aka third-party) sources. These are consumed by
 * Chrome DevTools to automatically ignore-list sources.
 */
export class DevToolsIgnorePlugin implements RspackPluginInstance {
  apply(compiler: Compiler) {
    const { RawSource } = compiler.rspack.sources;

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING,
        },
        (assets) => {
          for (const [name, asset] of Object.entries(assets)) {
            // Instead of using `asset.map()` to fetch the source maps from
            // SourceMapSource assets, process them directly as a RawSource.
            // This is because `.map()` is slow and can take several seconds.
            if (!name.endsWith('.map')) {
              // Ignore non source map files.
              continue;
            }

            const mapContent = asset.source().toString();
            if (!mapContent) {
              continue;
            }

            const map = JSON.parse(mapContent) as SourceMap;
            const ignoreList: number[] = [];

            for (const [index, path] of map.sources.entries()) {
              if (
                path.includes('/node_modules/') ||
                path.startsWith('webpack/') ||
                path.startsWith('rspack/')
              ) {
                ignoreList.push(index);
              }
            }

            map[IGNORE_LIST] = ignoreList;
            compilation.updateAsset(name, new RawSource(JSON.stringify(map)));
          }
        }
      );
    });
  }
}
