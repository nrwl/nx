import { addProjectConfiguration, names, Tree } from '@nx/devkit';
import applicationGenerator from '../generators/application/application';
import { Linter } from '@nx/linter';

export async function createApp(tree: Tree, appName: string): Promise<any> {
  await applicationGenerator(tree, {
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: true,
    style: 'css',
    unitTestRunner: 'none',
    name: appName,
  });
}

export async function createLib(tree: Tree, libName: string): Promise<any> {
  const { fileName } = names(libName);

  tree.write(`/libs/${fileName}/src/index.ts`, `import React from 'react';\n`);

  addProjectConfiguration(tree, fileName, {
    tags: [],
    root: `libs/${fileName}`,
    projectType: 'library',
    sourceRoot: `libs/${fileName}/src`,
    targets: {},
  });
}
