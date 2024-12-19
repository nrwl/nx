import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { guardGenerator } from './guard';

describe('guard generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      guardGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
