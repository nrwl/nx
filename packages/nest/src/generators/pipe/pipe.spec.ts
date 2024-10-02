import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { PipeGeneratorOptions } from './pipe';
import { pipeGenerator } from './pipe';

describe('pipe generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: PipeGeneratorOptions = {
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
      pipeGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
