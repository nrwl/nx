import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { rollupProjectGenerator } from './rollup-project';

describe('rollupProjectGenerator', () => {
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
    await rollupProjectGenerator(tree, {
      project: 'mypkg',
    });

    const project = readProjectConfiguration(tree, 'mypkg');

    expect(project.targets).toMatchObject({
      build: {
        executor: '@nx/rollup:rollup',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          main: 'libs/mypkg/src/main.ts',
        },
      },
    });

    expect(readJson(tree, 'libs/mypkg/package.json')).toEqual({
      name: '@proj/mypkg',
      version: '0.0.1',
    });
  });

  it('should respect existing package.json file', async () => {
    writeJson(tree, 'libs/mypkg/package.json', {
      name: '@acme/mypkg',
      version: '1.0.0',
    });
    await rollupProjectGenerator(tree, {
      project: 'mypkg',
    });

    expect(readJson(tree, 'libs/mypkg/package.json')).toEqual({
      name: '@acme/mypkg',
      version: '1.0.0',
    });
  });

  it('should support --main option', async () => {
    await rollupProjectGenerator(tree, {
      project: 'mypkg',
      main: 'libs/mypkg/index.ts',
    });

    const project = readProjectConfiguration(tree, 'mypkg');

    expect(project.targets).toMatchObject({
      build: {
        executor: '@nx/rollup:rollup',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          main: 'libs/mypkg/index.ts',
        },
      },
    });
  });

  it('should support --tsConfig option', async () => {
    await rollupProjectGenerator(tree, {
      project: 'mypkg',
      tsConfig: 'libs/mypkg/tsconfig.custom.json',
    });

    const project = readProjectConfiguration(tree, 'mypkg');

    expect(project.targets).toMatchObject({
      build: {
        executor: '@nx/rollup:rollup',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          tsConfig: 'libs/mypkg/tsconfig.custom.json',
        },
      },
    });
  });
});
