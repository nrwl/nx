import { applicationGenerator } from '../application/application';
import { componentGenerator } from './component';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Tree } from '@nrwl/devkit';
import { libraryGenerator } from '@nrwl/react';
import { Linter } from '@nrwl/linter';

describe('component', () => {
  let tree: Tree;
  const appName = 'my-app';
  const libName = 'my-lib';

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await applicationGenerator(tree, {
      name: appName,
      style: 'css',
      standaloneConfig: false,
    });
    await libraryGenerator(tree, {
      name: libName,
      linter: Linter.EsLint,
      style: 'css',
      skipFormat: true,
      skipTsConfig: false,
      unitTestRunner: 'jest',
    });
  });

  it('should generate component in components directory for application', async () => {
    await componentGenerator(tree, {
      name: 'hello',
      project: appName,
      style: 'css',
    });

    expect(tree.exists('apps/my-app/components/hello/hello.tsx')).toBeTruthy();
    expect(
      tree.exists('apps/my-app/components/hello/hello.spec.tsx')
    ).toBeTruthy();
    expect(
      tree.exists('apps/my-app/components/hello/hello.module.css')
    ).toBeTruthy();
  });

  it('should generate component in default directory for library', async () => {
    await componentGenerator(tree, {
      name: 'hello',
      project: libName,
      style: 'css',
    });

    expect(tree.exists('libs/my-lib/src/lib/hello/hello.tsx')).toBeTruthy();
    expect(
      tree.exists('libs/my-lib/src/lib/hello/hello.spec.tsx')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-lib/src/lib/hello/hello.module.css')
    ).toBeTruthy();
  });

  it('should allow directory override', async () => {
    await componentGenerator(tree, {
      name: 'hello',
      project: appName,
      directory: 'foo',
      style: 'css',
    });
    await componentGenerator(tree, {
      name: 'world',
      project: libName,
      directory: 'bar',
      style: 'css',
    });

    expect(tree.exists('apps/my-app/foo/hello/hello.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/foo/hello/hello.spec.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/foo/hello/hello.module.css')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/bar/world/world.tsx')).toBeTruthy();
    expect(
      tree.exists('libs/my-lib/src/bar/world/world.spec.tsx')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-lib/src/bar/world/world.module.css')
    ).toBeTruthy();
  });
});
