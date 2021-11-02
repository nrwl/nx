import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ControllerGeneratorOptions } from './controller';
import { controllerGenerator } from './controller';

describe('controller generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: ControllerGeneratorOptions = {
    name: 'test',
    project,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(
      controllerGenerator(tree, options)
    ).resolves.not.toThrowError();
  });
});
