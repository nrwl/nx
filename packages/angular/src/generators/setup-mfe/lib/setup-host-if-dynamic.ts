import type { Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';

import { readProjectConfiguration, joinPathFragments } from '@nrwl/devkit';

export function setupHostIfDynamic(tree: Tree, options: Schema) {
  if (options.federationType === 'static' || options.mfeType === 'remote') {
    return;
  }

  const pathToMfeManifest = joinPathFragments(
    readProjectConfiguration(tree, options.appName).sourceRoot,
    'assets/mfe.manifest.json'
  );

  if (!tree.exists(pathToMfeManifest)) {
    tree.write(pathToMfeManifest, '{}');
  }
}
