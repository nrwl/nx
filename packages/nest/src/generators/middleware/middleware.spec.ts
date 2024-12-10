import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { middlewareGenerator } from './middleware';

describe('middleware generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      middlewareGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
