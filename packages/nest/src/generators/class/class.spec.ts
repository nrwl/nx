import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ClassGeneratorOptions } from './class';
import { classGenerator } from './class';

describe('class generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: ClassGeneratorOptions = {
    name: 'test',
    project,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(classGenerator(tree, options)).resolves.not.toThrowError();
  });
});
