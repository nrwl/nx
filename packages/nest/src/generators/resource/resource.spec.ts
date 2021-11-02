import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ResourceGeneratorOptions } from './resource';
import { resourceGenerator } from './resource';

describe('resource generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: ResourceGeneratorOptions = {
    name: 'test',
    project,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(resourceGenerator(tree, options)).resolves.not.toThrowError();
  });
});
