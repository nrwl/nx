import { extname } from 'path';
import { getRootTsConfigPath } from '@nx/js';
import { registerTsProject } from '@nx/js/src/internal';

import type { PlaywrightTestConfig } from '@playwright/test';

export let dynamicImport = new Function(
  'modulePath',
  'return import(modulePath);'
);

export async function loadPlaywrightConfig(
  configFilePath
): Promise<PlaywrightTestConfig> {
  {
    let module: any;
    if (extname(configFilePath) === '.ts') {
      const tsConfigPath = getRootTsConfigPath();

      if (tsConfigPath) {
        const unregisterTsProject = registerTsProject(tsConfigPath);
        try {
          // Require's cache doesn't notice when the file is updated, and
          // this function is ran during daemon operation. If the config file
          // is updated, we need to read its new contents, so we need to clear the cache.
          // We can't just delete the cache entry for the config file, because
          // it might have imports that need to be updated as well.
          clearRequireCache();
          // ts-node doesn't support dynamic import, so we need to use require
          module = require(configFilePath);
        } finally {
          unregisterTsProject();
        }
      } else {
        module = await dynamicImport(configFilePath);
      }
    } else {
      module = await dynamicImport(configFilePath);
    }
    return module.default ?? module;
  }
}

const packageInstallationDirectories = ['node_modules', '.yarn'];

function clearRequireCache() {
  Object.keys(require.cache).forEach((key: string) => {
    // We don't want to clear the require cache of installed packages.
    // Clearing them can cause some issues when running Nx without the daemon
    // and may cause issues for other packages that use the module state
    // in some to store cached information.
    if (!packageInstallationDirectories.some((dir) => key.includes(dir))) {
      delete require.cache[key];
    }
  });
}
