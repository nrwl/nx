import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, Tree } from '@nrwl/devkit';
import applicationGenerator from '../application/application';
import setupSsrGenerator from './setup-ssr';
import { Linter } from '@nrwl/linter';

describe('setupSsrGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    applicationGenerator(tree, {
      name: 'my-app',
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
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
