import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { InterfaceGeneratorOptions } from './interface';
import { interfaceGenerator } from './interface';

describe('interface generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: InterfaceGeneratorOptions = {
    name: 'test',
    project,
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(interfaceGenerator(tree, options)).resolves.not.toThrowError();
  });
});
