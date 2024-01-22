import { Tree, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';

import { rollupInitGenerator } from './init';

describe('rollupInitGenerator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should install deps', async () => {
    await rollupInitGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: { '@nx/rollup': nxVersion },
    });
  });
});
