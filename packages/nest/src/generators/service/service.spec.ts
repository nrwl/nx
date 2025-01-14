import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { serviceGenerator } from './service';

describe('service generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      serviceGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
