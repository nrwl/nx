import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { PipeGeneratorOptions } from './pipe';
import { pipeGenerator } from './pipe';

describe('pipe generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: PipeGeneratorOptions = {
    name: 'test',
    directory,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(pipeGenerator(tree, options)).resolves.not.toThrow();
  });
});
