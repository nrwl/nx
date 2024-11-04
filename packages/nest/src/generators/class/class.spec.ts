import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ClassGeneratorOptions } from './class';
import { classGenerator } from './class';

describe('class generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: ClassGeneratorOptions = {
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
      classGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
