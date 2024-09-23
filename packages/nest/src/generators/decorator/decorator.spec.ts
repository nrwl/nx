import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { DecoratorGeneratorOptions } from './decorator';
import { decoratorGenerator } from './decorator';

describe('decorator generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: DecoratorGeneratorOptions = {
    name: 'test',
    directory,
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(decoratorGenerator(tree, options)).resolves.not.toThrow();
  });
});
