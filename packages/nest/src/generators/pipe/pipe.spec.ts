import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { pipeGenerator } from './pipe';

describe('pipe generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      pipeGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
