import { generateFiles, offsetFromRoot, toJS, Tree } from '@nrwl/devkit';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { join } from 'path';
import { NormalizedSchema } from './normalize-options';

export function createFiles(host: Tree, options: NormalizedSchema) {
  const rootOffset = offsetFromRoot(options.projectRoot);
  generateFiles(host, join(__dirname, '../files/app'), options.projectRoot, {
    ...options,
    offsetFromRoot: rootOffset,
    rootTsConfigPath: rootOffset + getRootTsConfigPathInTree(host),
  });
  if (options.js) {
    toJS(host);
  }
}
