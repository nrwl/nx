import 'nx/src/internal-testing-utils/mock-project-graph';

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
import { Linter } from '@nx/eslint';
import { createApp } from '../../utils/nx-devkit/testing';
import { UnitTestRunner } from '../../utils/test-runners';
import {
  angularDevkitVersion,
  angularVersion,
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
      name: 'my-lib',
      publishable: false,
      buildable: false,
      linter: Linter.EsLint,
      skipFormat: true,
      unitTestRunner: UnitTestRunner.Jest,
      simpleName: false,
      strict: true,
      standalone: false,
      ...opts,
    });
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    projectGraph = {
      dependencies: {},
      nodes: {},
    };
  });

  it('should run the library generator without erroring if the directory has a trailing slash', async () => {
    // ACT & ASSERT
    await expect(
      runLibraryGeneratorWithOpts({ directory: 'mylib/shared/' })
    ).resolves.not.toThrow();
  });

  it('should add angular dependencies', async () => {
    // ACT
    await runLibraryGeneratorWithOpts();

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/animations']).toBe(angularVersion);
    expect(dependencies['@angular/common']).toBe(angularVersion);
    expect(dependencies['@angular/compiler']).toBe(angularVersion);
    expect(dependencies['@angular/core']).toBe(angularVersion);
    expect(dependencies['@angular/platform-browser']).toBe(angularVersion);
    expect(dependencies['@angular/platform-browser-dynamic']).toBe(
      angularVersion
    );
    expect(dependencies['@angular/router']).toBe(angularVersion);
    expect(dependencies['rxjs']).toBeDefined();
    expect(dependencies['tslib']).toBeDefined();
    expect(dependencies['zone.js']).toBeDefined();
    expect(devDependencies['@angular/cli']).toBe(angularDevkitVersion);
    expect(devDependencies['@angular/compiler-cli']).toBe(angularVersion);
    expect(devDependencies['@angular/language-service']).toBe(angularVersion);
    expect(devDependencies['@angular-devkit/build-angular']).toBe(
      angularDevkitVersion
    );

    // codelyzer should no longer be there by default
    expect(devDependencies['codelyzer']).toBeUndefined();
  });

  it('should not touch the package.json when run with `--skipPackageJson`', async () => {
    let initialPackageJson;
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = {};
      json.devDependencies = {};
      initialPackageJson = json;

      return json;
    });

    await runLibraryGeneratorWithOpts({ skipPackageJson: true });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual(initialPackageJson);
  });

  describe('not nested', () => {
    it('should update ng-package.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      let ngPackage = readJson(tree, 'my-lib/ng-package.json');

      expect(ngPackage.dest).toEqual('../dist/my-lib');
    });

    it('should update ng-package.json $schema to the correct folder', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      let ngPackage = readJson(tree, 'my-lib/ng-package.json');

      expect(ngPackage.$schema).toEqual(
        '../node_modules/ng-packagr/ng-package.schema.json'
      );
    });

    it('should not update package.json by default', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      const packageJson = readJson(tree, '/package.json');
      expect(packageJson.devDependencies['ng-packagr']).toBeUndefined();
      expect(packageJson.devDependencies['postcss']).toBeUndefined();
      expect(packageJson.devDependencies['autoprefixer']).toBeUndefined();
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
      expect(packageJson.devDependencies['autoprefixer']).toBeDefined();
      expect(packageJson.devDependencies['postcss-url']).toBeDefined();
    });

    it('should update package.json when buildable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ buildable: true });

      // ASSERT
      const packageJson = readJson(tree, '/package.json');
      expect(packageJson.devDependencies['ng-packagr']).toBeDefined();
      expect(packageJson.devDependencies['postcss']).toBeDefined();
      expect(packageJson.devDependencies['autoprefixer']).toBeDefined();
      expect(packageJson.devDependencies['postcss-url']).toBeDefined();

      const libPackageJson = readJson(tree, 'my-lib/package.json');
      expect(libPackageJson.dependencies?.['tslib']).toBeFalsy();
    });

    it('should create project configuration', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      const json = readProjectConfiguration(tree, 'my-lib');
      expect(json.root).toEqual('my-lib');
      expect(json.targets.build).toBeDefined();
      expect(json.targets.test).toBeDefined();
    });

    it('should not generate a module file and index.ts should be empty', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        skipModule: true,
      });

      // ASSERT
      const moduleFileExists = tree.exists('my-lib/src/lib/my-lib.module.ts');
      expect(moduleFileExists).toBeFalsy();
      const indexApi = tree.read('my-lib/src/index.ts', 'utf-8');
      expect(indexApi).toMatchInlineSnapshot(`
        "
        "
      `);
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
      expect(tree.read('my-lib/.browserslistrc')).toBeFalsy();
    });

    it('should remove tsconfib.lib.prod.json when library is not buildable or publishable', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        publishable: false,
        buildable: false,
      });

      // ASSERT
      expect(tree.exists('my-lib/tsconfig.lib.prod.json')).toBeFalsy();
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
        'my-lib/src/index.ts',
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      const tsconfigJson = readJson(tree, 'my-lib/tsconfig.json');
      expect(tsconfigJson).toEqual({
        extends: '../tsconfig.base.json',
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

      const appTsConfig = readJson(tree, 'my-lib/tsconfig.json');
      expect(appTsConfig.extends).toBe('../tsconfig.base.json');
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
      expect(tree.read('my-lib/src/lib/my-lib.component.spec.ts')).toBeFalsy();
      expect(tree.read('my-lib/src/lib/my-lib.service.spec.ts')).toBeFalsy();
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts();

      // ASSERT
      const tsconfigJson = readJson(tree, 'my-lib/tsconfig.spec.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    describe('when creating the tsconfig.lib.json', () => {
      it('should extend the local tsconfig.json', async () => {
        // ACT
        await runLibraryGeneratorWithOpts();

        // ASSERT
        const tsconfigJson = readJson(tree, 'my-lib/tsconfig.lib.json');
        expect(tsconfigJson.extends).toEqual('./tsconfig.json');
      });

      it('should contain includes', async () => {
        // ACT
        await runLibraryGeneratorWithOpts();

        // ASSERT
        const tsConfigJson = readJson(tree, 'my-lib/tsconfig.lib.json');
        expect(tsConfigJson.include).toEqual(['src/**/*.ts']);
      });

      it('should exclude the test setup file when unitTestRunner is jest', async () => {
        // ACT
        await runLibraryGeneratorWithOpts();

        // ASSERT
        const tsconfigJson = readJson(tree, 'my-lib/tsconfig.lib.json');
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
        const tsconfigJson = readJson(tree, 'my-lib/tsconfig.lib.json');
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
      expect(tree.exists(`my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists('my-lib/src/lib/my-lib.module.ts')).toBeTruthy();

      expect(tree.exists('my-lib/src/lib/my-lib.component.ts')).toBeFalsy();
      expect(
        tree.exists('my-lib/src/lib/my-lib.component.spec.ts')
      ).toBeFalsy();
      expect(tree.exists('my-lib/src/lib/my-lib.service.ts')).toBeFalsy();
      expect(tree.exists('my-lib/src/lib/my-lib.service.spec.ts')).toBeFalsy();

      expect(tree.exists(`my-lib2/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('my-lib2/src/index.ts')).toBeTruthy();
      expect(tree.exists('my-lib2/src/lib/my-lib2.module.ts')).toBeTruthy();

      expect(tree.exists('my-lib2/src/lib/my-lib2.component.ts')).toBeFalsy();
      expect(
        tree.exists('my-lib2/src/lib/my-lib2.component.spec.ts')
      ).toBeFalsy();
      expect(tree.exists('my-lib2/src/lib/my-lib2.service.ts')).toBeFalsy();
      expect(
        tree.exists('my-lib2/src/lib/my-lib2.service.spec.ts')
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
      await runLibraryGeneratorWithOpts({
        tags: 'one',
        directory: 'my-dir/my-lib',
      });
      await runLibraryGeneratorWithOpts({
        name: 'my-lib2',
        directory: 'my-dir/my-lib2',
        tags: 'one,two',
      });

      // ASSERT
      const projects = Object.fromEntries(getProjects(tree));

      expect(projects).toEqual({
        'my-lib': expect.objectContaining({
          tags: ['one'],
        }),
        'my-lib2': expect.objectContaining({
          tags: ['one', 'two'],
        }),
      });
    });

    it('should generate files', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        tags: 'one',
        directory: 'my-dir/my-lib',
      });
      await runLibraryGeneratorWithOpts({
        name: 'my-lib2',
        directory: 'my-dir/my-lib2',
        simpleName: true,
      });

      // ASSERT
      expect(tree.exists(`my-dir/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(
        tree.exists('my-dir/my-lib/src/lib/my-lib.module.ts')
      ).toBeTruthy();

      expect(
        tree.exists('my-dir/my-lib/src/lib/my-lib.component.ts')
      ).toBeFalsy();
      expect(
        tree.exists('my-dir/my-lib/src/lib/my-lib.component.spec.ts')
      ).toBeFalsy();
      expect(
        tree.exists('my-dir/my-lib/src/lib/my-lib.service.ts')
      ).toBeFalsy();
      expect(
        tree.exists('my-dir/my-lib/src/lib/my-lib.service.spec.ts')
      ).toBeFalsy();

      expect(tree.exists(`my-dir/my-lib2/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('my-dir/my-lib2/src/index.ts')).toBeTruthy();
      expect(
        tree.exists('my-dir/my-lib2/src/lib/my-lib2.module.ts')
      ).toBeTruthy();

      expect(
        tree.exists('my-dir/my-lib2/src/lib/my-lib2.component.ts')
      ).toBeFalsy();
      expect(
        tree.exists('my-dir/my-lib2/src/lib/my-lib2.component.spec.ts')
      ).toBeFalsy();
      expect(
        tree.exists('my-dir/my-lib2/src/lib/my-lib2.service.ts')
      ).toBeFalsy();
      expect(
        tree.exists('my-dir/my-lib2/src/lib/my-lib2.service.spec.ts')
      ).toBeFalsy();
    });

    it('should update ng-package.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        directory: 'my-dir/my-lib',
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      let ngPackage = readJson(tree, 'my-dir/my-lib/ng-package.json');
      expect(ngPackage.dest).toEqual('../../dist/my-dir/my-lib');
    });

    it('should generate project configuration', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ directory: 'my-dir/my-lib' });

      // ASSERT
      expect(readProjectConfiguration(tree, 'my-lib').root).toEqual(
        'my-dir/my-lib'
      );
    });

    it('should update tsconfig.json', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ directory: 'my-dir/my-lib' });

      // ASSERT
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-dir/my-lib/src/index.ts',
      ]);
      expect(tsconfigJson.compilerOptions.paths['my-lib/*']).toBeUndefined();
    });

    it('should update tsconfig.json (no existing path mappings)', async () => {
      // ARRANGE
      updateJson(tree, 'tsconfig.base.json', (json) => {
        json.compilerOptions.paths = undefined;
        return json;
      });

      // ACT
      await runLibraryGeneratorWithOpts({ directory: 'my-dir/my-lib' });

      // ASSERT
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');

      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-dir/my-lib/src/index.ts',
      ]);
      expect(tsconfigJson.compilerOptions.paths['my-lib/*']).toBeUndefined();
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
      await runLibraryGeneratorWithOpts({ directory: 'src/1-api/my-lib' });

      expect(readProjectConfiguration(tree, 'my-lib').root).toEqual(
        'src/1-api/my-lib'
      );
    });

    it('should have root relative routes', async () => {
      await runLibraryGeneratorWithOpts({ directory: 'my-dir/my-lib' });
      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.root).toEqual('my-dir/my-lib');
    });

    it('should generate files with correct output paths', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const content = readJson(tree, path);

        expect(lookupFn(content)).toEqual(expectedValue);
      };
      await runLibraryGeneratorWithOpts({
        directory: 'my-dir/my-lib',
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

      expect(tree.read('my-dir/my-lib/.eslintrc.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "extends": [
            "../../.eslintrc.json"
          ],
          "ignorePatterns": [
            "!**/*"
          ],
          "overrides": [
            {
              "files": [
                "*.ts"
              ],
              "extends": [
                "plugin:@nx/angular",
                "plugin:@angular-eslint/template/process-inline-templates"
              ],
              "rules": {
                "@angular-eslint/directive-selector": [
                  "error",
                  {
                    "type": "attribute",
                    "prefix": "lib",
                    "style": "camelCase"
                  }
                ],
                "@angular-eslint/component-selector": [
                  "error",
                  {
                    "type": "element",
                    "prefix": "lib",
                    "style": "kebab-case"
                  }
                ]
              }
            },
            {
              "files": [
                "*.html"
              ],
              "extends": [
                "plugin:@nx/angular-template"
              ],
              "rules": {}
            },
            {
              "files": [
                "*.json"
              ],
              "parser": "jsonc-eslint-parser",
              "rules": {
                "@nx/dependency-checks": "error"
              }
            }
          ]
        }
        "
      `);

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
          directory: 'my-dir/my-lib',
          routing: true,
          lazy: true,
        });

        await runLibraryGeneratorWithOpts({
          name: 'my-lib2',
          directory: 'my-dir/my-lib2',
          routing: true,
          lazy: true,
          simpleName: true,
        });

        // ASSERT
        expect(
          tree.exists('my-dir/my-lib/src/lib/my-lib.module.ts')
        ).toBeTruthy();
        expect(
          tree.read('my-dir/my-lib/src/lib/my-lib.module.ts', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.exists('my-dir/my-lib2/src/lib/my-lib2.module.ts')
        ).toBeTruthy();
        expect(
          tree.read('my-dir/my-lib2/src/lib/my-lib2.module.ts', 'utf-8')
        ).toMatchSnapshot();
      });

      it('should update the parent module', async () => {
        // ARRANGE
        createApp(tree, 'myapp');

        // ACT
        await runLibraryGeneratorWithOpts({
          directory: 'my-dir/my-lib',
          routing: true,
          lazy: true,
          parent: 'myapp/src/app/app.module.ts',
          skipFormat: false,
        });

        const moduleContents = tree
          .read('myapp/src/app/app.module.ts')
          .toString();
        const tsConfigLibJson = parseJson(
          tree.read('my-dir/my-lib/tsconfig.lib.json').toString()
        );

        await runLibraryGeneratorWithOpts({
          name: 'my-lib2',
          directory: 'my-dir/my-lib2',
          routing: true,
          lazy: true,
          simpleName: true,
          parent: 'myapp/src/app/app.module.ts',
          skipFormat: false,
        });

        const moduleContents2 = tree
          .read('myapp/src/app/app.module.ts')
          .toString();
        const tsConfigLibJson2 = parseJson(
          tree.read('my-dir/my-lib2/tsconfig.lib.json').toString()
        );

        await runLibraryGeneratorWithOpts({
          name: 'my-lib3',
          directory: 'my-dir/my-lib3',
          routing: true,
          lazy: true,
          simpleName: true,
          parent: 'myapp/src/app/app.module.ts',
          skipFormat: false,
        });

        const moduleContents3 = tree
          .read('myapp/src/app/app.module.ts')
          .toString();
        const tsConfigLibJson3 = parseJson(
          tree.read('my-dir/my-lib3/tsconfig.lib.json').toString()
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
                  path: 'my-lib',
                  loadChildren: () => import('@proj/my-lib').then((m) => m.MyLibModule),
                },
                {
                  path: 'my-lib2',
                  loadChildren: () => import('@proj/my-lib2').then((m) => m.MyLib2Module),
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
          'myapp/src/app/app.module.ts',
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
          directory: 'my-dir/my-lib',
          routing: true,
          lazy: true,
          parent: 'myapp/src/app/app.module.ts',
        });

        // ASSERT
        const moduleContents = tree
          .read('myapp/src/app/app.module.ts')
          .toString();

        expect(moduleContents).toMatchSnapshot();
      });
    });

    describe('eager', () => {
      it('should add RouterModule and define an array of routes', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({
          directory: 'my-dir/my-lib',
          routing: true,
        });

        await runLibraryGeneratorWithOpts({
          name: 'my-lib2',
          directory: 'my-dir/my-lib2',
          simpleName: true,
          routing: true,
        });
        // ASSERT
        expect(
          tree.exists('my-dir/my-lib/src/lib/my-lib.module.ts')
        ).toBeTruthy();
        expect(
          tree.read('my-dir/my-lib/src/lib/my-lib.module.ts').toString()
        ).toContain('RouterModule');
        expect(
          tree.read('my-dir/my-lib/src/lib/lib.routes.ts').toString()
        ).toContain('const myLibRoutes: Route[] = ');

        expect(
          tree.exists('my-dir/my-lib2/src/lib/my-lib2.module.ts')
        ).toBeTruthy();
        expect(
          tree.read('my-dir/my-lib2/src/lib/my-lib2.module.ts').toString()
        ).toContain('RouterModule');
        expect(
          tree.read('my-dir/my-lib2/src/lib/lib.routes.ts').toString()
        ).toContain('const myLib2Routes: Route[] = ');
      });

      it('should update the parent module', async () => {
        // ARRANGE
        createApp(tree, 'myapp');

        // ACT
        await runLibraryGeneratorWithOpts({
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          routing: true,
          parent: 'myapp/src/app/app.module.ts',
        });

        const moduleContents = tree
          .read('myapp/src/app/app.module.ts')
          .toString();

        await runLibraryGeneratorWithOpts({
          name: 'my-lib2',
          directory: 'my-dir/my-lib2',
          simpleName: true,
          routing: true,
          parent: 'myapp/src/app/app.module.ts',
        });

        const moduleContents2 = tree
          .read('myapp/src/app/app.module.ts')
          .toString();

        await runLibraryGeneratorWithOpts({
          name: 'my-lib3',
          directory: 'my-dir/my-lib3',
          routing: true,
          parent: 'myapp/src/app/app.module.ts',
          simpleName: true,
        });

        const moduleContents3 = tree
          .read('myapp/src/app/app.module.ts')
          .toString();

        // ASSERT
        expect(moduleContents).toContain('MyLibModule');
        expect(moduleContents).toContain('RouterModule.forRoot([');
        expect(moduleContents).toContain(
          "{ path: 'my-lib', children: myLibRoutes }"
        );

        expect(moduleContents2).toContain('MyLib2Module');
        expect(moduleContents2).toContain('RouterModule.forRoot([');
        expect(moduleContents2).toContain(
          "{ path: 'my-lib', children: myLibRoutes }"
        );
        expect(moduleContents2).toContain(
          "{ path: 'my-lib2', children: myLib2Routes }"
        );

        expect(moduleContents3).toContain('MyLib3Module');
        expect(moduleContents3).toContain('RouterModule.forRoot([');
        expect(moduleContents3).toContain(
          "{ path: 'my-lib', children: myLibRoutes }"
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
          'myapp/src/app/app.module.ts',
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
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          routing: true,
          parent: 'myapp/src/app/app.module.ts',
        });

        // ASSERT
        const moduleContents = tree
          .read('myapp/src/app/app.module.ts')
          .toString();

        expect(moduleContents).toContain('RouterModule.forRoot(routes)');
        expect(moduleContents).toContain(
          `const routes = [{ path: 'my-lib', children: myLibRoutes }];`
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
      expect(tree.exists('my-lib/src/lib/my-lib.module.spec.ts')).toBeFalsy();
      expect(tree.exists('my-lib/src/test.ts')).toBeFalsy();
      expect(tree.exists('my-lib/src/test.ts')).toBeFalsy();
      expect(tree.exists('my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('my-lib/jest.config.ts')).toBeFalsy();
      expect(tree.exists('my-lib/karma.conf.js')).toBeFalsy();
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({
        directory: 'my-dir/my-lib',
        publishable: true,
        importPath: '@myorg/lib',
      });

      // ASSERT
      const packageJson = readJson(tree, 'my-dir/my-lib/package.json');
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
          name: 'my-lib2',
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
        'my-lib/tsconfig.json'
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
      it('should add valid eslint JSON configuration which extends from Nx presets', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({ linter: Linter.EsLint });

        // ASSERT

        const eslintConfig = readJson(tree, 'my-lib/.eslintrc.json');
        expect(eslintConfig).toMatchInlineSnapshot(`
          {
            "extends": [
              "../.eslintrc.json",
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
                      "prefix": "lib",
                      "style": "kebab-case",
                      "type": "element",
                    },
                  ],
                  "@angular-eslint/directive-selector": [
                    "error",
                    {
                      "prefix": "lib",
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

      it('should add dependency checks to buildable libs', async () => {
        // ACT
        await runLibraryGeneratorWithOpts({
          linter: Linter.EsLint,
          buildable: true,
        });

        // ASSERT

        const eslintConfig = readJson(tree, 'my-lib/.eslintrc.json');
        expect(eslintConfig).toMatchInlineSnapshot(`
          {
            "extends": [
              "../.eslintrc.json",
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
                      "prefix": "lib",
                      "style": "kebab-case",
                      "type": "element",
                    },
                  ],
                  "@angular-eslint/directive-selector": [
                    "error",
                    {
                      "prefix": "lib",
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
              {
                "files": [
                  "*.json",
                ],
                "parser": "jsonc-eslint-parser",
                "rules": {
                  "@nx/dependency-checks": "error",
                },
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
      expect(tree.exists('my-lib/tailwind.config.js')).toBeFalsy();
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['tailwindcss']).toBeUndefined();
      expect(devDependencies['postcss']).toBeUndefined();
      expect(devDependencies['autoprefixer']).toBeUndefined();
    });

    it('should not set up Tailwind when "--add-tailwind=false"', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ addTailwind: false });

      // ASSERT
      expect(tree.exists('my-lib/tailwind.config.js')).toBeFalsy();
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['tailwindcss']).toBeUndefined();
      expect(devDependencies['postcss']).toBeUndefined();
      expect(devDependencies['autoprefixer']).toBeUndefined();
    });

    it('should set up Tailwind when "--add-tailwind=true"', async () => {
      // ACT
      await runLibraryGeneratorWithOpts({ addTailwind: true, buildable: true });

      // ASSERT
      expect(tree.read('my-lib/tailwind.config.js', 'utf-8'))
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
        'my-lib/tailwind.config.js'
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
              root: 'my-lib',
            } as any,
          },
        },
        dependencies: {},
      };
    });

    it('should generate a library with a standalone component as entry point', async () => {
      await runLibraryGeneratorWithOpts({ standalone: true });

      expect(tree.read('my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib/my-lib.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component and have it flat', async () => {
      await runLibraryGeneratorWithOpts({ standalone: true, flat: true });

      expect(tree.read('my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component in a directory', async () => {
      await runLibraryGeneratorWithOpts({
        standalone: true,
        directory: 'my-dir/my-lib',
      });

      expect(
        tree.read('my-dir/my-lib/src/index.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('my-dir/my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(
          'my-dir/my-lib/src/lib/my-lib/my-lib.component.spec.ts',
          'utf-8'
        )
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component in a directory with a simple name', async () => {
      await runLibraryGeneratorWithOpts({
        standalone: true,
        directory: 'my-dir/my-lib',
        simpleName: true,
      });

      expect(
        tree.read('my-dir/my-lib/src/index.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('my-dir/my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(
          'my-dir/my-lib/src/lib/my-lib/my-lib.component.spec.ts',
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

      expect(tree.read('my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/lib.routes.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.children('my-lib/src/lib')).toMatchInlineSnapshot(`
        [
          "lib.routes.ts",
          "my-lib.component.css",
          "my-lib.component.html",
          "my-lib.component.spec.ts",
          "my-lib.component.ts",
        ]
      `);
      expect(tree.children('my-lib/src')).toMatchInlineSnapshot(`
        [
          "index.ts",
          "lib",
          "test-setup.ts",
        ]
      `);
    });

    it('should generate a library with a standalone component as entry point with routing setup', async () => {
      await runLibraryGeneratorWithOpts({ standalone: true, routing: true });

      expect(tree.read('my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/lib.routes.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib/my-lib.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component as entry point with routing setup and attach it to parent module as direct child', async () => {
      // ARRANGE
      await generateTestApplication(tree, {
        name: 'app1',
        routing: true,
        skipFormat: true,
      });

      // ACT
      await runLibraryGeneratorWithOpts({
        standalone: true,
        routing: true,
        parent: 'app1/src/app/app.routes.ts',
      });

      // ASSERT
      expect(tree.read('my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/lib.routes.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('app1/src/app/app.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component as entry point with routing setup and attach it to parent module as a lazy child', async () => {
      // ARRANGE
      await generateTestApplication(tree, {
        name: 'app1',
        routing: true,
        skipFormat: true,
      });

      // ACT
      await runLibraryGeneratorWithOpts({
        standalone: true,
        routing: true,
        lazy: true,
        parent: 'app1/src/app/app.routes.ts',
      });

      // ASSERT
      expect(tree.read('my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/lib.routes.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('app1/src/app/app.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component as entry point with routing setup and attach it to standalone parent module as direct child', async () => {
      // ARRANGE
      await generateTestApplication(tree, {
        name: 'app1',
        routing: true,
        standalone: true,
        skipFormat: true,
      });

      // ACT
      await runLibraryGeneratorWithOpts({
        standalone: true,
        routing: true,
        parent: 'app1/src/app/app.routes.ts',
      });

      // ASSERT
      expect(tree.read('app1/src/app/app.routes.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { Route } from '@angular/router';
        import { myLibRoutes } from '@proj/my-lib';

        export const appRoutes: Route[] = [
            { path: 'my-lib', children: myLibRoutes },];
        "
      `);
    });

    it('should generate a library with a standalone component as entry point with routing setup and attach it to standalone parent module as a lazy child', async () => {
      // ARRANGE
      await generateTestApplication(tree, {
        name: 'app1',
        routing: true,
        standalone: true,
        skipFormat: true,
      });

      // ACT
      await runLibraryGeneratorWithOpts({
        standalone: true,
        routing: true,
        lazy: true,
        parent: 'app1/src/app/app.routes.ts',
      });

      // ASSERT
      expect(tree.read('app1/src/app/app.routes.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { Route } from '@angular/router';

        export const appRoutes: Route[] = [
            { path: 'my-lib', loadChildren: () => import('@proj/my-lib').then(m => m.myLibRoutes) },];
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
        parent: 'my-lib/src/lib/lib.routes.ts',
      });

      // ASSERT
      expect(
        tree.read('my-lib/src/lib/lib.routes.ts', 'utf-8')
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
        parent: 'my-lib/src/lib/lib.routes.ts',
      });

      // ASSERT
      expect(
        tree.read('my-lib/src/lib/lib.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component as entry point following SFC pattern', async () => {
      await runLibraryGeneratorWithOpts({
        standalone: true,
        inlineStyle: true,
        inlineTemplate: true,
      });

      expect(tree.read('my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib/my-lib.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a library with a standalone component as entry point and skip tests', async () => {
      await runLibraryGeneratorWithOpts({
        standalone: true,
        inlineStyle: true,
        inlineTemplate: true,
        skipTests: true,
      });

      expect(tree.read('my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.exists('my-lib/src/lib/my-lib/my-lib.component.spec.ts')
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

      expect(tree.read('my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('my-lib/src/lib/my-lib/my-lib.component.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('--project-name-and-root-format=derived', () => {
    it('should generate correctly when no directory is provided', async () => {
      await runLibraryGeneratorWithOpts({
        projectNameAndRootFormat: 'derived',
      });

      const json = readProjectConfiguration(tree, 'my-lib');
      expect(json.root).toEqual('libs/my-lib');
      const tsconfigBaseJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigBaseJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts',
      ]);
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson.extends).toBe('../../tsconfig.base.json');
      expect(tree.exists(`libs/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.module.ts')).toBeTruthy();
    });

    it('should generate correctly when directory is provided', async () => {
      await runLibraryGeneratorWithOpts({
        directory: 'myDir',
        projectNameAndRootFormat: 'derived',
      });

      const json = readProjectConfiguration(tree, 'my-dir-my-lib');
      expect(json.root).toEqual('libs/my-dir/my-lib');
      const tsconfigBaseJson = readJson(tree, '/tsconfig.base.json');
      expect(
        tsconfigBaseJson.compilerOptions.paths['@proj/my-dir/my-lib']
      ).toEqual(['libs/my-dir/my-lib/src/index.ts']);
      const tsconfigJson = readJson(tree, 'libs/my-dir/my-lib/tsconfig.json');
      expect(tsconfigJson.extends).toBe('../../../tsconfig.base.json');
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.module.ts')
      ).toBeTruthy();
    });
  });
});
