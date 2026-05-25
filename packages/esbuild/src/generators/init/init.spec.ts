import { readJson, writeJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { esbuildInitGenerator } from './init';

describe('esbuildInitGenerator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    writeJson(tree, 'package.json', {});
  });

  it('should add esbuild as a dev dependency', async () => {
    await esbuildInitGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies).toEqual({
      '@nx/esbuild': expect.any(String),
      esbuild: expect.any(String),
    });
  });

  it('should keep the installed esbuild version', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: {
        esbuild: '^0.19.2',
      },
    });

    await esbuildInitGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies).toEqual({
      '@nx/esbuild': expect.any(String),
      esbuild: '^0.19.2',
    });
  });
});
