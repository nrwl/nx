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
    let currentModifiedFiles: ReadonlySet<string> | undefined;
    let currentRemovedFiles: ReadonlySet<string> | undefined;

    // Register compilation hook once - logs modified/removed files
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      const logger = compilation.getLogger(PLUGIN_NAME);
      if (currentModifiedFiles?.size) {
        logger.log(
          `Modified files:\n${[...currentModifiedFiles].join('\n')}\n`
        );
      }

      if (currentRemovedFiles?.size) {
        logger.log(`Removed files:\n${[...currentRemovedFiles].join('\n')}\n`);
      }
    });

    // Update shared state on each watch cycle
    compiler.hooks.watchRun.tap(
      PLUGIN_NAME,
      ({ modifiedFiles, removedFiles }) => {
        currentModifiedFiles = modifiedFiles;
        currentRemovedFiles = removedFiles;
      }
    );
  }
}
