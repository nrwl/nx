import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace, getFileContent } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

describe('middleware', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate middleware and spec', async () => {
    const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

    const middlewareTree = await runSchematic(
      'middleware',
      { name: 'myMiddleware', project: 'my-lib' },
      libTree
    );

    expect(
      middlewareTree.exists(`libs/my-lib/src/lib/my-middleware.middleware.ts`)
    ).toBeTruthy();
    expect(
      middlewareTree.exists(
        `libs/my-lib/src/lib/my-middleware.middleware.spec.ts`
      )
    ).toBeTruthy();

    const barrel = getFileContent(middlewareTree, 'libs/my-lib/src/index.ts');
    expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-middleware.middleware';
        `);
  });

  it('should generate only middleware', async () => {
    const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

    const middlewareTree = await runSchematic(
      'middleware',
      { name: 'myMiddleware', project: 'my-lib', unitTestRunner: 'none' },
      libTree
    );

    expect(
      middlewareTree.exists(`libs/my-lib/src/lib/my-middleware.middleware.ts`)
    ).toBeTruthy();
    expect(
      middlewareTree.exists(
        `libs/my-lib/src/lib/my-middleware.middleware.spec.ts`
      )
    ).toBeFalsy();

    const barrel = getFileContent(middlewareTree, 'libs/my-lib/src/index.ts');
    expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-middleware.middleware';
        `);
  });
});
