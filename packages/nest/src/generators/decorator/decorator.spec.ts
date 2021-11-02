import type { Tree } from '@nrwl/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { DecoratorGeneratorOptions } from './decorator';
import { decoratorGenerator } from './decorator';

describe('decorator generator', () => {
  let tree: Tree;
  const project = 'api';
  const options: DecoratorGeneratorOptions = {
    name: 'test',
    project,
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(decoratorGenerator(tree, options)).resolves.not.toThrowError();
  });
});
