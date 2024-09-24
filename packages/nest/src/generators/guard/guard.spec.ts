import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { GuardGeneratorOptions } from './guard';
import { guardGenerator } from './guard';

describe('guard generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: GuardGeneratorOptions = {
    name: 'test',
    directory,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(guardGenerator(tree, options)).resolves.not.toThrow();
  });
});
