import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ProviderGeneratorOptions } from './provider';
import { providerGenerator } from './provider';

describe('provider generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: ProviderGeneratorOptions = {
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
      providerGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
