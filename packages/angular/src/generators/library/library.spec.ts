import {
  getProjects,
  NxJsonConfiguration,
  parseJson,
  ProjectGraph,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { backwardCompatibleVersions } from '../../utils/backward-compatible-versions';
import { createApp } from '../../utils/nx-devkit/testing';
import { UnitTestRunner } from '../../utils/test-runners';
import {
  autoprefixerVersion,
  postcssVersion,
  tailwindVersion,
} from '../../utils/versions';
import { generateTestApplication, generateTestLibrary } from '../utils/testing';
import { Schema } from './schema';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => {
  return {
    ...jest.requireActual('@nx/devkit'),
    createProjectGraphAsync: jest.fn().mockImplementation(() => projectGraph),
  };
});

describe('lib', () => {
  let tree: Tree;

  async function runLibraryGeneratorWithOpts(opts: Partial<Schema> = {}) {
    await generateTestLibrary(tree, {
      name: 'myLib',
      publishable: false,
      buildable: false,
      linter: Linter.EsLint,
      skipFormat: false,
      unitTestRunner: UnitTestRunner.Jest,
      simpleName: false,
      strict: true,
      ...opts,
    });
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('workspace v2', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    });

    it('should run the library generator without erroring if the directory has a trailing slash', async () => {
      // ACT & ASSERT
      await expect(
        runLibraryGeneratorWithOpts({ directory: 'mylib/shared/' })
      ).resolves.not.toThrow();
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
      let ngPackage = readJson(tree, 'libs/my-lib/ng-package.json');

      expect(ngPackage.dest).toEqual('../../dist/libs/my-lib');
    });
    it('should update ng-package.json $schema to the correct folder', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      let ngPackage = readJson(tree, 'libs/my-lib/ng-package.json');

      expect(ngPackage.$schema).toEqual(
        '../../node_modules/ng-packagr/ng-package.schema.json'
      );
    });

    it('should not update package.json by default', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      const packageJson = readJson(tree, '/package.json');
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
      const packageJson = readJson(tree, '/package.json');
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
      const packageJson = readJson(tree, '/package.json');
      expect(packageJson.devDependencies['ng-packagr']).toBeDefined();
      expect(packageJson.devDependencies['postcss']).toBeDefined();
      expect(packageJson.devDependencies['postcss-import']).toBeDefined();
      expect(packageJson.devDependencies['postcss-preset-env']).toBeDefined();
      expect(packageJson.devDependencies['postcss-url']).toBeDefined();
    });

    it('should create project configuration', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      const json = readProjectConfiguration(tree, 'my-lib');
      expect(json.root).toEqual('libs/my-lib');
      expect(json.targets.build).toBeDefined();
    });

    it('should not generate a module file and index.ts should be empty', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        skipModule: true,
      });

      // ASSERT
      const moduleFileExists = tree.exists(
        'libs/my-lib/src/lib/my-lib.module.ts'
      );
      expect(moduleFileExists).toBeFalsy();
      const indexApi = tree.read('libs/my-lib/src/index.ts', 'utf-8');
      expect(indexApi).toMatchInlineSnapshot(`""`);
    });

    it('should remove "build" target from project.json when a library is not publishable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: false,
      });

      // ASSERT
      expect(
        readProjectConfiguration(tree, 'my-lib').targets.build
      ).not.toBeDefined();
    });

    it('should have a "build" target when a library is buildable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        buildable: true,
        publishable: false,
      });

      // ASSERT
      expect(
        readProjectConfiguration(tree, 'my-lib').targets.build
      ).toBeDefined();
    });

    it('should remove .browserslistrc when library is not buildable or publishable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: false,
        buildable: false,
      });

      // ASSERT
      expect(tree.read('libs/my-lib/.browserslistrc')).toBeFalsy();
    });

    it('should remove tsconfib.lib.prod.json when library is not buildable or publishable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: false,
        buildable: false,
      });

      // ASSERT
      expect(tree.exists('libs/my-lib/tsconfig.lib.prod.json')).toBeFalsy();
    });

    it('should update tags', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: false,
        buildable: false,
        tags: 'one,two',
      });

      // ASSERT
      const projects = Object.fromEntries(getProjects(tree));
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
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts',
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson).toEqual({
        extends: '../../tsconfig.base.json',
        angularCompilerOptions: {
          enableI18nLegacyMessageIdFormat: false,
          strictInjectionParameters: true,
          strictInputAccessModifiers: true,
          strictTemplates: true,
        },
        compilerOptions: {
          forceConsistentCasingInFileNames: true,
          noFallthroughCasesInSwitch: true,
          noPropertyAccessFromIndexSignature: true,
          noImplicitOverride: true,
          noImplicitReturns: true,
          strict: true,
          target: 'es2022',
          useDefineForClassFields: false,
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

    it('should create tsconfig.base.json when it is missing', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await runLibraryGeneratorWithOpts();

      const appTsConfig = readJson(tree, 'libs/my-lib/tsconfig.json');
      expect(appTsConfig.extends).toBe('../../tsconfig.base.json');
    });

    it('should check for existence of spec files before deleting them', async () => {
      // ARRANGE
      updateJson<NxJsonConfiguration, NxJsonConfiguration>(
        tree,
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
        tree.read('libs/my-lib/src/lib/my-lib.component.spec.ts')
      ).toBeFalsy();
      expect(
        tree.read('libs/my-lib/src/lib/my-lib.service.spec.ts')
      ).toBeFalsy();
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.spec.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    describe('when creating the tsconfig.lib.json', () => {
      it('should extend the local tsconfig.json', async () => {
        // ACT
        await runLibraryGeneratorWithOpts();

        // ASSERT
        const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
        expect(tsconfigJson.extends).toEqual('./tsconfig.json');
      });

      it('should contain includes', async () => {
        // ACT
        await runLibraryGeneratorWithOpts();

        // ASSERT
        const tsConfigJson = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
        expect(tsConfigJson.include).toEqual(['src/**/*.ts']);
      });

      it('should exclude the test setup file when unitTestRunner is jest', async () => {
        // ACT
        await runLibraryGeneratorWithOpts();

        // ASSERT
        const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
        expect(tsconfigJson.exclude).toEqual([
          'src/**/*.spec.ts',
          'src/test-setup.ts',
          'jest.config.ts',
          'src/**/*.test.ts',
        ]);
      });

      it('should remove the excludes when unitTestRunner is none', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({
          unitTestRunner: UnitTestRunner.None,
        });

        // ASSERT
        const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
        expect(tsconfigJson.exclude).toEqual([
          'src/**/*.spec.ts',
          'jest.config.ts',
          'src/**/*.test.ts',
        ]);
      });
    });

    it('should generate files', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();
      await runLibraryGeneratorWithOpts({ name: 'my-lib2' });

      // ASSERT
      expect(tree.exists(`libs/my-lib/jest.config.ts`)).toBeTruthy();
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

      expect(tree.exists(`libs/my-lib2/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('libs/my-lib2/src/index.ts')).toBeTruthy();
      expect(
        tree.exists('libs/my-lib2/src/lib/my-lib2.module.ts')
      ).toBeTruthy();

      expect(
        tree.exists('libs/my-lib2/src/lib/my-lib2.component.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-lib2/src/lib/my-lib2.component.spec.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-lib2/src/lib/my-lib2.service.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-lib2/src/lib/my-lib2.service.spec.ts')
      ).toBeFalsy();
    });

    it('should not install any e2e test runners', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      let { dependencies, devDependencies } = readJson(tree, 'package.json');
      expect(dependencies.cypress).toBeUndefined();
      expect(devDependencies.cypress).toBeUndefined();
      expect(dependencies.protractor).toBeUndefined();
      expect(devDependencies.protractor).toBeUndefined();
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
      const projects = Object.fromEntries(getProjects(tree));

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
        simpleName: true,
      });

      // ASSERT
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.ts`)).toBeTruthy();
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

      expect(tree.exists(`libs/my-dir/my-lib2/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib2/src/index.ts')).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
      ).toBeTruthy();

      expect(
        tree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.component.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.component.spec.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.service.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.service.spec.ts')
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
      let ngPackage = readJson(tree, 'libs/my-dir/my-lib/ng-package.json');
      expect(ngPackage.dest).toEqual('../../../dist/libs/my-dir/my-lib');
    });

    it('should generate project configuration', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ directory: 'myDir' });

      // ASSERT
      expect(readProjectConfiguration(tree, 'my-dir-my-lib').root).toEqual(
        'libs/my-dir/my-lib'
      );
    });

    it('should update tsconfig.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ directory: 'myDir' });

      // ASSERT
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']).toEqual(
        ['libs/my-dir/my-lib/src/index.ts']
      );
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });

    it('should update tsconfig.json (no existing path mappings)', async () => {
      // ARRANGE
      updateJson(tree, 'tsconfig.base.json', (json) => {
        json.compilerOptions.paths = undefined;
        return json;
      });

      // ACT
      await runLibraryGeneratorWithOpts({ directory: 'myDir' });

      // ASSERT
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');

      expect(tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']).toEqual(
        ['libs/my-dir/my-lib/src/index.ts']
      );
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });
  });

  describe('at the root', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      updateJson(tree, 'nx.json', (json) => ({
        ...json,
        workspaceLayout: { libsDir: '' },
      }));
    });

    it('should accept numbers in the path', async () => {
      await runLibraryGeneratorWithOpts({ directory: 'src/1-api' });

      expect(readProjectConfiguration(tree, 'src-api-my-lib').root).toEqual(
        'src/1-api/my-lib'
      );
    });

    it('should have root relative routes', async () => {
      await runLibraryGeneratorWithOpts({ directory: 'myDir' });
      const projectConfig = readProjectConfiguration(tree, 'my-dir-my-lib');
      expect(projectConfig.root).toEqual('my-dir/my-lib');
    });

    it('should generate files with correct output paths', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const content = readJson(tree, path);

        expect(lookupFn(content)).toEqual(expectedValue);
      };
      await runLibraryGeneratorWithOpts({
        directory: 'myDir',
        simpleName: true,
        publishable: true,
        importPath: '@myorg/lib',
      });

      const libModulePath = 'my-dir/my-lib/src/lib/my-lib.module.ts';
      expect(tree.read(libModulePath, 'utf-8')).toContain('class MyLibModule');

      // Make sure these exist
      [
        'my-dir/my-lib/jest.config.ts',
        'my-dir/my-lib/ng-package.json',
        'my-dir/my-lib/project.json',
        'my-dir/my-lib/tsconfig.lib.prod.json',
        'my-dir/my-lib/src/index.ts',
        'my-dir/my-lib/src/lib/my-lib.module.ts',
      ].forEach((path) => {
        expect(tree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'tsconfig.base.json',
          lookupFn: (json) => json.compilerOptions.paths['@myorg/lib'],
          expectedValue: ['my-dir/my-lib/src/index.ts'],
        },
        {
          path: 'my-dir/my-lib/ng-package.json',
          lookupFn: (json) => json.dest,
          expectedValue: '../../dist/my-dir/my-lib',
        },
        {
          path: 'my-dir/my-lib/project.json',
          lookupFn: (json) => json.targets.build.outputs,
          expectedValue: ['{workspaceRoot}/dist/{projectRoot}'],
        },
        {
          path: 'my-dir/my-lib/tsconfig.lib.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../dist/out-tsc',
        },
        {
          path: 'my-dir/my-lib/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });
  });

  describe('router', () => {
    it('should error when lazy is set without routing', async () => {
      // ACT & ASSERT
      await expect(runLibraryGeneratorWithOpts({ lazy: true })).rejects.toThrow(
        'To use "--lazy" option, "--routing" must also be set.'
      );
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
          simpleName: true,
        });

        // ASSERT
        expect(
          tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
        ).toBeTruthy();
        expect(
          tree.read(
            'libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts',
            'utf-8'
          )
        ).toMatchSnapshot();

        expect(
          tree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
        ).toBeTruthy();
        expect(
          tree.read('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts', 'utf-8')
        ).toMatchSnapshot();
      });

      it('should update the parent module', async () => {
        // ARRANGE
        createApp(tree, 'myapp');

        // ACT
        await runLibraryGeneratorWithOpts({
          directory: 'myDir',
          routing: true,
          lazy: true,
          parent: 'apps/myapp/src/app/app.module.ts',
        });

        const moduleContents = tree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();
        const tsConfigLibJson = parseJson(
          tree.read('libs/my-dir/my-lib/tsconfig.lib.json').toString()
        );

        await runLibraryGeneratorWithOpts({
          name: 'myLib2',
          directory: 'myDir',
          routing: true,
          lazy: true,
          simpleName: true,
          parent: 'apps/myapp/src/app/app.module.ts',
        });

        const moduleContents2 = tree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();
        const tsConfigLibJson2 = parseJson(
          tree.read('libs/my-dir/my-lib2/tsconfig.lib.json').toString()
        );

        await runLibraryGeneratorWithOpts({
          name: 'myLib3',
          directory: 'myDir',
          routing: true,
          lazy: true,
          simpleName: true,
          parent: 'apps/myapp/src/app/app.module.ts',
        });

        const moduleContents3 = tree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();
        const tsConfigLibJson3 = parseJson(
          tree.read('libs/my-dir/my-lib3/tsconfig.lib.json').toString()
        );

        // ASSERT
        expect(moduleContents).toMatchSnapshot();

        expect(tsConfigLibJson.exclude).toEqual([
          'src/**/*.spec.ts',
          'src/test-setup.ts',
          'jest.config.ts',
          'src/**/*.test.ts',
        ]);

        expect(moduleContents2).toMatchInlineSnapshot(`
          "import { NgModule } from '@angular/core';
          import { BrowserModule } from '@angular/platform-browser';
          import { RouterModule } from '@angular/router';
          import { AppComponent } from './app.component';
          @NgModule({
            imports: [
              BrowserModule,
              RouterModule.forRoot([
                {
                  path: 'my-dir-my-lib',
                  loadChildren: () =>
                    import('@proj/my-dir/my-lib').then((m) => m.MyDirMyLibModule),
                },
                {
                  path: 'my-lib2',
                  loadChildren: () =>
                    import('@proj/my-dir/my-lib2').then((m) => m.MyLib2Module),
                },
              ]),
            ],
            declarations: [AppComponent],
            bootstrap: [AppComponent],
          })
          export class AppModule {}
          "
        `);

        expect(tsConfigLibJson2.exclude).toEqual([
          'src/**/*.spec.ts',
          'src/test-setup.ts',
          'jest.config.ts',
          'src/**/*.test.ts',
        ]);

        expect(moduleContents3).toMatchSnapshot();

        expect(tsConfigLibJson3.exclude).toEqual([
          'src/**/*.spec.ts',
          'src/test-setup.ts',
          'jest.config.ts',
          'src/**/*.test.ts',
        ]);
      });

      it('should update the parent module even if the route is declared outside the .forRoot(...)', async () => {
        // ARRANGE
        createApp(tree, 'myapp');
        tree.write(
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
          parent: 'apps/myapp/src/app/app.module.ts',
        });

        // ASSERT
        const moduleContents = tree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        expect(moduleContents).toMatchSnapshot();
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
          simpleName: true,
          routing: true,
        });
        // ASSERT
        expect(
          tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
        ).toBeTruthy();
        expect(
          tree
            .read('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
            .toString()
        ).toContain('RouterModule');
        expect(
          tree.read('libs/my-dir/my-lib/src/lib/lib.routes.ts').toString()
        ).toContain('const myDirMyLibRoutes: Route[] = ');

        expect(
          tree.exists('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts')
        ).toBeTruthy();
        expect(
          tree.read('libs/my-dir/my-lib2/src/lib/my-lib2.module.ts').toString()
        ).toContain('RouterModule');
        expect(
          tree.read('libs/my-dir/my-lib2/src/lib/lib.routes.ts').toString()
        ).toContain('const myLib2Routes: Route[] = ');
      });

      it('should update the parent module', async () => {
        // ARRANGE
        createApp(tree, 'myapp');

        // ACT
        await runLibraryGeneratorWithOpts({
          name: 'myLib',
          directory: 'myDir',
          routing: true,
          parent: 'apps/myapp/src/app/app.module.ts',
        });

        const moduleContents = tree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        await runLibraryGeneratorWithOpts({
          name: 'myLib2',
          directory: 'myDir',
          simpleName: true,
          routing: true,
          parent: 'apps/myapp/src/app/app.module.ts',
        });

        const moduleContents2 = tree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        await runLibraryGeneratorWithOpts({
          name: 'myLib3',
          directory: 'myDir',
          routing: true,
          parent: 'apps/myapp/src/app/app.module.ts',
          simpleName: true,
        });

        const moduleContents3 = tree
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
        createApp(tree, 'myapp');
        tree.write(
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
          parent: 'apps/myapp/src/app/app.module.ts',
        });

        // ASSERT
        const moduleContents = tree
          .read('apps/myapp/src/app/app.module.ts')
          .toString();

        expect(moduleContents).toContain('RouterModule.forRoot(routes)');
        expect(moduleContents).toContain(
          `const routes = [{ path: 'my-dir-my-lib', children: myDirMyLibRoutes }];`
        );
      });
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        unitTestRunner: UnitTestRunner.None,
      });

      // ASSERT
      expect(
        tree.exists('libs/my-lib/src/lib/my-lib.module.spec.ts')
      ).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/test.ts')).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/test.ts')).toBeFalsy();
      expect(tree.exists('libs/my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('libs/my-lib/jest.config.ts')).toBeFalsy();
      expect(tree.exists('libs/my-lib/karma.conf.js')).toBeFalsy();
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
      const packageJson = readJson(tree, 'libs/my-dir/my-lib/package.json');
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');

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

      // ACT & ASSERT
      await expect(
        runLibraryGeneratorWithOpts({
          name: 'myLib2',
          publishable: true,
          importPath: '@myorg/lib',
        })
      ).rejects.toThrowError(
        'You already have a library using the import path'
      );
    });

    it('should fail if no importPath has been used', async () => {
      // ACT && ASSERT
      await expect(
        runLibraryGeneratorWithOpts({
          publishable: true,
        })
      ).rejects.toThrowError(
        'For publishable libs you have to provide a proper "--importPath"'
      );
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
        tree,
        'libs/my-lib/tsconfig.json'
      );
      const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');

      // check that the TypeScript compiler options have been updated
      expect(compilerOptions.forceConsistentCasingInFileNames).toBe(true);
      expect(compilerOptions.strict).toBe(true);
      expect(compilerOptions.noImplicitOverride).toBe(true);
      expect(compilerOptions.noPropertyAccessFromIndexSignature).toBe(true);
      expect(compilerOptions.noImplicitReturns).toBe(true);
      expect(compilerOptions.noFallthroughCasesInSwitch).toBe(true);

      // check that the Angular Template options have been updated
      expect(angularCompilerOptions.strictInjectionParameters).toBe(true);
      expect(angularCompilerOptions.strictTemplates).toBe(true);

      // check to see if the workspace configuration has been updated to use strict
      // mode by default in future libraries
      expect(generators['@nx/angular:library'].strict).not.toBeDefined();
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
      const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(generators['@nx/angular:library'].strict).toBe(false);
    });
  });

  describe('--linter', () => {
    describe('eslint', () => {
      it('should add a lint target', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({ linter: Linter.EsLint });

        // ASSERT
        expect(tree.exists('libs/my-lib/tslint.json')).toBe(false);
        expect(readProjectConfiguration(tree, 'my-lib').targets['lint'])
          .toMatchInlineSnapshot(`
          {
            "executor": "@nx/linter:eslint",
            "options": {
              "lintFilePatterns": [
                "libs/my-lib/**/*.ts",
                "libs/my-lib/**/*.html",
              ],
            },
            "outputs": [
              "{options.outputFile}",
            ],
          }
        `);
      });

      it('should add valid eslint JSON configuration which extends from Nx presets', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({ linter: Linter.EsLint });

        // ASSERT

        const eslintConfig = readJson(tree, 'libs/my-lib/.eslintrc.json');
        expect(eslintConfig).toMatchInlineSnapshot(`
          {
            "extends": [
              "../../.eslintrc.json",
            ],
            "ignorePatterns": [
              "!**/*",
            ],
            "overrides": [
              {
                "extends": [
                  "plugin:@nx/angular",
                  "plugin:@angular-eslint/template/process-inline-templates",
                ],
                "files": [
                  "*.ts",
                ],
                "rules": {
                  "@angular-eslint/component-selector": [
                    "error",
                    {
                      "prefix": "proj",
                      "style": "kebab-case",
                      "type": "element",
                    },
                  ],
                  "@angular-eslint/directive-selector": [
                    "error",
                    {
                      "prefix": "proj",
                      "style": "camelCase",
                      "type": "attribute",
                    },
                  ],
                },
              },
              {
                "extends": [
                  "plugin:@nx/angular-template",
                ],
                "files": [
                  "*.html",
                ],
                "rules": {},
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
        expect(
          readProjectConfiguration(tree, 'my-lib').targets.lint
        ).toBeUndefined();
      });
    });
  });

  describe('--add-tailwind', () => {
    it('should throw when "--addTailwind=true" and "--buildable" and "--publishable" are not set', async () => {
      // ACT & ASSERT
      await expect(
        runLibraryGeneratorWithOpts({ addTailwind: true })
      ).rejects.toThrow(
        `To use "--addTailwind" option, you have to set either "--buildable" or "--publishable".`
      );
    });

    it('should not set up Tailwind when "--add-tailwind" is not specified', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      expect(tree.exists('libs/my-lib/tailwind.config.js')).toBeFalsy();
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['tailwindcss']).toBeUndefined();
      expect(devDependencies['postcss']).toBeUndefined();
      expect(devDependencies['autoprefixer']).toBeUndefined();
    });

    it('should not set up Tailwind when "--add-tailwind=false"', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ addTailwind: false });

      // ASSERT
      expect(tree.exists('libs/my-lib/tailwind.config.js')).toBeFalsy();
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['tailwindcss']).toBeUndefined();
      expect(devDependencies['postcss']).toBeUndefined();
      expect(devDependencies['autoprefixer']).toBeUndefined();
    });

    it('should set up Tailwind when "--add-tailwind=true"', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ addTailwind: true, buildable: true });

      // ASSERT
      expect(tree.read('libs/my-lib/tailwind.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
        const { join } = require('path');

        /** @type {import('tailwindcss').Config} */
        module.exports = {
          content: [
            join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
            ...createGlobPatternsForDependencies(__dirname),
          ],
          theme: {
            extend: {},
          },
          plugins: [],
        };
        "
      `);
      const project = readProjectConfiguration(tree, 'my-lib');
      expect(project.targets.build.options.tailwindConfig).toBe(
        'libs/my-lib/tailwind.config.js'
      );
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['tailwindcss']).toBe(tailwindVersion);
      expect(devDependencies['postcss']).toBe(postcssVersion);
      expect(devDependencies['autoprefixer']).toBe(autoprefixerVersion);
    });
  });

  describe('--standalone', () => {
    beforeEach(() => {
      projectGraph = {
        nodes: {
          'my-lib': {
            name: 'my-lib',
            type: 'lib',
            data: {
              root: 'libs/my-lib',
            } as any,
          },
        },
        dependencies: {},
      };
    });

    it('should generate a library with a standalone component as entry point', async () => {
      await runLibraryGeneratorWithOpts({ standalone: true });

      expect(tree.read('libs/my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(
          'libs/my-lib/src/lib/my-lib/my-lib.component.spec.ts',
          'utf-8'
        )
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component and have it flat', async () => {
      await runLibraryGeneratorWithOpts({ standalone: true, flat: true });

      expect(tree.read('libs/my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/my-lib.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component in a directory', async () => {
      await runLibraryGeneratorWithOpts({
        standalone: true,
        directory: 'my-dir',
      });

      expect(
        tree.read('libs/my-dir/my-lib/src/index.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(
          'libs/my-dir/my-lib/src/lib/my-dir-my-lib/my-dir-my-lib.component.ts',
          'utf-8'
        )
      ).toMatchSnapshot();
      expect(
        tree.read(
          'libs/my-dir/my-lib/src/lib/my-dir-my-lib/my-dir-my-lib.component.spec.ts',
          'utf-8'
        )
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component in a directory with a simple name', async () => {
      await runLibraryGeneratorWithOpts({
        standalone: true,
        directory: 'my-dir',
        simpleName: true,
      });

      expect(
        tree.read('libs/my-dir/my-lib/src/index.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(
          'libs/my-dir/my-lib/src/lib/my-lib/my-lib.component.ts',
          'utf-8'
        )
      ).toMatchSnapshot();
      expect(
        tree.read(
          'libs/my-dir/my-lib/src/lib/my-lib/my-lib.component.spec.ts',
          'utf-8'
        )
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component and have it flat with routing setup', async () => {
      await runLibraryGeneratorWithOpts({
        standalone: true,
        flat: true,
        routing: true,
      });

      expect(tree.read('libs/my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/my-lib.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/lib.routes.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.children('libs/my-lib/src/lib')).toMatchInlineSnapshot(`
        [
          "lib.routes.ts",
          "my-lib.component.css",
          "my-lib.component.html",
          "my-lib.component.spec.ts",
          "my-lib.component.ts",
        ]
      `);
      expect(tree.children('libs/my-lib/src')).toMatchInlineSnapshot(`
        [
          "index.ts",
          "lib",
          "test-setup.ts",
        ]
      `);
    });

    it('should generate a library with a standalone component as entry point with routing setup', async () => {
      await runLibraryGeneratorWithOpts({ standalone: true, routing: true });

      expect(tree.read('libs/my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/lib.routes.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(
          'libs/my-lib/src/lib/my-lib/my-lib.component.spec.ts',
          'utf-8'
        )
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component as entry point with routing setup and attach it to parent module as direct child', async () => {
      // ARRANGE
      await generateTestApplication(tree, {
        name: 'app1',
        routing: true,
      });

      // ACT
      await runLibraryGeneratorWithOpts({
        standalone: true,
        routing: true,
        parent: 'apps/app1/src/app/app.routes.ts',
      });

      // ASSERT
      expect(tree.read('libs/my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/lib.routes.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('apps/app1/src/app/app.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component as entry point with routing setup and attach it to parent module as a lazy child', async () => {
      // ARRANGE
      await generateTestApplication(tree, {
        name: 'app1',
        routing: true,
      });

      // ACT
      await runLibraryGeneratorWithOpts({
        standalone: true,
        routing: true,
        lazy: true,
        parent: 'apps/app1/src/app/app.routes.ts',
      });

      // ASSERT
      expect(tree.read('libs/my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/lib.routes.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('apps/app1/src/app/app.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component as entry point with routing setup and attach it to standalone parent module as direct child', async () => {
      // ARRANGE
      await generateTestApplication(tree, {
        name: 'app1',
        routing: true,
        standalone: true,
      });

      // ACT
      await runLibraryGeneratorWithOpts({
        standalone: true,
        routing: true,
        parent: 'apps/app1/src/app/app.routes.ts',
      });

      // ASSERT
      expect(tree.read('apps/app1/src/app/app.routes.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { Route } from '@angular/router';
        import { myLibRoutes } from '@proj/my-lib';

        export const appRoutes: Route[] = [{ path: 'my-lib', children: myLibRoutes }];
        "
      `);
    });

    it('should generate a library with a standalone component as entry point with routing setup and attach it to standalone parent module as a lazy child', async () => {
      // ARRANGE
      await generateTestApplication(tree, {
        name: 'app1',
        routing: true,
        standalone: true,
      });

      // ACT
      await runLibraryGeneratorWithOpts({
        standalone: true,
        routing: true,
        lazy: true,
        parent: 'apps/app1/src/app/app.routes.ts',
      });

      // ASSERT
      expect(tree.read('apps/app1/src/app/app.routes.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { Route } from '@angular/router';

        export const appRoutes: Route[] = [
          {
            path: 'my-lib',
            loadChildren: () => import('@proj/my-lib').then((m) => m.myLibRoutes),
          },
        ];
        "
      `);
    });

    it('should generate a library with a standalone component as entry point with routing setup and attach it to standalone parent routes as direct child', async () => {
      // ARRANGE
      await runLibraryGeneratorWithOpts({
        standalone: true,
        routing: true,
      });

      // ACT
      await runLibraryGeneratorWithOpts({
        name: 'second',
        standalone: true,
        routing: true,
        parent: 'libs/my-lib/src/lib/lib.routes.ts',
      });

      // ASSERT
      expect(
        tree.read('libs/my-lib/src/lib/lib.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component as entry point with routing setup and attach it to standalone parent routes as a lazy child', async () => {
      // ARRANGE
      await runLibraryGeneratorWithOpts({
        standalone: true,
        routing: true,
      });

      // ACT
      await runLibraryGeneratorWithOpts({
        name: 'second',
        standalone: true,
        routing: true,
        lazy: true,
        parent: 'libs/my-lib/src/lib/lib.routes.ts',
      });

      // ASSERT
      expect(
        tree.read('libs/my-lib/src/lib/lib.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component as entry point following SFC pattern', async () => {
      await runLibraryGeneratorWithOpts({
        standalone: true,
        inlineStyle: true,
        inlineTemplate: true,
      });

      expect(tree.read('libs/my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(
          'libs/my-lib/src/lib/my-lib/my-lib.component.spec.ts',
          'utf-8'
        )
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component as entry point and skip tests', async () => {
      await runLibraryGeneratorWithOpts({
        standalone: true,
        inlineStyle: true,
        inlineTemplate: true,
        skipTests: true,
      });

      expect(tree.read('libs/my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.exists('libs/my-lib/src/lib/my-lib/my-lib.component.spec.ts')
      ).toBeFalsy();
    });

    it('should generate a library with a standalone component as entry point and set up view encapsulation and change detection', async () => {
      await runLibraryGeneratorWithOpts({
        standalone: true,
        inlineStyle: true,
        inlineTemplate: true,
        viewEncapsulation: 'ShadowDom',
        changeDetection: 'OnPush',
      });

      expect(tree.read('libs/my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('--angular-14', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/core': '14.1.0',
        },
      }));
    });

    it('should create a local tsconfig.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson).toEqual({
        extends: '../../tsconfig.base.json',
        angularCompilerOptions: {
          enableI18nLegacyMessageIdFormat: false,
          strictInjectionParameters: true,
          strictInputAccessModifiers: true,
          strictTemplates: true,
        },
        compilerOptions: {
          forceConsistentCasingInFileNames: true,
          noFallthroughCasesInSwitch: true,
          noPropertyAccessFromIndexSignature: true,
          noImplicitOverride: true,
          noImplicitReturns: true,
          strict: true,
          target: 'es2020',
          useDefineForClassFields: false,
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

    it('should create a local package.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      const tsconfigJson = readJson(tree, 'libs/my-lib/package.json');
      expect(tsconfigJson).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "tslib": "^2.3.0",
          },
          "name": "@myorg/lib",
          "peerDependencies": {
            "@angular/common": "^14.1.0",
            "@angular/core": "^14.1.0",
          },
          "sideEffects": false,
          "version": "0.0.1",
        }
      `);
    });

    it('should generate a library with a standalone component as entry point with angular 14.1.0', async () => {
      await runLibraryGeneratorWithOpts({ standalone: true });

      expect(tree.read('libs/my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(
          'libs/my-lib/src/lib/my-lib/my-lib.component.spec.ts',
          'utf-8'
        )
      ).toMatchSnapshot();
    });

    it('should throw an error when trying to generate a library with a standalone component as entry point when angular version is < 14.1.0', async () => {
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/core': '14.0.0',
        },
      }));

      await expect(
        runLibraryGeneratorWithOpts({ standalone: true })
      ).rejects.toThrow(
        `The \"--standalone\" option is not supported in Angular versions < 14.1.0.`
      );
    });

    it('should update package.json with correct versions when buildable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ buildable: true });

      // ASSERT
      const packageJson = readJson(tree, '/package.json');
      expect(packageJson.devDependencies['ng-packagr']).toEqual(
        backwardCompatibleVersions.angularV14.ngPackagrVersion
      );
      expect(packageJson.devDependencies['postcss']).toBeDefined();
      expect(packageJson.devDependencies['postcss-import']).toBeDefined();
      expect(packageJson.devDependencies['postcss-preset-env']).toBeDefined();
      expect(packageJson.devDependencies['postcss-url']).toBeDefined();
    });
  });
});
