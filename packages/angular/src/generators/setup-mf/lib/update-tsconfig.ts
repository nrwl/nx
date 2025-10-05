import type { Tree } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';

import {
  updateJson,
  readProjectConfiguration,
  joinPathFragments,
} from '@nx/devkit';

export function updateTsConfig(tree: Tree, options: NormalizedOptions) {
  const { root } = readProjectConfiguration(tree, options.appName);

  updateJson(tree, joinPathFragments(root, `tsconfig.app.json`), (json) => {
    json.compilerOptions ??= {};
    json.compilerOptions.target = 'ES2020';

    if (options.mfType === 'remote') {
      json.files ??= [];
      json.files.push(
        options.standalone
          ? 'src/app/remote-entry/entry.routes.ts'
          : `src/app/remote-entry/${options.entryModuleFileName}.ts`
      );
    }

    return json;
  });
}
