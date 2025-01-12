import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { providerGenerator } from './provider';

describe('provider generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      providerGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
