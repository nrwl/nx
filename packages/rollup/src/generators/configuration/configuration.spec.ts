import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
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
      project: 'mypkg',
    });

    const project = readProjectConfiguration(tree, 'mypkg');

    expect(project.targets?.build).toBeUndefined();

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
    await configurationGenerator(tree, {
      project: 'mypkg',
    });

    expect(readJson(tree, 'libs/mypkg/package.json')).toEqual({
      name: '@acme/mypkg',
      version: '1.0.0',
    });
  });

  it('should support --main option', async () => {
    await configurationGenerator(tree, {
      project: 'mypkg',
      main: './src/index.ts',
    });

    const rollupConfig = tree.read('libs/mypkg/rollup.config.js', 'utf-8');

    expect(rollupConfig)
      .toEqual(`const { withNx } = require('@nx/rollup/with-nx');

module.exports = withNx(
  {
    main: './src/index.ts',
    outputPath: '../../dist/libs/mypkg',
    tsConfig: './tsconfig.lib.json',
    compiler: 'babel',
    format: ['esm'],
    assets: [{ input: '.', output: '.', glob: '*.md' }],
  },
  {
    // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
    // e.g.
    // output: { sourcemap: true },
  }
);
`);
  });

  it('should support --tsConfig option', async () => {
    await configurationGenerator(tree, {
      project: 'mypkg',
      tsConfig: './tsconfig.custom.json',
    });

    const rollupConfig = tree.read('libs/mypkg/rollup.config.js', 'utf-8');

    expect(rollupConfig)
      .toEqual(`const { withNx } = require('@nx/rollup/with-nx');

module.exports = withNx(
  {
    main: './src/index.ts',
    outputPath: '../../dist/libs/mypkg',
    tsConfig: './tsconfig.custom.json',
    compiler: 'babel',
    format: ['esm'],
    assets: [{ input: '.', output: '.', glob: '*.md' }],
  },
  {
    // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
    // e.g.
    // output: { sourcemap: true },
  }
);
`);
  });
});
