import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ModuleGeneratorOptions } from './module';
import { moduleGenerator } from './module';

describe('module generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: ModuleGeneratorOptions = {
    name: 'test',
    directory,
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(moduleGenerator(tree, options)).resolves.not.toThrow();
  });
});
