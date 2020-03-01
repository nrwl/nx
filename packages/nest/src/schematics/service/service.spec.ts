import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace, getFileContent } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

describe('service', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate service and spec', async () => {
    const libTree = await runSchematic(
      'lib',
      { name: 'myLib', global: true },
      appTree
    );

    const serviceTree = await runSchematic(
      'service',
      { name: 'myService', project: 'my-lib' },
      libTree
    );

    expect(
      serviceTree.exists(`libs/my-lib/src/lib/my-service.service.ts`)
    ).toBeTruthy();
    expect(
      serviceTree.exists(`libs/my-lib/src/lib/my-service.service.spec.ts`)
    ).toBeTruthy();

    const barrel = getFileContent(serviceTree, 'libs/my-lib/src/index.ts');
    expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-service.service';
            export * from './lib/my-lib.module';
        `);
  });

  it('should generate only service', async () => {
    const libTree = await runSchematic(
      'lib',
      { name: 'myLib', global: true },
      appTree
    );

    const serviceTree = await runSchematic(
      'service',
      { name: 'myService', project: 'my-lib', unitTestRunner: 'none' },
      libTree
    );

    expect(
      serviceTree.exists(`libs/my-lib/src/lib/my-service.service.ts`)
    ).toBeTruthy();
    expect(
      serviceTree.exists(`libs/my-lib/src/lib/my-service.service.spec.ts`)
    ).toBeFalsy();

    const barrel = getFileContent(serviceTree, 'libs/my-lib/src/index.ts');
    expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-service.service';
            export * from './lib/my-lib.module';
        `);
  });
});
