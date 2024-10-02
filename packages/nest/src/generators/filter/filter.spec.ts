import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { FilterGeneratorOptions } from './filter';
import { filterGenerator } from './filter';

describe('filter generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: FilterGeneratorOptions = {
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
      filterGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
