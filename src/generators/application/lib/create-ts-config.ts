import { Tree, workspaceRoot, writeJson } from '@nrwl/devkit';
import { relative } from 'path';
import { Framework } from '../../init/schema';

export function editTsConfig(
  tree: Tree,
  projectRoot: string,
  framework: Framework,
  relativePathToRootTsConfig: string
) {
  // Nx 15.8 moved util to @nrwl/js, but it is in @nrwl/workspace in 15.7
  let shared: any;
  try {
    shared = require('@nrwl/js/src/utils/typescript/create-ts-config');
  } catch {
    shared = require('@nrwl/workspace/src/utils/create-ts-config');
  }

  if (framework === 'react') {
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
    if (projectIsRootProjectInStandaloneWorkspace(projectRoot)) {
      json.compileOnSave = false;
      json.compilerOptions = {
        ...shared.tsConfigBaseOptions,
        ...json.compilerOptions,
      };
      json.exclude = ['node_modules', 'tmp'];
    } else {
      json.extends = relativePathToRootTsConfig;
    }

    writeJson(tree, `${projectRoot}/tsconfig.json`, json);
  }
}

function projectIsRootProjectInStandaloneWorkspace(projectRoot: string) {
  return relative(workspaceRoot, projectRoot).length === 0;
}
