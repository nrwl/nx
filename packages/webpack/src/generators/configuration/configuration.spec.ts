import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import configurationGenerator from './configuration';

describe('webpackProject', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'mypkg', {
      root: 'libs/mypkg',
      sourceRoot: 'libs/mypkg/src',
      targets: {},
    });
  });

  it('should generate files', async () => {
    await configurationGenerator(tree, {
      project: 'mypkg',
    });

    expect(tree.exists('libs/mypkg/webpack.config.js')).toBeTruthy();
  });

  it('should support --main option', async () => {
    await configurationGenerator(tree, {
      project: 'mypkg',
      main: 'libs/mypkg/index.ts',
    });

    expect(tree.read('libs/mypkg/webpack.config.js', 'utf-8')).toContain(
      `main: 'libs/mypkg/index.ts'`
    );
  });

  it('should support --tsConfig option', async () => {
    await configurationGenerator(tree, {
      project: 'mypkg',
      tsConfig: 'libs/mypkg/tsconfig.custom.json',
    });

    expect(tree.read('libs/mypkg/webpack.config.js', 'utf-8')).toContain(
      `tsConfig: 'libs/mypkg/tsconfig.custom.json'`
    );
  });
});
