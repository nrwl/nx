import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ServiceGeneratorOptions } from './service';
import { serviceGenerator } from './service';

describe('service generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: ServiceGeneratorOptions = {
    name: 'test',
    directory,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(serviceGenerator(tree, options)).resolves.not.toThrowError();
  });
});
