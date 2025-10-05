import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { interfaceGenerator } from './interface';

describe('interface generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      interfaceGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
