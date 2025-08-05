/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import type { Compiler, RspackPluginInstance } from '@rspack/core';

const PLUGIN_NAME = 'AngularRspackWatchFilesLogsPlugin';

export class WatchFilesLogsPlugin implements RspackPluginInstance {
  apply(compiler: Compiler) {
    compiler.hooks.watchRun.tap(
      PLUGIN_NAME,
      ({ modifiedFiles, removedFiles }) => {
        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
          const logger = compilation.getLogger(PLUGIN_NAME);
          if (modifiedFiles?.size) {
            logger.log(`Modified files:\n${[...modifiedFiles].join('\n')}\n`);
          }

          if (removedFiles?.size) {
            logger.log(`Removed files:\n${[...removedFiles].join('\n')}\n`);
          }
        });
      }
    );
  }
}
