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
    const configPathWithTimestamp = `${configFilePath}?t=${Date.now()}`;
    if (extname(configFilePath) === '.ts') {
      const tsConfigPath = getRootTsConfigPath();

      if (tsConfigPath) {
        const unregisterTsProject = registerTsProject(tsConfigPath);
        try {
          module = await dynamicImport(configPathWithTimestamp);
        } finally {
          unregisterTsProject();
        }
      } else {
        module = await dynamicImport(configPathWithTimestamp);
      }
    } else {
      module = await dynamicImport(configPathWithTimestamp);
    }
    return module.default ?? module;
  }
}

const packageInstallationDirectories = ['node_modules', '.yarn'];
