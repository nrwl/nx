import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { esbuildInitGenerator } from './init';

describe('esbuildInitGenerator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await expect(esbuildInitGenerator(tree, {})).resolves.not.toThrow();
  });
});
