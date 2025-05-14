import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { resolverGenerator } from './resolver';

describe('resolver generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      resolverGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
