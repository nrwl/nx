import type { Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';

import { readProjectConfiguration, joinPathFragments } from '@nrwl/devkit';

export function setupHostIfDynamic(tree: Tree, options: Schema) {
  if (options.federationType === 'static' || options.mfeType === 'remote') {
    return;
  }

  const pathToMFManifest = joinPathFragments(
    readProjectConfiguration(tree, options.appName).sourceRoot,
    'assets/module-federation.manifest.json'
  );

  if (!tree.exists(pathToMFManifest)) {
    tree.write(pathToMFManifest, '{}');
  }
}
