import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ControllerGeneratorOptions } from './controller';
import { controllerGenerator } from './controller';

describe('controller generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: ControllerGeneratorOptions = {
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
      controllerGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
