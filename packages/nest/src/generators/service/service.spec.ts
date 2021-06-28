import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ServiceGeneratorOptions } from './service';
import { serviceGenerator } from './service';

describe('service generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: ServiceGeneratorOptions = {
    name: 'test',
    project,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(serviceGenerator(tree, options)).resolves.not.toThrowError();
  });
});
