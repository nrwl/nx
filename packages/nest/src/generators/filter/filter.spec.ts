import type { Tree } from '@nx/devkit';
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
  });

  it('should run successfully', async () => {
    await filterGenerator(tree, options);
    expect(true).toBe(true);
  });
});
