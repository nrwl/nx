import { generateFiles, offsetFromRoot, toJS, Tree } from '@nrwl/devkit';
import { join } from 'path';
import { NormalizedSchema } from './normalize-options';

export function createFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, join(__dirname, '../files/app'), options.projectRoot, {
    ...options,
    offsetFromRoot: offsetFromRoot(options.projectRoot),
  });
  if (options.js) {
    toJS(host);
  }
}
