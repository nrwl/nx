import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { PipeGeneratorOptions } from './pipe';
import { pipeGenerator } from './pipe';

describe('pipe generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: PipeGeneratorOptions = {
    name: 'test',
    project,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(pipeGenerator(tree, options)).resolves.not.toThrowError();
  });
});
