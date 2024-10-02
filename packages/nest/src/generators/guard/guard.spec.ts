import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { GuardGeneratorOptions } from './guard';
import { guardGenerator } from './guard';

describe('guard generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: GuardGeneratorOptions = {
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
      guardGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
