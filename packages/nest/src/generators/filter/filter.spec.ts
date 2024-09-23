import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { FilterGeneratorOptions } from './filter';
import { filterGenerator } from './filter';

describe('filter generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: FilterGeneratorOptions = {
    name: 'test',
    directory,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(filterGenerator(tree, options)).resolves.not.toThrow();
  });
});
