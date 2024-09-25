import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ControllerGeneratorOptions } from './controller';
import { controllerGenerator } from './controller';

describe('controller generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: ControllerGeneratorOptions = {
    name: 'test',
    directory,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(controllerGenerator(tree, options)).resolves.not.toThrow();
  });
});
