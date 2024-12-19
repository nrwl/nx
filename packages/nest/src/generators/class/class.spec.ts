import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { classGenerator } from './class';

describe('class generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      classGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
