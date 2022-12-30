import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ModuleGeneratorOptions } from './module';
import { moduleGenerator } from './module';

describe('module generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: ModuleGeneratorOptions = {
    name: 'test',
    project,
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(moduleGenerator(tree, options)).resolves.not.toThrowError();
  });
});
