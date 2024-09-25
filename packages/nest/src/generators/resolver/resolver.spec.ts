import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ResolverGeneratorOptions } from './resolver';
import { resolverGenerator } from './resolver';

describe('resolver generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: ResolverGeneratorOptions = {
    name: 'test',
    directory,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(resolverGenerator(tree, options)).resolves.not.toThrow();
  });
});
