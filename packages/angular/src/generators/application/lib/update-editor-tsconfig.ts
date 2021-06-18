import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { joinPathFragments, updateJson } from '@nrwl/devkit';

export function updateEditorTsConfig(host: Tree, options: NormalizedSchema) {
  // This should be the last tsconfig references so it's not in the template
  updateJson(
    host,
    joinPathFragments(options.appProjectRoot, 'tsconfig.json'),
    (json) => {
      json.references.push({
        path: './tsconfig.editor.json',
      });
      return json;
    }
  );
}
