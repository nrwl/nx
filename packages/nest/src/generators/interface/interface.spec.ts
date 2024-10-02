import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { InterfaceGeneratorOptions } from './interface';
import { interfaceGenerator } from './interface';

describe('interface generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: InterfaceGeneratorOptions = {
    name: 'test',
    path,
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(path);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(
      interfaceGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
