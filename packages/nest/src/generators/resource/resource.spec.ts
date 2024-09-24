import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ResourceGeneratorOptions } from './resource';
import { resourceGenerator } from './resource';

// TODO (nicolas) fix the tests current fails with Error: spawn /bin/sh ENOENT)... Also fails on master from utils/run-nest-schematic.spec.ts
xdescribe('resource generator', () => {
  let tree: Tree;
  const directory = 'api';
  const options: ResourceGeneratorOptions = {
    name: 'test',
    directory,
    unitTestRunner: 'jest',
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
    jest.clearAllMocks();
  });

  it('should run successfully', async () => {
    await expect(resourceGenerator(tree, options)).resolves.not.toThrow();
  });
});
