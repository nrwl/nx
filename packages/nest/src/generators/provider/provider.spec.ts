import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ProviderGeneratorOptions } from './provider';
import { providerGenerator } from './provider';

describe('provider generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: ProviderGeneratorOptions = {
    name: 'test',
    project,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(providerGenerator(tree, options)).resolves.not.toThrowError();
  });
});
