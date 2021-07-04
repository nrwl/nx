import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { MiddlewareGeneratorOptions } from './middleware';
import { middlewareGenerator } from './middleware';

describe('middleware generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: MiddlewareGeneratorOptions = {
    name: 'test',
    project,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(
      middlewareGenerator(tree, options)
    ).resolves.not.toThrowError();
  });
});
