import { applicationGenerator } from '../application/application';
import { componentGenerator } from './component';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';
import { libraryGenerator } from '@nx/react';
import { Linter } from '@nx/eslint';

describe('component', () => {
  let tree: Tree;
  const appName = 'my-app';
  const libName = 'my-lib';

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await applicationGenerator(tree, {
      directory: appName,
      style: 'css',
    });
    await libraryGenerator(tree, {
      directory: libName,
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
      path: `${appName}/components/hello/hello`,
      style: 'css',
    });

    expect(tree.exists('my-app/components/hello/hello.tsx')).toBeTruthy();
    expect(tree.exists('my-app/components/hello/hello.spec.tsx')).toBeTruthy();
    expect(
      tree.exists('my-app/components/hello/hello.module.css')
    ).toBeTruthy();
  });

  it('should generate component in default directory for library', async () => {
    await componentGenerator(tree, {
      name: 'hello',
      path: `${libName}/src/lib/hello/hello`,
      style: 'css',
    });

    expect(tree.exists('my-lib/src/lib/hello/hello.tsx')).toBeTruthy();
    expect(tree.exists('my-lib/src/lib/hello/hello.spec.tsx')).toBeTruthy();
    expect(tree.exists('my-lib/src/lib/hello/hello.module.css')).toBeTruthy();
  });

  it('should allow directory override', async () => {
    await componentGenerator(tree, {
      name: 'hello',
      path: `${appName}/foo/hello/hello`,
      style: 'css',
    });
    await componentGenerator(tree, {
      name: 'world',
      path: `${libName}/src/bar/world/world`,
      style: 'css',
    });

    expect(tree.exists('my-app/foo/hello/hello.tsx')).toBeTruthy();
    expect(tree.exists('my-app/foo/hello/hello.spec.tsx')).toBeTruthy();
    expect(tree.exists('my-app/foo/hello/hello.module.css')).toBeTruthy();
    expect(tree.exists('my-lib/src/bar/world/world.tsx')).toBeTruthy();
    expect(tree.exists('my-lib/src/bar/world/world.spec.tsx')).toBeTruthy();
    expect(tree.exists('my-lib/src/bar/world/world.module.css')).toBeTruthy();
  });

  it('should work with path as-provided', async () => {
    await componentGenerator(tree, {
      name: 'hello',
      path: 'my-lib/src/foo/hello',
      style: 'css',
    });

    expect(tree.exists('my-lib/src/foo/hello.tsx')).toBeTruthy();
    expect(tree.exists('my-lib/src/foo/hello.spec.tsx')).toBeTruthy();
    expect(tree.exists('my-lib/src/foo/hello.module.css')).toBeTruthy();
  });

  it('should work with path as a part of the component name', async () => {
    await componentGenerator(tree, {
      path: `${libName}/src/btn/btn`,
      style: 'css',
    });

    expect(tree.exists(`${libName}/src/btn/btn.tsx`)).toBeTruthy();
  });
});
