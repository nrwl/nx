import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { decoratorGenerator } from './decorator';

describe('decorator generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      decoratorGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
