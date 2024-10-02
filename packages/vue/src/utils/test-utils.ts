import { addProjectConfiguration, names, Tree } from '@nx/devkit';
import { Linter } from '@nx/eslint';
import applicationGenerator from '../generators/application/application';

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

  tree.write(`/${fileName}/src/index.ts`, ``);

  addProjectConfiguration(tree, fileName, {
    tags: [],
    root: `${fileName}`,
    projectType: 'library',
    sourceRoot: `${fileName}/src`,
    targets: {},
  });
}
