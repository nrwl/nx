import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace, getFileContent } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

describe('controller', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('without service', function() {
    it('should generate controller and spec', async () => {
      const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

      const controllerTree = await runSchematic(
        'controller',
        { name: 'myController', project: 'my-lib' },
        libTree
      );

      expect(
        controllerTree.exists(`libs/my-lib/src/lib/my-controller.controller.ts`)
      ).toBeTruthy();
      expect(
        controllerTree.exists(
          `libs/my-lib/src/lib/my-controller.controller.spec.ts`
        )
      ).toBeTruthy();

      const barrel = getFileContent(controllerTree, 'libs/my-lib/src/index.ts');
      expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-controller.controller';
            export * from './lib/my-lib.module';
        `);
    });

    it('should generate only controller', async () => {
      const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

      const controllerTree = await runSchematic(
        'controller',
        { name: 'myController', project: 'my-lib', unitTestRunner: 'none' },
        libTree
      );

      expect(
        controllerTree.exists(`libs/my-lib/src/lib/my-controller.controller.ts`)
      ).toBeTruthy();
      expect(
        controllerTree.exists(
          `libs/my-lib/src/lib/my-controller.controller.spec.ts`
        )
      ).toBeFalsy();

      const barrel = getFileContent(controllerTree, 'libs/my-lib/src/index.ts');
      expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-controller.controller';
            export * from './lib/my-lib.module';
        `);
    });
  });

  describe('with service', function() {
    it('should generate controller and spec', async () => {
      const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

      const controllerTree = await runSchematic(
        'controller',
        { name: 'myController', project: 'my-lib', service: true },
        libTree
      );

      expect(
        controllerTree.exists(`libs/my-lib/src/lib/my-controller.controller.ts`)
      ).toBeTruthy();
      expect(
        controllerTree.exists(`libs/my-lib/src/lib/my-controller.service.ts`)
      ).toBeTruthy();
      expect(
        controllerTree.exists(
          `libs/my-lib/src/lib/my-controller.controller.spec.ts`
        )
      ).toBeTruthy();

      expect(
        controllerTree.exists(
          `libs/my-lib/src/lib/my-controller.service.spec.ts`
        )
      ).toBeTruthy();

      const barrel = getFileContent(controllerTree, 'libs/my-lib/src/index.ts');
      expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-controller.controller';
            export * from './lib/my-controller.service';
            export * from './lib/my-lib.module';
        `);
    });

    it('should generate only controller', async () => {
      const libTree = await runSchematic('lib', { name: 'myLib' }, appTree);

      const controllerTree = await runSchematic(
        'controller',
        {
          name: 'myController',
          project: 'my-lib',
          unitTestRunner: 'none',
          service: true
        },
        libTree
      );

      expect(
        controllerTree.exists(`libs/my-lib/src/lib/my-controller.controller.ts`)
      ).toBeTruthy();
      expect(
        controllerTree.exists(
          `libs/my-lib/src/lib/my-controller.controller.spec.ts`
        )
      ).toBeFalsy();

      expect(
        controllerTree.exists(`libs/my-lib/src/lib/my-controller.service.ts`)
      ).toBeTruthy();
      expect(
        controllerTree.exists(
          `libs/my-lib/src/lib/my-controller.service.spec.ts`
        )
      ).toBeFalsy();

      const barrel = getFileContent(controllerTree, 'libs/my-lib/src/index.ts');
      expect(stripIndents`${barrel}`).toEqual(stripIndents`
            export * from './lib/my-controller.controller';
            export * from './lib/my-controller.service';
            export * from './lib/my-lib.module';
        `);
    });
  });
});
