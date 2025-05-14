import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { interceptorGenerator } from './interceptor';

describe('interceptor generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      interceptorGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
