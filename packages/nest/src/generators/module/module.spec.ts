import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ModuleGeneratorOptions } from './module';
import { moduleGenerator } from './module';

describe('module generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: ModuleGeneratorOptions = {
    name: 'test',
    path,
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(path);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(
      moduleGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
