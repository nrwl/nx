import { addProjectConfiguration, readJson, Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './update-babel-preset';

describe('update-babel-preset', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update preset with options', async () => {
    addProjectConfiguration(tree, 'demo', {
      root: 'demo',
    });
    writeJson(tree, 'demo/.babelrc', {
      presets: [
        '@acme/foo',
        [
          '@nrwl/web/babel',
          {
            useBuiltIns: 'usage',
          },
        ],
        '@acme/bar',
      ],
    });

    await update(tree);

    const result = readJson(tree, 'demo/.babelrc');
    expect(result).toEqual({
      presets: [
        '@acme/foo',
        [
          '@nrwl/js/babel',
          {
            useBuiltIns: 'usage',
          },
        ],
        '@acme/bar',
      ],
    });
  });

  it('should update preset without options', async () => {
    addProjectConfiguration(tree, 'demo', {
      root: 'demo',
    });
    writeJson(tree, 'demo/.babelrc', {
      presets: ['@acme/foo', '@nrwl/web/babel', '@acme/bar'],
    });

    await update(tree);

    const result = readJson(tree, 'demo/.babelrc');
    expect(result).toEqual({
      presets: ['@acme/foo', '@nrwl/js/babel', '@acme/bar'],
    });
  });
});
