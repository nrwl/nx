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
