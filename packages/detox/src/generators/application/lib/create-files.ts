import {
  detectPackageManager,
  generateFiles,
  getPackageManagerCommand,
  offsetFromRoot,
  toJS,
  Tree,
} from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { join } from 'path';
import { NormalizedSchema } from './normalize-options';

export function createFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, join(__dirname, '../files/app'), options.e2eProjectRoot, {
    ...options,
    exec: getPackageManagerCommand(detectPackageManager(host.root)).exec,
    offsetFromRoot: offsetFromRoot(options.e2eProjectRoot),
    rootTsConfigPath: getRelativePathToRootTsConfig(
      host,
      options.e2eProjectRoot
    ),
  });
  if (options.js) {
    toJS(host);
  }
}
