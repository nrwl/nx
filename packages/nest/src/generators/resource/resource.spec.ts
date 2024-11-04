import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import type { ResourceGeneratorOptions } from './resource';
import { resourceGenerator } from './resource';

// TODO (nicolas) fix the tests current fails with Error: spawn /bin/sh ENOENT)... Also fails on master from utils/run-nest-schematic.spec.ts
xdescribe('resource generator', () => {
  let tree: Tree;
  const path = 'api';
  const options: ResourceGeneratorOptions = {
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
      resourceGenerator(tree, { ...options, path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
