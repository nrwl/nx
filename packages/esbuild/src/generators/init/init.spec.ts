import { readJson, writeJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

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
      esbuild: expect.any(String),
    });
  });
});
