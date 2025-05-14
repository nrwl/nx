import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { moduleGenerator } from './module';

describe('module generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      moduleGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
