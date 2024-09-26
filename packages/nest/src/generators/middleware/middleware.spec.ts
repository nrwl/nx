import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { MiddlewareGeneratorOptions } from './middleware';
import { middlewareGenerator } from './middleware';

describe('middleware generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: MiddlewareGeneratorOptions = {
    name: 'test',
    path,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(path);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(
      middlewareGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
