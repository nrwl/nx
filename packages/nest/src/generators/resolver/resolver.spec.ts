import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ResolverGeneratorOptions } from './resolver';
import { resolverGenerator } from './resolver';

describe('resolver generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: ResolverGeneratorOptions = {
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
      resolverGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
