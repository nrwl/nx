import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ServiceGeneratorOptions } from './service';
import { serviceGenerator } from './service';

describe('service generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: ServiceGeneratorOptions = {
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
      serviceGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrowError();
  });
});
