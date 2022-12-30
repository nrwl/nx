import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { InterceptorGeneratorOptions } from './interceptor';
import { interceptorGenerator } from './interceptor';

describe('interceptor generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: InterceptorGeneratorOptions = {
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
      interceptorGenerator(tree, options)
    ).resolves.not.toThrowError();
  });
});
