import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import configurationGenerator from './configuration';

describe('configurationGenerator', () => {
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
      addPlugin: false,
      project: 'mypkg',
    });

    const project = readProjectConfiguration(tree, 'mypkg');

    expect(project.targets.build).toBeUndefined();
    expect(tree.read('libs/mypkg/rollup.config.cjs', 'utf-8')).toContain(
      "main: './src/index.ts'"
    );
    expect(readJson(tree, 'nx.json').plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ plugin: '@nx/rollup/plugin' }),
      ])
    );
  });

  it('should respect existing package.json file', async () => {
    writeJson(tree, 'libs/mypkg/package.json', {
      name: '@acme/mypkg',
      version: '1.0.0',
    });
    await configurationGenerator(tree, {
      addPlugin: false,
      project: 'mypkg',
    });

    expect(readJson(tree, 'libs/mypkg/package.json')).toEqual({
      name: '@acme/mypkg',
      version: '1.0.0',
    });
  });

  it('should support --main option', async () => {
    await configurationGenerator(tree, {
      addPlugin: false,
      project: 'mypkg',
      main: 'libs/mypkg/index.ts',
    });

    const project = readProjectConfiguration(tree, 'mypkg');

    expect(project.targets.build).toBeUndefined();
    expect(tree.read('libs/mypkg/rollup.config.cjs', 'utf-8')).toContain(
      "main: './index.ts'"
    );
  });

  it('should support --tsConfig option', async () => {
    await configurationGenerator(tree, {
      addPlugin: false,
      project: 'mypkg',
      tsConfig: 'libs/mypkg/tsconfig.custom.json',
    });

    const project = readProjectConfiguration(tree, 'mypkg');

    expect(project.targets.build).toBeUndefined();
    expect(tree.read('libs/mypkg/rollup.config.cjs', 'utf-8')).toContain(
      "tsConfig: './tsconfig.custom.json'"
    );
  });

  it('should preserve an existing non-Rollup target', async () => {
    updateProjectConfiguration(tree, 'mypkg', {
      root: 'libs/mypkg',
      sourceRoot: 'libs/mypkg/src',
      targets: {
        build: {
          executor: '@nx/js:tsc',
          options: {
            main: 'libs/mypkg/src/custom.ts',
            outputPath: 'dist/custom',
            tsConfig: 'libs/mypkg/src/tsconfig.custom.json',
            additionalEntryPoints: ['libs/mypkg/src/extra.ts'],
            generateExportsField: true,
          },
        },
      },
    });

    await configurationGenerator(tree, {
      addPlugin: false,
      project: 'mypkg',
      buildTarget: 'build',
      skipValidation: true,
    });

    const project = readProjectConfiguration(tree, 'mypkg');

    expect(project.targets).toMatchObject({
      build: {
        executor: '@nx/js:tsc',
        options: {
          main: 'libs/mypkg/src/custom.ts',
          outputPath: 'dist/custom',
          tsConfig: 'libs/mypkg/src/tsconfig.custom.json',
          additionalEntryPoints: ['libs/mypkg/src/extra.ts'],
          generateExportsField: true,
        },
      },
    });
  });
});
