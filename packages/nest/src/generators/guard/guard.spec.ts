import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { GuardGeneratorOptions } from './guard';
import { guardGenerator } from './guard';

describe('guard generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: GuardGeneratorOptions = {
    name: 'test',
    project,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(guardGenerator(tree, options)).resolves.not.toThrowError();
  });
});
