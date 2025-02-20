import type { Tree } from '@nx/devkit';
import { createTreeWithNestApplication } from '../utils/testing';
import { resourceGenerator } from './resource';

// TODO (nicolas) fix the tests current fails with Error: spawn /bin/sh ENOENT)... Also fails on master from utils/run-nest-schematic.spec.ts
xdescribe('resource generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithNestApplication('api');
  });

  it('should run successfully', async () => {
    await expect(
      resourceGenerator(tree, { path: 'api/test' })
    ).resolves.not.toThrow();
  });
});
