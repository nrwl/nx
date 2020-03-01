import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace, getFileContent } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

describe('guard', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate guard and spec', async () => {
    const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

    const guardTree = await runSchematic(
      'guard',
      { name: 'myGuard', project: 'my-lib' },
      libTree
    );

    expect(
      guardTree.exists(`libs/my-lib/src/lib/my-guard.guard.ts`)
    ).toBeTruthy();
    expect(
      guardTree.exists(`libs/my-lib/src/lib/my-guard.guard.spec.ts`)
    ).toBeTruthy();

    const barrel = getFileContent(guardTree, 'libs/my-lib/src/index.ts');
    expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-guard.guard';
        `);
  });

  it('should generate only guard', async () => {
    const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

    const guardTree = await runSchematic(
      'guard',
      { name: 'myGuard', project: 'my-lib', unitTestRunner: 'none' },
      libTree
    );

    expect(
      guardTree.exists(`libs/my-lib/src/lib/my-guard.guard.ts`)
    ).toBeTruthy();
    expect(
      guardTree.exists(`libs/my-lib/src/lib/my-guard.guard.spec.ts`)
    ).toBeFalsy();

    const barrel = getFileContent(guardTree, 'libs/my-lib/src/index.ts');
    expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-guard.guard';
        `);
  });
});
