import type { Tree } from '@nrwl/devkit';
import {
  generateFiles,
  joinPathFragments,
  names,
  offsetFromRoot,
  toJS,
} from '@nrwl/devkit';
import { getRelativePathToRootTsConfig } from '@nrwl/js';

import { NormalizedSchema } from '../schema';
import { createTsConfig } from '../../../utils/create-ts-config';

export function createFiles(host: Tree, options: NormalizedSchema) {
  const relativePathToRootTsConfig = getRelativePathToRootTsConfig(
    host,
    options.projectRoot
  );
  const substitutions = {
    ...options,
    ...names(options.name),
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
  };

  generateFiles(
    host,
    joinPathFragments(__dirname, '../files/common'),
    options.projectRoot,
    substitutions
  );

  if (options.bundler === 'vite' || options.unitTestRunner === 'vitest') {
    generateFiles(
      host,
      joinPathFragments(__dirname, '../files/vite'),
      options.projectRoot,
      substitutions
    );

    if (host.exists(joinPathFragments(options.projectRoot, '.babelrc'))) {
      host.delete(joinPathFragments(options.projectRoot, '.babelrc'));
    }
  }

  if (!options.publishable && !options.buildable) {
    host.delete(`${options.projectRoot}/package.json`);
  }

  if (options.js) {
    toJS(host);
  }

  createTsConfig(
    host,
    options.projectRoot,
    'lib',
    options,
    relativePathToRootTsConfig
  );
}
