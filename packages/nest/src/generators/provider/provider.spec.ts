import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ProviderGeneratorOptions } from './provider';
import { providerGenerator } from './provider';

describe('provider generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: ProviderGeneratorOptions = {
    name: 'test',
    directory,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(providerGenerator(tree, options)).resolves.not.toThrow();
  });
});
