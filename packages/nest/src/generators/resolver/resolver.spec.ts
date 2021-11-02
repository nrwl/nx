import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ResolverGeneratorOptions } from './resolver';
import { resolverGenerator } from './resolver';

describe('resolver generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: ResolverGeneratorOptions = {
    name: 'test',
    project,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(resolverGenerator(tree, options)).resolves.not.toThrowError();
  });
});
