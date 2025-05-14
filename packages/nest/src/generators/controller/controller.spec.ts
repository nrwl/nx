import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { controllerGenerator } from './controller';

describe('controller generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      controllerGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
