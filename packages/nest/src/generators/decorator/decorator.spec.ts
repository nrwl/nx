import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { DecoratorGeneratorOptions } from './decorator';
import { decoratorGenerator } from './decorator';

describe('decorator generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: DecoratorGeneratorOptions = {
    name: 'test',
    path,
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(path);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(
      decoratorGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
