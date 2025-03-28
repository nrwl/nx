import { addProjectConfiguration, names, Tree } from '@nx/devkit';
import applicationGenerator from '../generators/application/application';
import { Linter } from '@nx/eslint';

export async function createApp(tree: Tree, appName: string): Promise<any> {
  await applicationGenerator(tree, {
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: true,
    style: 'css',
    unitTestRunner: 'none',
    directory: appName,
  });
}

export async function createLib(tree: Tree, libName: string): Promise<any> {
  const { fileName } = names(libName);

  tree.write(`/${fileName}/src/index.ts`, `import React from 'react';\n`);

  addProjectConfiguration(tree, fileName, {
    tags: [],
    root: `${fileName}`,
    projectType: 'library',
    sourceRoot: `${fileName}/src`,
    targets: {},
  });
}
