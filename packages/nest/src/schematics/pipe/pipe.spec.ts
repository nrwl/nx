import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace, getFileContent } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

describe('pipe', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate pipe and spec', async () => {
    const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

    const pipeTree = await runSchematic(
      'pipe',
      { name: 'myPipe', project: 'my-lib' },
      libTree
    );

    expect(pipeTree.exists(`libs/my-lib/src/lib/my-pipe.pipe.ts`)).toBeTruthy();
    expect(
      pipeTree.exists(`libs/my-lib/src/lib/my-pipe.pipe.spec.ts`)
    ).toBeTruthy();

    const barrel = getFileContent(pipeTree, 'libs/my-lib/src/index.ts');
    expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-pipe.pipe';
        `);
  });

  it('should generate only pipe', async () => {
    const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

    const pipeTree = await runSchematic(
      'pipe',
      { name: 'myPipe', project: 'my-lib', unitTestRunner: 'none' },
      libTree
    );

    expect(pipeTree.exists(`libs/my-lib/src/lib/my-pipe.pipe.ts`)).toBeTruthy();
    expect(
      pipeTree.exists(`libs/my-lib/src/lib/my-pipe.pipe.spec.ts`)
    ).toBeFalsy();

    const barrel = getFileContent(pipeTree, 'libs/my-lib/src/index.ts');
    expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-pipe.pipe';
        `);
  });
});
