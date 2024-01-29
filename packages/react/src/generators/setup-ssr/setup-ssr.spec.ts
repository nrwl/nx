import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, Tree } from '@nx/devkit';
import applicationGenerator from '../application/application';
import setupSsrGenerator from './setup-ssr';
import { Linter } from '@nx/eslint';

describe('setupSsrGenerator', () => {
  let tree: Tree;

  // TODO(@jaysoo): Turn this back to adding the plugin
  let originalEnv: string;

  beforeEach(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
  });

  afterEach(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
  });

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
      skipFormat: true,
    });
  });

  it('should add SSR files', async () => {
    await setupSsrGenerator(tree, {
      project: 'my-app',
    });

    expect(tree.exists(`my-app/server.ts`)).toBeTruthy();
    expect(tree.exists(`my-app/tsconfig.server.json`)).toBeTruthy();
  });

  it('should support adding additional include files', async () => {
    await setupSsrGenerator(tree, {
      project: 'my-app',
      extraInclude: ['src/remote.d.ts'],
    });

    expect(tree.exists(`my-app/server.ts`)).toBeTruthy();
    expect(readJson(tree, `my-app/tsconfig.server.json`)).toMatchObject({
      include: ['src/remote.d.ts', 'src/main.server.tsx', 'server.ts'],
    });
  });
});
