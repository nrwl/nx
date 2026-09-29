import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { addProjectConfiguration, readJson, Tree } from '@nx/devkit';
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
      addPlugin: true,
    });

    expect(tree.exists('libs/mypkg/webpack.config.js')).toBeTruthy();
  });

  it('should support --main option', async () => {
    await configurationGenerator(tree, {
      project: 'mypkg',
      addPlugin: true,
      main: 'libs/mypkg/index.ts',
    });

    expect(tree.read('libs/mypkg/webpack.config.js', 'utf-8')).toContain(
      `main: 'libs/mypkg/index.ts'`
    );
  });

  it('should support --tsConfig option', async () => {
    await configurationGenerator(tree, {
      project: 'mypkg',
      addPlugin: true,
      tsConfig: 'libs/mypkg/tsconfig.custom.json',
    });

    expect(tree.read('libs/mypkg/webpack.config.js', 'utf-8')).toContain(
      `tsConfig: 'libs/mypkg/tsconfig.custom.json'`
    );
  });

  it('should write a .babelrc when the compiler is babel', async () => {
    await configurationGenerator(tree, {
      project: 'mypkg',
      addPlugin: true,
      compiler: 'babel',
    });

    expect(readJson(tree, 'libs/mypkg/.babelrc')).toEqual({
      presets: ['@nx/js/babel'],
    });
    expect(tree.read('libs/mypkg/webpack.config.js', 'utf-8')).toContain(
      `compiler: 'babel'`
    );
  });

  it('should use --babelConfig instead of writing a .babelrc', async () => {
    await configurationGenerator(tree, {
      project: 'mypkg',
      addPlugin: true,
      compiler: 'babel',
      babelConfig: 'libs/mypkg/babel.config.json',
    });

    expect(tree.exists('libs/mypkg/.babelrc')).toBeFalsy();
    expect(tree.read('libs/mypkg/webpack.config.js', 'utf-8')).toContain(
      `babelConfig: 'libs/mypkg/babel.config.json'`
    );
  });
});
