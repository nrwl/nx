import { Tree, writeJson } from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';

export function createTsConfig(
  tree: Tree,
  options: NormalizedSchema,
  relativePathToRootTsConfig: string
) {
  // Nx 15.8 moved util to @nrwl/js, but it is in @nrwl/workspace in 15.7
  let shared: any;
  try {
    shared = require('@nrwl/js/src/utils/typescript/create-ts-config');
  } catch {
    shared = require('@nrwl/workspace/src/utils/create-ts-config');
  }

  const json = {
    compilerOptions: {
      jsx: 'react-jsx',
      allowJs: false,
      esModuleInterop: false,
      allowSyntheticDefaultImports: true,
      strict: true,
    },
    files: [],
    include: [],
    references: [
      {
        path: './tsconfig.app.json',
      },
    ],
  } as any;

  // inline tsconfig.base.json into the project
  if (options.rootProject) {
    json.compileOnSave = false;
    json.compilerOptions = {
      ...shared.tsConfigBaseOptions,
      ...json.compilerOptions,
    };
    json.exclude = ['node_modules', 'tmp'];
  } else {
    json.extends = relativePathToRootTsConfig;
  }

  writeJson(tree, `${options.appProjectRoot}/tsconfig.json`, json);
}
