import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { InterceptorGeneratorOptions } from './interceptor';
import { interceptorGenerator } from './interceptor';

describe('interceptor generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: InterceptorGeneratorOptions = {
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
      interceptorGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
