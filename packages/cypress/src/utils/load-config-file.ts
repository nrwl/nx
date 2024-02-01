import { extname } from 'path';
import { getRootTsConfigPath } from '@nx/js';
import { registerTsProject } from '@nx/js/src/internal';

export let dynamicImport = new Function(
  'modulePath',
  'return import(modulePath);'
);

export async function getCypressConfig(configFilePath: string): Promise<any> {
  let module: any;
  if (extname(configFilePath) === '.ts') {
    const tsConfigPath = getRootTsConfigPath();

    if (tsConfigPath) {
      const unregisterTsProject = registerTsProject(tsConfigPath);
      try {
        module = await dynamicImport(configFilePath);
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
