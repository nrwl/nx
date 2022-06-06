import { addProjectConfiguration, names, Tree } from '@nrwl/devkit';
import applicationGenerator from '../generators/application/application';
import { Linter } from '@nrwl/linter';

export async function createApp(tree: Tree, appName: string): Promise<void> {
  await applicationGenerator(tree, {
    linter: Linter.EsLint,
    skipFormat: true,
    style: 'css',
    unitTestRunner: 'none',
    name: appName,
    e2eTestRunner: 'none',
    install: false,
  });
}

export async function createLib(tree: Tree, libName: string): Promise<void> {
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
