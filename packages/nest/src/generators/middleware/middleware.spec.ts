import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { MiddlewareGeneratorOptions } from './middleware';
import { middlewareGenerator } from './middleware';

describe('middleware generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: MiddlewareGeneratorOptions = {
    name: 'test',
    directory,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(middlewareGenerator(tree, options)).resolves.not.toThrow();
  });
});
