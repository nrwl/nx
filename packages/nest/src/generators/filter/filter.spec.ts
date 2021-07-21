import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { FilterGeneratorOptions } from './filter';
import { filterGenerator } from './filter';

describe('filter generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: FilterGeneratorOptions = {
    name: 'test',
    project,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(filterGenerator(tree, options)).resolves.not.toThrowError();
  });
});
