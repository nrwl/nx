import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createApp, createEmptyWorkspace } from '../../utils/testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';
import * as stripJsonComments from 'strip-json-comments';
import { readJsonInTree } from '../../utils/ast-utils';

describe('lib', () => {
  const schematicRunner = new SchematicTestRunner(
    '@nrwl/schematics',
    path.join(__dirname, '../../collection.json')
  );

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('not nested', () => {
    it('should update ng-package.json', () => {
      const publishableTree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', publishable: true },
        appTree
      );
      let ngPackage = readJsonInTree(
        publishableTree,
        'libs/my-lib/ng-package.json'
      );

      expect(ngPackage.dest).toEqual('../../dist/libs/my-lib');
    });

    it('should not update package.json by default', () => {
      const tree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib' },
        appTree
      );
      const packageJson = readJsonInTree(tree, '/package.json');
      expect(packageJson.devDependencies['ng-packagr']).toBeUndefined();
    });

    it('should update package.json when publishable', () => {
      const tree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', publishable: true },
        appTree
      );
      const packageJson = readJsonInTree(tree, '/package.json');
      expect(packageJson.devDependencies['ng-packagr']).toBeDefined();
    });

    it("should update npmScope of lib's package.json when publishable", () => {
      const tree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', publishable: true },
        appTree
      );
      const packageJson = readJsonInTree(tree, '/libs/my-lib/package.json');
      expect(packageJson.name).toEqual('@proj/my-lib');
    });

    it('should update angular.json', () => {
      const tree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', publishable: true },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');

      expect(angularJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(angularJson.projects['my-lib'].architect.build).toBeDefined();
    });

    it('should remove "build" target from angular.json when a library is not publishable', () => {
      const tree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', publishable: false },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');

      expect(angularJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(angularJson.projects['my-lib'].architect.build).not.toBeDefined();
    });

    it('should update nx.json', () => {
      const tree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-lib': {
            tags: ['one', 'two']
          }
        }
      });
    });

    it('should update tsconfig.json', () => {
      const tree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib' },
        appTree
      );
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts'
      ]);
    });

    it('should generate files', () => {
      const tree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib' },
        appTree
      );
      expect(tree.exists(`libs/my-lib/karma.conf.js`)).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.module.ts')).toBeTruthy();

      expect(
        tree.exists('libs/my-lib/src/lib/my-lib.component.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-lib/src/lib/my-lib.component.spec.ts')
      ).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.service.ts')).toBeFalsy();
      expect(
        tree.exists('libs/my-lib/src/lib/my-lib.service.spec.ts')
      ).toBeFalsy();
    });

    it('should default the prefix to npmScope', () => {
      const noPrefix = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib' },
        appTree
      );
      expect(
        JSON.parse(noPrefix.read('angular.json').toString()).projects['my-lib']
          .prefix
      ).toEqual('proj');

      const withPrefix = schematicRunner.runSchematic(
        'app',
        { name: 'myLib', prefix: 'custom' },
        appTree
      );
      expect(
        JSON.parse(withPrefix.read('angular.json').toString()).projects[
          'my-lib'
        ].prefix
      ).toEqual('custom');
    });
  });

  describe('nested', () => {
    it('should generate files', () => {
      const tree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir' },
        appTree
      );
      expect(tree.exists(`libs/my-dir/my-lib/karma.conf.js`)).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
      ).toBeTruthy();

      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-lib.component.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-lib.component.spec.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-lib.service.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-lib.service.spec.ts')
      ).toBeFalsy();
    });

    it('should update ng-package.json', () => {
      const publishableTree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir', publishable: true },
        appTree
      );

      let ngPackage = readJsonInTree(
        publishableTree,
        'libs/my-dir/my-lib/ng-package.json'
      );
      expect(ngPackage.dest).toEqual('../../../dist/libs/my-dir/my-lib');
    });

    it('should update angular.json', () => {
      const tree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir' },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');

      expect(angularJson.projects['my-dir-my-lib'].root).toEqual(
        'libs/my-dir/my-lib'
      );
    });

    it('should update tsconfig.json', () => {
      const tree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir' },
        appTree
      );
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']).toEqual(
        ['libs/my-dir/my-lib/src/index.ts']
      );
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });
  });

  describe('router', () => {
    it('should error when lazy is set without routing', () => {
      expect(() =>
        schematicRunner.runSchematic(
          'lib',
          { name: 'myLib', lazy: true },
          appTree
        )
      ).toThrow('routing must be set');
    });

    describe('lazy', () => {
      it('should add RouterModule.forChild', () => {
        const tree = schematicRunner.runSchematic(
          'lib',
          { name: 'myLib', directory: 'myDir', routing: true, lazy: true },
          appTree
        );

        expect(
          tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
        ).toBeTruthy();
        expect(
          getFileContent(
            tree,
            'libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts'
          )
        ).toContain('RouterModule.forChild');
      });

      it('should update the parent module', () => {
        appTree = createApp(appTree, 'myapp');
        const tree = schematicRunner.runSchematic(
          'lib',
          {
            name: 'myLib',
            directory: 'myDir',
            routing: true,
            lazy: true,
            parentModule: 'apps/myapp/src/app/app.module.ts'
          },
          appTree
        );
        expect(
          getFileContent(tree, 'apps/myapp/src/app/app.module.ts')
        ).toContain(
          `RouterModule.forRoot([{path: 'my-dir-my-lib', loadChildren: '@proj/my-dir/my-lib#MyDirMyLibModule'}])`
        );

        const tsConfigAppJson = JSON.parse(
          stripJsonComments(
            getFileContent(tree, 'apps/myapp/tsconfig.app.json')
          )
        );
        expect(tsConfigAppJson.include).toEqual([
          '**/*.ts',
          '../../libs/my-dir/my-lib/src/index.ts'
        ]);

        const tree2 = schematicRunner.runSchematic(
          'lib',
          {
            name: 'myLib2',
            directory: 'myDir',
            routing: true,
            lazy: true,
            parentModule: 'apps/myapp/src/app/app.module.ts'
          },
          tree
        );
        expect(
          getFileContent(tree2, 'apps/myapp/src/app/app.module.ts')
        ).toContain(
          `RouterModule.forRoot([{path: 'my-dir-my-lib', loadChildren: '@proj/my-dir/my-lib#MyDirMyLibModule'}, {path: 'my-dir-my-lib2', loadChildren: '@proj/my-dir/my-lib2#MyDirMyLib2Module'}])`
        );

        const tsConfigAppJson2 = JSON.parse(
          stripJsonComments(
            getFileContent(tree2, 'apps/myapp/tsconfig.app.json')
          )
        );
        expect(tsConfigAppJson2.include).toEqual([
          '**/*.ts',
          '../../libs/my-dir/my-lib/src/index.ts',
          '../../libs/my-dir/my-lib2/src/index.ts'
        ]);
      });
    });

    describe('eager', () => {
      it('should add RouterModule and define an array of routes', () => {
        const tree = schematicRunner.runSchematic(
          'lib',
          { name: 'myLib', directory: 'myDir', routing: true },
          appTree
        );
        expect(
          tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
        ).toBeTruthy();
        expect(
          getFileContent(
            tree,
            'libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts'
          )
        ).toContain('RouterModule');
        expect(
          getFileContent(
            tree,
            'libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts'
          )
        ).toContain('const myDirMyLibRoutes: Route[] = ');
      });

      it('should update the parent module', () => {
        appTree = createApp(appTree, 'myapp');
        const tree = schematicRunner.runSchematic(
          'lib',
          {
            name: 'myLib',
            directory: 'myDir',
            routing: true,
            parentModule: 'apps/myapp/src/app/app.module.ts'
          },
          appTree
        );
        expect(
          getFileContent(tree, 'apps/myapp/src/app/app.module.ts')
        ).toContain(
          `RouterModule.forRoot([{path: 'my-dir-my-lib', children: myDirMyLibRoutes}])`
        );

        const tree2 = schematicRunner.runSchematic(
          'lib',
          {
            name: 'myLib2',
            directory: 'myDir',
            routing: true,
            parentModule: 'apps/myapp/src/app/app.module.ts'
          },
          tree
        );
        expect(
          getFileContent(tree2, 'apps/myapp/src/app/app.module.ts')
        ).toContain(
          `RouterModule.forRoot([{path: 'my-dir-my-lib', children: myDirMyLibRoutes}, {path: 'my-dir-my-lib2', children: myDirMyLib2Routes}])`
        );
      });
    });
  });

  describe('--unit-test-runner jest', () => {
    beforeEach(() => {
      appTree = schematicRunner.runSchematic('jest', {}, appTree);
    });

    it('should generate jest configuration', () => {
      const resultTree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', unitTestRunner: 'jest' },
        appTree
      );
      expect(resultTree.exists('libs/my-lib/src/test.ts')).toBeFalsy();
      expect(resultTree.exists('libs/my-lib/src/test-setup.ts')).toBeTruthy();
      expect(resultTree.exists('libs/my-lib/tsconfig.spec.json')).toBeTruthy();
      expect(resultTree.exists('libs/my-lib/jest.config.js')).toBeTruthy();
      const angularJson = readJsonInTree(resultTree, 'angular.json');
      expect(angularJson.projects['my-lib'].architect.test.builder).toEqual(
        '@nrwl/builders:jest'
      );
      expect(
        angularJson.projects['my-lib'].architect.lint.options.tsConfig
      ).toEqual([
        'libs/my-lib/tsconfig.lib.json',
        'libs/my-lib/tsconfig.spec.json'
      ]);
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', () => {
      const resultTree = schematicRunner.runSchematic(
        'lib',
        { name: 'myLib', unitTestRunner: 'none' },
        appTree
      );
      expect(
        resultTree.exists('libs/my-lib/src/lib/my-lib.module.spec.ts')
      ).toBeFalsy();
      expect(resultTree.exists('libs/my-lib/src/test.ts')).toBeFalsy();
      expect(resultTree.exists('libs/my-lib/src/test.ts')).toBeFalsy();
      expect(resultTree.exists('libs/my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(resultTree.exists('libs/my-lib/jest.config.js')).toBeFalsy();
      expect(resultTree.exists('libs/my-lib/karma.config.js')).toBeFalsy();
      const angularJson = readJsonInTree(resultTree, 'angular.json');
      expect(angularJson.projects['my-lib'].architect.test).toBeUndefined();
      expect(
        angularJson.projects['my-lib'].architect.lint.options.tsConfig
      ).toEqual(['libs/my-lib/tsconfig.lib.json']);
    });
  });
});
