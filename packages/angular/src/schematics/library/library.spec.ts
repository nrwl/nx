import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace, getFileContent } from '@nrwl/workspace/testing';
import { createApp, runSchematic } from '../../utils/testing';
import * as stripJsonComments from 'strip-json-comments';
import { NxJson, readJsonInTree } from '@nrwl/workspace';
import { UnitTestTree } from '@angular-devkit/schematics/testing';

describe('lib', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('not nested', () => {
    it('should update ng-package.json', async () => {
      const publishableTree = await runSchematic(
        'lib',
        { name: 'myLib', framework: 'angular', publishable: true },
        appTree
      );
      let ngPackage = readJsonInTree(
        publishableTree,
        'libs/my-lib/ng-package.json'
      );

      expect(ngPackage.dest).toEqual('../../dist/libs/my-lib');
    });

    it('should not update package.json by default', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const packageJson = readJsonInTree(tree, '/package.json');
      expect(packageJson.devDependencies['ng-packagr']).toBeUndefined();
    });

    it('should update package.json when publishable', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', framework: 'angular', publishable: true },
        appTree
      );
      const packageJson = readJsonInTree(tree, '/package.json');
      expect(packageJson.devDependencies['ng-packagr']).toBeDefined();
    });

    it("should update npmScope of lib's package.json when publishable", async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', framework: 'angular', publishable: true },
        appTree
      );
      const packageJson = readJsonInTree(tree, '/libs/my-lib/package.json');
      expect(packageJson.name).toEqual('@proj/my-lib');
    });

    it("should update npmScope of lib's package.json when publishable", async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', publishable: true, prefix: 'lib' },
        appTree
      );
      const packageJson = readJsonInTree(tree, '/libs/my-lib/package.json');
      expect(packageJson.name).toEqual('@proj/my-lib');
    });

    it('should update angular.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', framework: 'angular', publishable: true },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');

      expect(angularJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(angularJson.projects['my-lib'].architect.build).toBeDefined();
    });

    it('should remove "build" target from angular.json when a library is not publishable', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', publishable: false },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');

      expect(angularJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(angularJson.projects['my-lib'].architect.build).not.toBeDefined();
    });

    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-lib': {
            tags: ['one', 'two']
          }
        }
      });
    });

    it('should update root tsconfig.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const tsconfigJson = readJsonInTree(tree, '/tsconfig.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts'
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const tsconfigJson = readJsonInTree(tree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson).toEqual({
        extends: '../../tsconfig.json',
        compilerOptions: {
          types: ['node', 'jest']
        },
        include: ['**/*.ts']
      });
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const tsconfigJson = readJsonInTree(
        tree,
        'libs/my-lib/tsconfig.spec.json'
      );
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
      const tree = await runSchematic('lib', { name: 'myLib' }, appTree);
      const tsconfigJson = readJsonInTree(
        tree,
        'libs/my-lib/tsconfig.lib.json'
      );
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should generate files', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', framework: 'angular' },
        appTree
      );
      expect(tree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
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

      const tree2 = await runSchematic(
        'lib',
        { name: 'myLib2', framework: 'angular', simpleModuleName: true },
        tree
      );
      expect(tree2.exists(`libs/my-lib2/jest.config.js`)).toBeTruthy();
      expect(tree2.exists('libs/my-lib2/src/index.ts')).toBeTruthy();
      expect(
        tree2.exists('libs/my-lib2/src/lib/my-lib2.module.ts')
      ).toBeTruthy();

      expect(
        tree.exists('libs/my-lib2/src/lib/my-lib2.component.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-lib2/src/lib/my-lib2.component.spec.ts')
      ).toBeFalsy();
      expect(
        tree2.exists('libs/my-lib2/src/lib/my-lib2.service.ts')
      ).toBeFalsy();
      expect(
        tree2.exists('libs/my-lib2/src/lib/my-lib2.service.spec.ts')
      ).toBeFalsy();
    });

    it('should default the prefix to npmScope', async () => {
      const noPrefix = await runSchematic('lib', { name: 'myLib' }, appTree);
      expect(
        JSON.parse(noPrefix.read('angular.json').toString()).projects['my-lib']
          .prefix
      ).toEqual('proj');

      const withPrefix = await runSchematic(
        'lib',
        { name: 'myLib', prefix: 'custom' },
        appTree
      );
      expect(
        JSON.parse(withPrefix.read('angular.json').toString()).projects[
          'my-lib'
        ].prefix
      ).toEqual('custom');
    });

    describe('--framework', () => {
      describe('none', () => {
        let tree: UnitTestTree;
        beforeEach(async () => {
          tree = await runSchematic(
            'lib',
            {
              name: 'myLib',
              framework: 'none'
            },
            appTree
          );
        });

        it('should generate a basic typescript lib', () => {
          expect(
            tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
          ).toEqual(false);
          expect(
            tree.exists(
              'libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.spec.ts'
            )
          ).toEqual(false);
        });
      });
    });
  });

  describe('nested', () => {
    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          directory: 'myDir',
          framework: 'angular',
          tags: 'one'
        },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-dir-my-lib': {
            tags: ['one']
          }
        }
      });

      const tree2 = await runSchematic(
        'lib',
        {
          name: 'myLib2',
          directory: 'myDir',
          framework: 'angular',
          tags: 'one,two',
          simpleModuleName: true
        },
        tree
      );
      const nxJson2 = readJsonInTree<NxJson>(tree2, '/nx.json');
      expect(nxJson2).toEqual({
        npmScope: 'proj',
        projects: {
          'my-dir-my-lib': {
            tags: ['one']
          },
          'my-dir-my-lib2': {
            tags: ['one', 'two']
          }
        }
      });
    });

    it('should generate files', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir', framework: 'angular' },
        appTree
      );
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.js`)).toBeTruthy();
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

      const tree2 = await runSchematic(
        'lib',
        {
          name: 'myLib2',
          directory: 'myDir',
          framework: 'angular',
          simpleModuleName: true
        },
        tree
      );
      expect(tree2.exists(`libs/my-dir/my-lib2/jest.config.js`)).toBeTruthy();
      expect(tree2.exists('libs/my-dir/my-lib2/src/index.ts')).toBeTruthy();
      expect(
        tree2.exists('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
      ).toBeTruthy();

      expect(
        tree2.exists('libs/my-dir/my-lib2/src/lib/my-lib2.component.ts')
      ).toBeFalsy();
      expect(
        tree2.exists('libs/my-dir/my-lib2/src/lib/my-lib2.component.spec.ts')
      ).toBeFalsy();
      expect(
        tree2.exists('libs/my-dir/my-lib2/src/lib/my-lib2.service.ts')
      ).toBeFalsy();
      expect(
        tree2.exists('libs/my-dir/my-lib2/src/lib/my-lib2.service.spec.ts')
      ).toBeFalsy();
    });

    it('should update ng-package.json', async () => {
      const publishableTree = await runSchematic(
        'lib',
        {
          name: 'myLib',
          directory: 'myDir',
          framework: 'angular',
          publishable: true
        },
        appTree
      );

      let ngPackage = readJsonInTree(
        publishableTree,
        'libs/my-dir/my-lib/ng-package.json'
      );
      expect(ngPackage.dest).toEqual('../../../dist/libs/my-dir/my-lib');
    });

    it('should update angular.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir' },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');

      expect(angularJson.projects['my-dir-my-lib'].root).toEqual(
        'libs/my-dir/my-lib'
      );
    });

    it('should update tsconfig.json', async () => {
      const tree = await runSchematic(
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

    it('should create a local tsconfig.json', async () => {
      const tree = await runSchematic(
        'lib',
        { name: 'myLib', directory: 'myDir' },
        appTree
      );

      const tsconfigJson = readJsonInTree(
        tree,
        'libs/my-dir/my-lib/tsconfig.json'
      );
      expect(tsconfigJson).toEqual({
        extends: '../../../tsconfig.json',
        compilerOptions: {
          types: ['node', 'jest']
        },
        include: ['**/*.ts']
      });
    });
  });

  describe('router', () => {
    it('should error when lazy is set without routing', async () => {
      try {
        await runSchematic('lib', { name: 'myLib', lazy: true }, appTree);
        fail();
      } catch (e) {
        expect(e.message).toEqual('routing must be set');
      }
    });

    describe('lazy', () => {
      it('should add RouterModule.forChild', async () => {
        const tree = await runSchematic(
          'lib',
          {
            name: 'myLib',
            directory: 'myDir',
            framework: 'angular',
            routing: true,
            lazy: true
          },
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

        const tree2 = await runSchematic(
          'lib',
          {
            name: 'myLib2',
            directory: 'myDir',
            routing: true,
            framework: 'angular',
            lazy: true,
            simpleModuleName: true
          },
          tree
        );

        expect(
          tree2.exists('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
        ).toBeTruthy();
        expect(
          getFileContent(tree2, 'libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
        ).toContain('RouterModule.forChild');
      });

      it('should update the parent module', async () => {
        appTree = createApp(appTree, 'myapp');
        const tree = await runSchematic(
          'lib',
          {
            name: 'myLib',
            directory: 'myDir',
            routing: true,
            lazy: true,
            framework: 'angular',
            parentModule: 'apps/myapp/src/app/app.module.ts'
          },
          appTree
        );
        const moduleContents = getFileContent(
          tree,
          'apps/myapp/src/app/app.module.ts'
        );
        expect(moduleContents).toContain('RouterModule.forRoot([');
        expect(moduleContents).toContain(`
      {
        path: 'my-dir-my-lib',
        loadChildren: '@proj/my-dir/my-lib#MyDirMyLibModule'
      }`);

        const tsConfigAppJson = JSON.parse(
          stripJsonComments(
            getFileContent(tree, 'apps/myapp/tsconfig.app.json')
          )
        );
        expect(tsConfigAppJson.include).toEqual([
          '**/*.ts',
          '../../libs/my-dir/my-lib/src/index.ts'
        ]);

        const tree2 = await runSchematic(
          'lib',
          {
            name: 'myLib2',
            directory: 'myDir',
            routing: true,
            framework: 'angular',
            lazy: true,
            parentModule: 'apps/myapp/src/app/app.module.ts'
          },
          tree
        );
        const moduleContents2 = getFileContent(
          tree2,
          'apps/myapp/src/app/app.module.ts'
        );
        expect(moduleContents2).toContain('RouterModule.forRoot([');
        expect(moduleContents2).toContain(`
      {
        path: 'my-dir-my-lib',
        loadChildren: '@proj/my-dir/my-lib#MyDirMyLibModule'
      }`);
        expect(moduleContents2).toContain(`
      {
        path: 'my-dir-my-lib2',
        loadChildren: '@proj/my-dir/my-lib2#MyDirMyLib2Module'
      }`);

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

        const tree3 = await runSchematic(
          'lib',
          {
            name: 'myLib3',
            directory: 'myDir',
            routing: true,
            framework: 'angular',
            lazy: true,
            parentModule: 'apps/myapp/src/app/app.module.ts',
            simpleModuleName: true
          },
          tree2
        );
        const moduleContents3 = getFileContent(
          tree3,
          'apps/myapp/src/app/app.module.ts'
        );
        expect(moduleContents3).toContain('RouterModule.forRoot([');
        expect(moduleContents3).toContain(`
      {
        path: 'my-dir-my-lib',
        loadChildren: '@proj/my-dir/my-lib#MyDirMyLibModule'
      }`);
        expect(moduleContents3).toContain(`
      {
        path: 'my-dir-my-lib2',
        loadChildren: '@proj/my-dir/my-lib2#MyDirMyLib2Module'
      }`);
        expect(moduleContents3).toContain(
          `{ path: 'my-lib3', loadChildren: '@proj/my-dir/my-lib3#MyLib3Module' }`
        );

        const tsConfigAppJson3 = JSON.parse(
          stripJsonComments(
            getFileContent(tree3, 'apps/myapp/tsconfig.app.json')
          )
        );
        expect(tsConfigAppJson3.include).toEqual([
          '**/*.ts',
          '../../libs/my-dir/my-lib/src/index.ts',
          '../../libs/my-dir/my-lib2/src/index.ts',
          '../../libs/my-dir/my-lib3/src/index.ts'
        ]);
      });
    });

    describe('eager', () => {
      it('should add RouterModule and define an array of routes', async () => {
        const tree = await runSchematic(
          'lib',
          {
            name: 'myLib',
            directory: 'myDir',
            framework: 'angular',
            routing: true
          },
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

        const tree2 = await runSchematic(
          'lib',
          {
            name: 'myLib2',
            directory: 'myDir',
            routing: true,
            framework: 'angular',
            simpleModuleName: true
          },
          tree
        );
        expect(
          tree2.exists('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
        ).toBeTruthy();
        expect(
          getFileContent(tree2, 'libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
        ).toContain('RouterModule');
        expect(
          getFileContent(tree2, 'libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
        ).toContain('const myLib2Routes: Route[] = ');
      });

      it('should update the parent module', async () => {
        appTree = createApp(appTree, 'myapp');
        const tree = await runSchematic(
          'lib',
          {
            name: 'myLib',
            directory: 'myDir',
            routing: true,
            framework: 'angular',
            parentModule: 'apps/myapp/src/app/app.module.ts'
          },
          appTree
        );
        const moduleContents = getFileContent(
          tree,
          'apps/myapp/src/app/app.module.ts'
        );
        expect(moduleContents).toContain('MyDirMyLibModule');
        expect(moduleContents).toContain('RouterModule.forRoot([');
        expect(moduleContents).toContain(
          "{ path: 'my-dir-my-lib', children: myDirMyLibRoutes }"
        );

        const tree2 = await runSchematic(
          'lib',
          {
            name: 'myLib2',
            directory: 'myDir',
            routing: true,
            framework: 'angular',
            parentModule: 'apps/myapp/src/app/app.module.ts'
          },
          tree
        );
        const moduleContents2 = getFileContent(
          tree2,
          'apps/myapp/src/app/app.module.ts'
        );
        expect(moduleContents2).toContain('MyDirMyLib2Module');
        expect(moduleContents2).toContain('RouterModule.forRoot([');
        expect(moduleContents2).toContain(
          "{ path: 'my-dir-my-lib', children: myDirMyLibRoutes }"
        );
        expect(moduleContents2).toContain(
          "{ path: 'my-dir-my-lib2', children: myDirMyLib2Routes }"
        );

        const tree3 = await runSchematic(
          'lib',
          {
            name: 'myLib3',
            directory: 'myDir',
            routing: true,
            framework: 'angular',
            parentModule: 'apps/myapp/src/app/app.module.ts',
            simpleModuleName: true
          },
          tree2
        );
        const moduleContents3 = getFileContent(
          tree3,
          'apps/myapp/src/app/app.module.ts'
        );
        expect(moduleContents3).toContain('MyLib3Module');
        expect(moduleContents3).toContain('RouterModule.forRoot([');
        expect(moduleContents3).toContain(
          "{ path: 'my-dir-my-lib', children: myDirMyLibRoutes }"
        );
        expect(moduleContents3).toContain(
          "{ path: 'my-dir-my-lib2', children: myDirMyLib2Routes }"
        );
        expect(moduleContents3).toContain(
          "{ path: 'my-lib3', children: myLib3Routes }"
        );
      });
    });
  });

  describe('--style scss', () => {
    it('should set it as default', async () => {
      const result = await runSchematic(
        'lib',
        { name: 'myLib', style: 'scss' },
        appTree
      );

      const angularJson = readJsonInTree(result, 'angular.json');

      expect(angularJson.projects['my-lib'].schematics).toEqual({
        '@nrwl/workspace:component': {
          styleext: 'scss'
        }
      });
    });
  });

  describe('--unit-test-runner karma', () => {
    it('should generate karma configuration', async () => {
      const resultTree = await runSchematic(
        'lib',
        { name: 'myLib', unitTestRunner: 'karma' },
        appTree
      );
      expect(resultTree.exists('libs/my-lib/src/test.ts')).toBeTruthy();
      expect(resultTree.exists('libs/my-lib/src/test-setup.ts')).toBeFalsy();
      expect(resultTree.exists('libs/my-lib/tsconfig.spec.json')).toBeTruthy();
      expect(resultTree.exists('libs/my-lib/karma.conf.js')).toBeTruthy();
      expect(resultTree.exists('karma.conf.js')).toBeTruthy();
      const angularJson = readJsonInTree(resultTree, 'angular.json');
      expect(angularJson.projects['my-lib'].architect.test.builder).toEqual(
        '@angular-devkit/build-angular:karma'
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
    it('should not generate test configuration', async () => {
      const resultTree = await runSchematic(
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
      expect(resultTree.exists('libs/my-lib/karma.conf.js')).toBeFalsy();
      const angularJson = readJsonInTree(resultTree, 'angular.json');
      expect(angularJson.projects['my-lib'].architect.test).toBeUndefined();
      expect(
        angularJson.projects['my-lib'].architect.lint.options.tsConfig
      ).toEqual(['libs/my-lib/tsconfig.lib.json']);
    });
  });
});
