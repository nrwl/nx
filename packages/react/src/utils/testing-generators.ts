import { addProjectConfiguration, names, Tree } from '@nrwl/devkit';
import applicationGenerator from '../generators/application/application';
import { Linter } from '@nrwl/linter';
import { applicationGenerator as webApplicationGenerator } from '@nrwl/web';

export async function createApp(tree: Tree, appName: string): Promise<any> {
  const { fileName } = names(appName);

  await applicationGenerator(tree, {
    babelJest: true,
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: true,
    style: 'css',
    unitTestRunner: 'none',
    name: appName,
  });
}

export async function createWebApp(tree: Tree, appName: string): Promise<any> {
  const { fileName } = names(appName);

  await webApplicationGenerator(tree, {
    name: appName,
    skipFormat: true,
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
