import type { Tree } from '@nx/devkit';
import type { Schema } from '../schema';

import {
  updateJson,
  readProjectConfiguration,
  joinPathFragments,
} from '@nx/devkit';

export function updateTsConfig(tree: Tree, schema: Schema) {
  const { root } = readProjectConfiguration(tree, schema.appName);

  updateJson(tree, joinPathFragments(root, `tsconfig.app.json`), (json) => {
    json.compilerOptions ??= {};
    json.compilerOptions.target = 'ES2020';

    if (schema.mfType === 'remote') {
      json.files ??= [];
      json.files.push(
        schema.standalone
          ? 'src/app/remote-entry/entry.routes.ts'
          : 'src/app/remote-entry/entry.module.ts'
      );
    }

    return json;
  });
}
