import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { InterfaceGeneratorOptions } from './interface';
import { interfaceGenerator } from './interface';

describe('interface generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: InterfaceGeneratorOptions = {
    name: 'test',
    directory,
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(interfaceGenerator(tree, options)).resolves.not.toThrow();
  });
});
