import type { Tree } from '@nrwl/devkit';
import type { Schema } from '../schema';

import {
  updateJson,
  readProjectConfiguration,
  joinPathFragments,
} from '@nrwl/devkit';

export function updateTsConfigTarget(tree: Tree, schema: Schema) {
  const { root } = readProjectConfiguration(tree, schema.appName);
  // tsconfig.app.json
  updateJson(tree, joinPathFragments(root, `tsconfig.app.json`), (json) => ({
    ...json,
    compilerOptions: {
      ...json.compilerOptions,
      target: 'ES2020',
    },
  }));
}
