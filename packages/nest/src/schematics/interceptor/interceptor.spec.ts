import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace, getFileContent } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

describe('interceptor', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate interceptor and spec', async () => {
    const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

    const interceptorTree = await runSchematic(
      'interceptor',
      { name: 'myInterceptor', project: 'my-lib' },
      libTree
    );

    expect(
      interceptorTree.exists(
        `libs/my-lib/src/lib/my-interceptor.interceptor.ts`
      )
    ).toBeTruthy();
    expect(
      interceptorTree.exists(
        `libs/my-lib/src/lib/my-interceptor.interceptor.spec.ts`
      )
    ).toBeTruthy();

    const barrel = getFileContent(interceptorTree, 'libs/my-lib/src/index.ts');
    expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-interceptor.interceptor';
        `);
  });

  it('should generate only interceptor', async () => {
    const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

    const interceptorTree = await runSchematic(
      'interceptor',
      { name: 'myInterceptor', project: 'my-lib', unitTestRunner: 'none' },
      libTree
    );

    expect(
      interceptorTree.exists(
        `libs/my-lib/src/lib/my-interceptor.interceptor.ts`
      )
    ).toBeTruthy();
    expect(
      interceptorTree.exists(
        `libs/my-lib/src/lib/my-interceptor.interceptor.spec.ts`
      )
    ).toBeFalsy();

    const barrel = getFileContent(interceptorTree, 'libs/my-lib/src/index.ts');
    expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-interceptor.interceptor';
        `);
  });
});
