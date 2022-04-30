import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { joinPathFragments, readJson, updateJson } from '@nrwl/devkit';

interface TsConfig {
  compilerOptions: { types: string[] };
}

function getCompilerOptionsTypes(tsConfig: TsConfig): string[] {
  return tsConfig?.compilerOptions?.types ?? [];
}

export function updateEditorTsConfig(tree: Tree, options: NormalizedSchema) {
  const types = getCompilerOptionsTypes(
    readJson<TsConfig>(
      tree,
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json')
    )
  );

  if (options.unitTestRunner !== 'none') {
    types.concat(
      getCompilerOptionsTypes(
        readJson<TsConfig>(
          tree,
          joinPathFragments(options.appProjectRoot, 'tsconfig.spec.json')
        )
      )
    );
  }

  updateJson(
    tree,
    joinPathFragments(options.appProjectRoot, 'tsconfig.editor.json'),
    (json) => {
      json.compilerOptions.types = types;
      return json;
    }
  );

  // This should be the last tsconfig references so it's not in the template
  updateJson(
    tree,
    joinPathFragments(options.appProjectRoot, 'tsconfig.json'),
    (json) => {
      json.references.push({
        path: './tsconfig.editor.json',
      });
      return json;
    }
  );
}
