import {
  readJson,
  Tree,
  updateJson,
  parseJson,
  getProjects,
  NxJsonConfiguration,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { createApp } from '../../utils/nx-devkit/testing';
import libraryGenerator from './library';
import { Schema } from './schema';
import { UnitTestRunner } from '../../utils/test-runners';
import { toNewFormat } from '@nrwl/tao/src/shared/workspace';

describe('lib', () => {
  let appTree: Tree;

  async function runLibraryGeneratorWithOpts(opts: Partial<Schema> = {}) {
    await libraryGenerator(appTree, {
      name: 'myLib',
      publishable: false,
      buildable: false,
      enableIvy: false,
      linter: Linter.EsLint,
      skipFormat: false,
      unitTestRunner: UnitTestRunner.Jest,
      simpleModuleName: false,
      strict: true,
      ...opts,
    });
  }

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  describe('workspace v2', () => {
    beforeEach(() => {
      appTree = createTreeWithEmptyWorkspace(2);
    });

    it('should default to standalone project for first project', async () => {
      await runLibraryGeneratorWithOpts();
      const workspaceJsonEntry = readJson(appTree, 'workspace.json').projects[
        'my-lib'
      ];
      const projectConfig = readProjectConfiguration(appTree, 'my-lib');
      expect(projectConfig.root).toEqual('libs/my-lib');
      expect(workspaceJsonEntry).toEqual('libs/my-lib');
    });

    it('should obey standalone === false for first project', async () => {
      await runLibraryGeneratorWithOpts({
        standaloneConfig: false,
      });
      const workspaceJsonEntry = readJson(appTree, 'workspace.json').projects[
        'my-lib'
      ];
      const projectConfig = readProjectConfiguration(appTree, 'my-lib');
      expect(projectConfig.root).toEqual('libs/my-lib');
      expect(projectConfig).toMatchObject(workspaceJsonEntry);
    });
  });

  describe('workspace v1', () => {
    beforeEach(() => {
      appTree = createTreeWithEmptyWorkspace(1);
    });

    it('should default to inline project for first project', async () => {
      await runLibraryGeneratorWithOpts({
        standaloneConfig: false,
      });
      const workspaceJsonEntry = toNewFormat(
        readJson(appTree, 'workspace.json')
      ).projects['my-lib'];
      const projectConfig = readProjectConfiguration(appTree, 'my-lib');
      expect(projectConfig.root).toEqual('libs/my-lib');
      expect(projectConfig).toMatchObject(workspaceJsonEntry);
    });

    it('should throw for standaloneConfig === true', async () => {
      const promise = runLibraryGeneratorWithOpts({
        standaloneConfig: true,
      });
      await expect(promise).rejects.toThrow();
    });
  });

  describe('not nested', () => {
    it('should update ng-package.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      let ngPackage = readJson(appTree, 'libs/my-lib/ng-package.json');

      expect(ngPackage.dest).toEqual('../../dist/libs/my-lib');
    });
    it('should update ng-package.json $schema to the correct folder', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      let ngPackage = readJson(appTree, 'libs/my-lib/ng-package.json');

      expect(ngPackage.$schema).toEqual(
        '../../node_modules/ng-packagr/ng-package.schema.json'
      );
    });

    it('should not update package.json by default', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      const packageJson = readJson(appTree, '/package.json');
      expect(packageJson.devDependencies['ng-packagr']).toBeUndefined();
      expect(packageJson.devDependencies['postcss']).toBeUndefined();
      expect(packageJson.devDependencies['postcss-import']).toBeUndefined();
      expect(packageJson.devDependencies['postcss-preset-env']).toBeUndefined();
      expect(packageJson.devDependencies['postcss-url']).toBeUndefined();
    });

    it('should update package.json when publishable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      const packageJson = readJson(appTree, '/package.json');
      expect(packageJson.devDependencies['ng-packagr']).toBeDefined();
      expect(packageJson.devDependencies['postcss']).toBeDefined();
      expect(packageJson.devDependencies['postcss-import']).toBeDefined();
      expect(packageJson.devDependencies['postcss-preset-env']).toBeDefined();
      expect(packageJson.devDependencies['postcss-url']).toBeDefined();
    });

    it('should update package.json when buildable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ buildable: true });

      // ASSERT
      const packageJson = readJson(appTree, '/package.json');
      expect(packageJson.devDependencies['ng-packagr']).toBeDefined();
      expect(packageJson.devDependencies['postcss']).toBeDefined();
      expect(packageJson.devDependencies['postcss-import']).toBeDefined();
      expect(packageJson.devDependencies['postcss-preset-env']).toBeDefined();
      expect(packageJson.devDependencies['postcss-url']).toBeDefined();
    });

    it('should update tsconfig.lib.prod.json when enableIvy', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        buildable: true,
        enableIvy: true,
      });

      // ASSERT
      const tsConfig = readJson(appTree, '/libs/my-lib/tsconfig.lib.prod.json');
      expect(tsConfig.angularCompilerOptions['enableIvy']).toBe(true);
    });

    it('should update workspace.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      const workspaceJson = readJson(appTree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(workspaceJson.projects['my-lib'].architect.build).toBeDefined();
    });

    it('should remove "build" target from workspace.json when a library is not publishable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: false,
      });

      // ASSERT
      const workspaceJson = readJson(appTree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(
        workspaceJson.projects['my-lib'].architect.build
      ).not.toBeDefined();
    });

    it('should have a "build" target when a library is buildable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        buildable: true,
        publishable: false,
      });

      // ASSERT
      const workspaceJson = readJson(appTree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(workspaceJson.projects['my-lib'].architect.build).toBeDefined();
    });

    it('should remove tsconfib.lib.prod.json when library is not publishable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: false,
        buildable: false,
      });

      // ASSERT
      const libProdConfig = appTree.read('libs/my-lib/tsconfig.lib.prod.json');

      expect(libProdConfig).toBeFalsy();
    });

    it('should update tags', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: false,
        buildable: false,
        tags: 'one,two',
      });

      // ASSERT
      const projects = Object.fromEntries(getProjects(appTree));
      expect(projects).toEqual({
        'my-lib': expect.objectContaining({
          tags: ['one', 'two'],
        }),
      });
    });

    it('should update root tsconfig.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts',
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      const tsconfigJson = readJson(appTree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson).toEqual({
        extends: '../../tsconfig.base.json',
        angularCompilerOptions: {
          strictInjectionParameters: true,
          strictInputAccessModifiers: true,
          strictTemplates: true,
        },
        compilerOptions: {
          forceConsistentCasingInFileNames: true,
          noFallthroughCasesInSwitch: true,
          noImplicitReturns: true,
          strict: true,
        },
        files: [],
        include: [],
        references: [
          {
            path: './tsconfig.lib.json',
          },
          {
            path: './tsconfig.spec.json',
          },
        ],
      });
    });

    it('should check for existence of spec files before deleting them', async () => {
      // ARRANGE
      updateJson<NxJsonConfiguration, NxJsonConfiguration>(
        appTree,
        '/nx.json',
        (nxJson) => {
          nxJson.generators = {
            '@schematics/angular:service': {
              skipTests: true,
            },
            '@schematics/angular:component': {
              skipTests: true,
            },
          };

          return nxJson;
        }
      );

      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      expect(
        appTree.read('libs/my-lib/src/lib/my-lib.component.spec.ts')
      ).toBeFalsy();
      expect(
        appTree.read('libs/my-lib/src/lib/my-lib.service.spec.ts')
      ).toBeFalsy();
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      const tsconfigJson = readJson(appTree, 'libs/my-lib/tsconfig.spec.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    describe('when creating the tsconfig.lib.json', () => {
      it('should extend the local tsconfig.json', async () => {
        // ACT
        await runLibraryGeneratorWithOpts();

        // ASSERT
        const tsconfigJson = readJson(appTree, 'libs/my-lib/tsconfig.lib.json');
        expect(tsconfigJson.extends).toEqual('./tsconfig.json');
      });

      it('should contain includes', async () => {
        // ACT
        await runLibraryGeneratorWithOpts();

        // ASSERT
        const tsConfigJson = readJson(appTree, 'libs/my-lib/tsconfig.lib.json');
        expect(tsConfigJson.include).toEqual(['**/*.ts']);
      });

      it('should exclude the test setup file when unitTestRunner is jest', async () => {
        // ACT
        await runLibraryGeneratorWithOpts();

        // ASSERT
        const tsconfigJson = readJson(appTree, 'libs/my-lib/tsconfig.lib.json');
        expect(tsconfigJson.exclude).toEqual([
          'src/test-setup.ts',
          '**/*.spec.ts',
          '**/*.test.ts',
        ]);
      });

      it('should leave the excludes alone when unitTestRunner is karma', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({
          unitTestRunner: UnitTestRunner.Karma,
        });

        // ASSERT
        const tsconfigJson = readJson(appTree, 'libs/my-lib/tsconfig.lib.json');
        expect(tsconfigJson.exclude).toEqual([
          'src/test.ts',
          '**/*.spec.ts',
          '**/*.test.ts',
        ]);
      });

      it('should remove the excludes when unitTestRunner is none', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({
          unitTestRunner: UnitTestRunner.None,
        });

        // ASSERT
        const tsconfigJson = readJson(appTree, 'libs/my-lib/tsconfig.lib.json');
        expect(tsconfigJson.exclude).toEqual(['**/*.test.ts', '**/*.spec.ts']);
      });
    });

    it('should generate files', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();
      await runLibraryGeneratorWithOpts({ name: 'my-lib2' });

      // ASSERT
      expect(appTree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
      expect(appTree.exists('libs/my-lib/src/index.ts')).toBeTruthy();
      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.module.ts')
      ).toBeTruthy();

      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.component.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.component.spec.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.service.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.service.spec.ts')
      ).toBeFalsy();

      expect(appTree.exists(`libs/my-lib2/jest.config.js`)).toBeTruthy();
      expect(appTree.exists('libs/my-lib2/src/index.ts')).toBeTruthy();
      expect(
        appTree.exists('libs/my-lib2/src/lib/my-lib2.module.ts')
      ).toBeTruthy();

      expect(
        appTree.exists('libs/my-lib2/src/lib/my-lib2.component.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-lib2/src/lib/my-lib2.component.spec.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-lib2/src/lib/my-lib2.service.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-lib2/src/lib/my-lib2.service.spec.ts')
      ).toBeFalsy();
    });

    it('should default the prefix to npmScope', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();
      await runLibraryGeneratorWithOpts({
        name: 'myLibWithPrefix',
        prefix: 'custom',
      });

      // ASSERT
      expect(
        JSON.parse(appTree.read('workspace.json').toString()).projects['my-lib']
          .prefix
      ).toEqual('proj');

      expect(
        JSON.parse(appTree.read('workspace.json').toString()).projects[
          'my-lib-with-prefix'
        ].prefix
      ).toEqual('custom');
    });
  });

  describe('nested', () => {
    it('should update tags', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ tags: 'one', directory: 'my-dir' });
      await runLibraryGeneratorWithOpts({
        name: 'myLib2',
        directory: 'myDir',
        tags: 'one,two',
      });

      // ASSERT
      const projects = Object.fromEntries(getProjects(appTree));

      expect(projects).toEqual({
        'my-dir-my-lib': expect.objectContaining({
          tags: ['one'],
        }),
        'my-dir-my-lib2': expect.objectContaining({
          tags: ['one', 'two'],
        }),
      });
    });

    it('should generate files', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ tags: 'one', directory: 'my-dir' });
      await runLibraryGeneratorWithOpts({
        name: 'myLib2',
        directory: 'myDir',
        simpleModuleName: true,
      });

      // ASSERT
      expect(appTree.exists(`libs/my-dir/my-lib/jest.config.js`)).toBeTruthy();
      expect(appTree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(
        appTree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
      ).toBeTruthy();

      expect(
        appTree.exists('libs/my-dir/my-lib/src/lib/my-lib.component.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-dir/my-lib/src/lib/my-lib.component.spec.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-dir/my-lib/src/lib/my-lib.service.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-dir/my-lib/src/lib/my-lib.service.spec.ts')
      ).toBeFalsy();

      expect(appTree.exists(`libs/my-dir/my-lib2/jest.config.js`)).toBeTruthy();
      expect(appTree.exists('libs/my-dir/my-lib2/src/index.ts')).toBeTruthy();
      expect(
        appTree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
      ).toBeTruthy();

      expect(
        appTree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.component.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.component.spec.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.service.ts')
      ).toBeFalsy();
      expect(
        appTree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.service.spec.ts')
      ).toBeFalsy();
    });

    it('should update ng-package.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        directory: 'myDir',
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      let ngPackage = readJson(appTree, 'libs/my-dir/my-lib/ng-package.json');
      expect(ngPackage.dest).toEqual('../../../dist/libs/my-dir/my-lib');
    });

    it('should update workspace.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ directory: 'myDir' });

      // ASSERT
      const workspaceJson = readJson(appTree, '/workspace.json');

      expect(workspaceJson.projects['my-dir-my-lib'].root).toEqual(
        'libs/my-dir/my-lib'
      );
    });

    it('should update tsconfig.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ directory: 'myDir' });

      // ASSERT
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']).toEqual(
        ['libs/my-dir/my-lib/src/index.ts']
      );
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });

    it('should update tsconfig.json (no existing path mappings)', async () => {
      // ARRANGE
      updateJson(appTree, 'tsconfig.base.json', (json) => {
        json.compilerOptions.paths = undefined;
        return json;
      });

      // ACT
      await runLibraryGeneratorWithOpts({ directory: 'myDir' });

      // ASSERT
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');

      expect(tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']).toEqual(
        ['libs/my-dir/my-lib/src/index.ts']
      );
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });

    it('should create a local tsconfig.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ directory: 'myDir' });

      // ASSERT
      const tsconfigJson = readJson(
        appTree,
        'libs/my-dir/my-lib/tsconfig.json'
      );

      expect(tsconfigJson).toEqual({
        extends: '../../../tsconfig.base.json',
        angularCompilerOptions: {
          strictInjectionParameters: true,
          strictInputAccessModifiers: true,
          strictTemplates: true,
        },
        compilerOptions: {
          forceConsistentCasingInFileNames: true,
          noFallthroughCasesInSwitch: true,
          noImplicitReturns: true,
          strict: true,
        },
        files: [],
        include: [],
        references: [
          {
            path: './tsconfig.lib.json',
          },
          {
            path: './tsconfig.spec.json',
          },
        ],
      });
    });
  });

  describe('router', () => {
    it('should error when lazy is set without routing', async () => {
      try {
        // ACT
        await runLibraryGeneratorWithOpts({ lazy: true });

        fail();
      } catch (e) {
        // ASSERT
        expect(e.message).toEqual(
          'To use --lazy option, --routing must also be set.'
        );
      }
    });

    describe('lazy', () => {
      it('should add RouterModule.forChild', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({
          directory: 'myDir',
          routing: true,
          lazy: true,
        });

        await runLibraryGeneratorWithOpts({
          name: 'myLib2',
          directory: 'myDir',
          routing: true,
          lazy: true,
          simpleModuleName: true,
        });

        // ASSERT
        expect(
          appTree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
        ).toBeTruthy();
        expect(
          appTree
            .read('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
            .toString()
        ).toContain('RouterModule.forChild');

        expect(
          appTree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
        ).toBeTruthy();
        expect(
          appTree
            .read('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
            .toString()
        ).toContain('RouterModule.forChild');
      });

      it('should update the parent module', async () => {
        // ARRANGE
        createApp(appTree, 'myapp');

        // ACT
        await runLibraryGeneratorWithOpts({
          directory: 'myDir',
          routing: true,
          lazy: true,
          parentModule: 'apps/myapp/src/app/app.module.ts',
        });

        const moduleContents = appTree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        const tsConfigAppJson = readJson(
          appTree,
          'apps/myapp/tsconfig.app.json'
        );
        const tsConfigLibJson = parseJson(
          appTree.read('libs/my-dir/my-lib/tsconfig.lib.json').toString()
        );

        await runLibraryGeneratorWithOpts({
          name: 'myLib2',
          directory: 'myDir',
          routing: true,
          lazy: true,
          simpleModuleName: true,
          parentModule: 'apps/myapp/src/app/app.module.ts',
        });

        const moduleContents2 = appTree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        const tsConfigAppJson2 = parseJson(
          appTree.read('apps/myapp/tsconfig.app.json').toString()
        );
        const tsConfigLibJson2 = parseJson(
          appTree.read('libs/my-dir/my-lib2/tsconfig.lib.json').toString()
        );

        await runLibraryGeneratorWithOpts({
          name: 'myLib3',
          directory: 'myDir',
          routing: true,
          lazy: true,
          simpleModuleName: true,
          parentModule: 'apps/myapp/src/app/app.module.ts',
        });

        const moduleContents3 = appTree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        const tsConfigAppJson3 = parseJson(
          appTree.read('apps/myapp/tsconfig.app.json').toString()
        );

        const tsConfigLibJson3 = parseJson(
          appTree.read('libs/my-dir/my-lib3/tsconfig.lib.json').toString()
        );

        // ASSERT
        expect(moduleContents).toContain('RouterModule.forRoot([');
        expect(moduleContents).toContain(
          `{path: 'my-dir-my-lib', loadChildren: () => import('@proj/my-dir/my-lib').then(module => module.MyDirMyLibModule)}`
        );

        expect(tsConfigAppJson.include).toEqual([
          '**/*.ts',
          '../../libs/my-dir/my-lib/src/index.ts',
        ]);
        expect(tsConfigLibJson.exclude).toEqual([
          'src/test-setup.ts',
          '**/*.spec.ts',
          '**/*.test.ts',
        ]);

        expect(moduleContents2).toContain('RouterModule.forRoot([');
        expect(moduleContents2).toContain(
          `{path: 'my-dir-my-lib', loadChildren: () => import('@proj/my-dir/my-lib').then(module => module.MyDirMyLibModule)}`
        );
        expect(moduleContents2).toContain(
          `{path: 'my-lib2', loadChildren: () => import('@proj/my-dir/my-lib2').then(module => module.MyLib2Module)}`
        );

        expect(tsConfigAppJson2.include).toEqual([
          '**/*.ts',
          '../../libs/my-dir/my-lib/src/index.ts',
          '../../libs/my-dir/my-lib2/src/index.ts',
        ]);
        expect(tsConfigLibJson2.exclude).toEqual([
          'src/test-setup.ts',
          '**/*.spec.ts',
          '**/*.test.ts',
        ]);

        expect(moduleContents3).toContain('RouterModule.forRoot([');
        expect(moduleContents3).toContain(
          `{path: 'my-dir-my-lib', loadChildren: () => import('@proj/my-dir/my-lib').then(module => module.MyDirMyLibModule)}`
        );
        expect(moduleContents3).toContain(
          `{path: 'my-lib2', loadChildren: () => import('@proj/my-dir/my-lib2').then(module => module.MyLib2Module)}`
        );
        expect(moduleContents3).toContain(
          `{path: 'my-lib3', loadChildren: () => import('@proj/my-dir/my-lib3').then(module => module.MyLib3Module)}`
        );

        expect(tsConfigAppJson3.include).toEqual([
          '**/*.ts',
          '../../libs/my-dir/my-lib/src/index.ts',
          '../../libs/my-dir/my-lib2/src/index.ts',
          '../../libs/my-dir/my-lib3/src/index.ts',
        ]);
        expect(tsConfigLibJson3.exclude).toEqual([
          'src/test-setup.ts',
          '**/*.spec.ts',
          '**/*.test.ts',
        ]);
      });

      it('should update the parent module even if the route is declared outside the .forRoot(...)', async () => {
        // ARRANGE
        createApp(appTree, 'myapp');
        appTree.write(
          'apps/myapp/src/app/app.module.ts',
          `
          import { NgModule } from '@angular/core';
          import { BrowserModule } from '@angular/platform-browser';
          import { RouterModule } from '@angular/router';
          import { AppComponent } from './app.component';

          const routes = [];

          @NgModule({
            imports: [BrowserModule, RouterModule.forRoot(routes)],
            declarations: [AppComponent],
            bootstrap: [AppComponent]
          })
          export class AppModule {}
        `
        );

        // ACT
        await runLibraryGeneratorWithOpts({
          directory: 'myDir',
          routing: true,
          lazy: true,
          parentModule: 'apps/myapp/src/app/app.module.ts',
        });

        // ASSERT
        const moduleContents = appTree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        expect(moduleContents).toContain('RouterModule.forRoot(routes)');
        expect(moduleContents).toContain(
          `const routes = [{path: 'my-dir-my-lib', loadChildren: () => import('@proj/my-dir/my-lib').then(module => module.MyDirMyLibModule)}];`
        );
      });
    });

    describe('eager', () => {
      it('should add RouterModule and define an array of routes', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({
          directory: 'myDir',
          routing: true,
        });

        await runLibraryGeneratorWithOpts({
          name: 'myLib2',
          directory: 'myDir',
          simpleModuleName: true,
          routing: true,
        });
        // ASSERT
        expect(
          appTree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
        ).toBeTruthy();
        expect(
          appTree
            .read('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
            .toString()
        ).toContain('RouterModule');
        expect(
          appTree
            .read('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
            .toString()
        ).toContain('const myDirMyLibRoutes: Route[] = ');

        expect(
          appTree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
        ).toBeTruthy();
        expect(
          appTree
            .read('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
            .toString()
        ).toContain('RouterModule');
        expect(
          appTree
            .read('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
            .toString()
        ).toContain('const myLib2Routes: Route[] = ');
      });

      it('should update the parent module', async () => {
        // ARRANGE
        createApp(appTree, 'myapp');

        // ACT
        await runLibraryGeneratorWithOpts({
          name: 'myLib',
          directory: 'myDir',
          routing: true,
          parentModule: 'apps/myapp/src/app/app.module.ts',
        });

        const moduleContents = appTree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        await runLibraryGeneratorWithOpts({
          name: 'myLib2',
          directory: 'myDir',
          simpleModuleName: true,
          routing: true,
          parentModule: 'apps/myapp/src/app/app.module.ts',
        });

        const moduleContents2 = appTree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        await runLibraryGeneratorWithOpts({
          name: 'myLib3',
          directory: 'myDir',
          routing: true,
          parentModule: 'apps/myapp/src/app/app.module.ts',
          simpleModuleName: true,
        });

        const moduleContents3 = appTree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        // ASSERT
        expect(moduleContents).toContain('MyDirMyLibModule');
        expect(moduleContents).toContain('RouterModule.forRoot([');
        expect(moduleContents).toContain(
          "{ path: 'my-dir-my-lib', children: myDirMyLibRoutes }"
        );

        expect(moduleContents2).toContain('MyLib2Module');
        expect(moduleContents2).toContain('RouterModule.forRoot([');
        expect(moduleContents2).toContain(
          "{ path: 'my-dir-my-lib', children: myDirMyLibRoutes }"
        );
        expect(moduleContents2).toContain(
          "{ path: 'my-lib2', children: myLib2Routes }"
        );

        expect(moduleContents3).toContain('MyLib3Module');
        expect(moduleContents3).toContain('RouterModule.forRoot([');
        expect(moduleContents3).toContain(
          "{ path: 'my-dir-my-lib', children: myDirMyLibRoutes }"
        );
        expect(moduleContents3).toContain(
          "{ path: 'my-lib2', children: myLib2Routes }"
        );
        expect(moduleContents3).toContain(
          "{ path: 'my-lib3', children: myLib3Routes }"
        );
      });

      it('should update the parent module even if the route is declared outside the .forRoot(...)', async () => {
        // ARRANGE
        createApp(appTree, 'myapp');
        appTree.write(
          'apps/myapp/src/app/app.module.ts',
          `
          import { NgModule } from '@angular/core';
          import { BrowserModule } from '@angular/platform-browser';
          import { RouterModule } from '@angular/router';
          import { AppComponent } from './app.component';

          const routes = [];

          @NgModule({
            imports: [BrowserModule, RouterModule.forRoot(routes)],
            declarations: [AppComponent],
            bootstrap: [AppComponent]
          })
          export class AppModule {}
        `
        );

        // ACT
        await runLibraryGeneratorWithOpts({
          name: 'myLib',
          directory: 'myDir',
          routing: true,
          parentModule: 'apps/myapp/src/app/app.module.ts',
        });

        // ASSERT
        const moduleContents = appTree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        expect(moduleContents).toContain('RouterModule.forRoot(routes)');
        expect(moduleContents).toContain(
          `const routes = [{ path: 'my-dir-my-lib', children: myDirMyLibRoutes }];`
        );
      });
    });
  });

  describe('--unit-test-runner karma', () => {
    it('should generate karma configuration', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        unitTestRunner: UnitTestRunner.Karma,
      });

      // ASSERT
      const workspaceJson = readJson(appTree, 'workspace.json');

      expect(appTree.exists('libs/my-lib/src/test.ts')).toBeTruthy();
      expect(appTree.exists('libs/my-lib/src/test-setup.ts')).toBeFalsy();
      expect(appTree.exists('libs/my-lib/tsconfig.spec.json')).toBeTruthy();
      expect(appTree.exists('libs/my-lib/karma.conf.js')).toBeTruthy();
      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.module.spec.ts')
      ).toBeFalsy();
      expect(appTree.exists('karma.conf.js')).toBeTruthy();
      expect(workspaceJson.projects['my-lib'].architect.test.builder).toEqual(
        '@angular-devkit/build-angular:karma'
      );
    });

    it('should generate module spec when addModuleSpec is specified', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        unitTestRunner: UnitTestRunner.Karma,
        addModuleSpec: true,
      });
      // ASSERT

      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.module.spec.ts')
      ).toBeTruthy();
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        unitTestRunner: UnitTestRunner.None,
      });

      // ASSERT
      const workspaceJson = readJson(appTree, 'workspace.json');

      expect(
        appTree.exists('libs/my-lib/src/lib/my-lib.module.spec.ts')
      ).toBeFalsy();
      expect(appTree.exists('libs/my-lib/src/test.ts')).toBeFalsy();
      expect(appTree.exists('libs/my-lib/src/test.ts')).toBeFalsy();
      expect(appTree.exists('libs/my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(appTree.exists('libs/my-lib/jest.config.js')).toBeFalsy();
      expect(appTree.exists('libs/my-lib/karma.conf.js')).toBeFalsy();
      expect(workspaceJson.projects['my-lib'].architect.test).toBeUndefined();
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        directory: 'myDir',
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      const packageJson = readJson(appTree, 'libs/my-dir/my-lib/package.json');
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');

      expect(packageJson.name).toBe('@myorg/lib');
      expect(
        tsconfigJson.compilerOptions.paths[packageJson.name]
      ).toBeDefined();
    });

    it('should fail if the same importPath has already been used', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      try {
        // ACT
        await runLibraryGeneratorWithOpts({
          name: 'myLib2',
          publishable: true,
          importPath: '@myorg/lib',
        });
      } catch (e) {
        expect(e.message).toContain(
          'You already have a library using the import path'
        );
      }

      expect.assertions(1);
    });

    it('should fail if no importPath has been used', async () => {
      try {
        // ACT
        await runLibraryGeneratorWithOpts({
          publishable: true,
        });
      } catch (e) {
        expect(e.message).toContain(
          'For publishable libs you have to provide a proper "--importPath"'
        );
      }

      expect.assertions(1);
    });
  });

  describe('--strict', () => {
    it('should enable strict type checking', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        strict: true,
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      const { compilerOptions, angularCompilerOptions } = readJson(
        appTree,
        'libs/my-lib/tsconfig.json'
      );
      const { generators } = readJson<NxJsonConfiguration>(appTree, 'nx.json');

      // check that the TypeScript compiler options have been updated
      expect(compilerOptions.forceConsistentCasingInFileNames).toBe(true);
      expect(compilerOptions.strict).toBe(true);
      expect(compilerOptions.noImplicitReturns).toBe(true);
      expect(compilerOptions.noFallthroughCasesInSwitch).toBe(true);

      // check that the Angular Template options have been updated
      expect(angularCompilerOptions.strictInjectionParameters).toBe(true);
      expect(angularCompilerOptions.strictTemplates).toBe(true);

      // check to see if the workspace configuration has been updated to use strict
      // mode by default in future libraries
      expect(generators['@nrwl/angular:library'].strict).not.toBeDefined();
    });

    it('should set defaults when --strict=false', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        strict: false,
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      // check to see if the workspace configuration has been updated to turn off
      // strict mode by default in future libraries
      const { generators } = readJson<NxJsonConfiguration>(appTree, 'nx.json');
      expect(generators['@nrwl/angular:library'].strict).toBe(false);
    });
  });

  describe('--linter', () => {
    describe('eslint', () => {
      it('should add an architect target for lint', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({ linter: Linter.EsLint });

        // ASSERT
        const workspaceJson = readJson(appTree, 'workspace.json');

        expect(appTree.exists('libs/my-lib/tslint.json')).toBe(false);
        expect(workspaceJson.projects['my-lib'].architect.lint)
          .toMatchInlineSnapshot(`
          Object {
            "builder": "@nrwl/linter:eslint",
            "options": Object {
              "lintFilePatterns": Array [
                "libs/my-lib/src/**/*.ts",
                "libs/my-lib/src/**/*.html",
              ],
            },
          }
        `);
      });

      it('should add valid eslint JSON configuration which extends from Nx presets', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({ linter: Linter.EsLint });

        // ASSERT

        const eslintConfig = readJson(appTree, 'libs/my-lib/.eslintrc.json');
        expect(eslintConfig).toMatchInlineSnapshot(`
          Object {
            "extends": Array [
              "../../.eslintrc.json",
            ],
            "ignorePatterns": Array [
              "!**/*",
            ],
            "overrides": Array [
              Object {
                "extends": Array [
                  "plugin:@nrwl/nx/angular",
                  "plugin:@angular-eslint/template/process-inline-templates",
                ],
                "files": Array [
                  "*.ts",
                ],
                "rules": Object {
                  "@angular-eslint/component-selector": Array [
                    "error",
                    Object {
                      "prefix": "proj",
                      "style": "kebab-case",
                      "type": "element",
                    },
                  ],
                  "@angular-eslint/directive-selector": Array [
                    "error",
                    Object {
                      "prefix": "proj",
                      "style": "camelCase",
                      "type": "attribute",
                    },
                  ],
                },
              },
              Object {
                "extends": Array [
                  "plugin:@nrwl/nx/angular-template",
                ],
                "files": Array [
                  "*.html",
                ],
                "rules": Object {},
              },
            ],
          }
        `);
      });
    });

    describe('none', () => {
      it('should not add an architect target for lint', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({ linter: Linter.None });

        // ASSERT
        const workspaceJson = readJson(appTree, 'workspace.json');
        expect(workspaceJson.projects['my-lib'].architect.lint).toBeUndefined();
      });
    });
  });
});
