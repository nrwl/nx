import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import {
  NxJsonConfiguration,
  parseJson,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import * as enquirer from 'enquirer';
import { backwardCompatibleVersions } from '../../utils/backward-compatible-versions';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import {
  angularDevkitVersion,
  angularVersion,
  autoprefixerVersion,
  postcssVersion,
  tailwindVersion,
} from '../../utils/versions';
import { generateTestApplication } from '../utils/testing';
import type { Schema } from './schema';

// need to mock cypress otherwise it'll use installed version in this repo's package.json
jest.mock('@nx/cypress/src/utils/cypress-version');
jest.mock('enquirer');
jest.mock('@nx/devkit', () => {
  const original = jest.requireActual('@nx/devkit');
  return {
    ...original,
    ensurePackage: (pkg: string) => jest.requireActual(pkg),
    createProjectGraphAsync: jest.fn().mockResolvedValue({
      nodes: {},
      dependencies: {},
    }),
  };
});

describe('app', () => {
  let appTree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(null);
    // @ts-ignore
    enquirer.prompt = jest
      .fn()
      .mockReturnValue(Promise.resolve({ 'standalone-components': true }));
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add angular dependencies', async () => {
    // ACT
    await generateApp(appTree);

    // ASSERT
    const { dependencies, devDependencies } = readJson(appTree, 'package.json');

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

  it('should generate correct tsconfig.editor.json', async () => {
    await generateApp(appTree);

    const tsConfig = readJson(appTree, 'my-app/tsconfig.editor.json');
    expect(tsConfig).toMatchSnapshot();
  });

  it('should not touch the package.json when run with `--skipPackageJson`', async () => {
    let initialPackageJson;
    updateJson(appTree, 'package.json', (json) => {
      json.dependencies = {};
      json.devDependencies = {};
      initialPackageJson = json;

      return json;
    });

    await generateApp(appTree, 'my-app', { skipPackageJson: true });

    const packageJson = readJson(appTree, 'package.json');
    expect(packageJson).toEqual(initialPackageJson);
  });

  describe('not nested', () => {
    it('should create project configs', async () => {
      // ACT
      await generateApp(appTree);

      expect(readProjectConfiguration(appTree, 'my-app')).toMatchSnapshot();
      expect(readProjectConfiguration(appTree, 'my-app-e2e')).toMatchSnapshot();
    });

    it('should not produce tests when UnitTestRunner = none', async () => {
      // ACT
      await generateApp(appTree, 'my-app', {
        unitTestRunner: UnitTestRunner.None,
      });
      const { targets } = readProjectConfiguration(appTree, 'my-app');
      expect(targets.test).toBeFalsy();
      expect(
        appTree.exists('my-app/src/app/app.component.spec.ts')
      ).toBeFalsy();
    });

    it('should remove the e2e target on the application', async () => {
      // ACT
      await generateApp(appTree);

      // ASSERT
      expect(
        readProjectConfiguration(appTree, 'my-app').targets.e2e
      ).not.toBeDefined();
    });

    it('should update tags + implicit dependencies', async () => {
      // ACT
      await generateApp(appTree, 'my-app', { tags: 'one,two,my-app' });

      // ASSERT
      const projects = devkit.getProjects(appTree);
      expect(projects).toEqual(
        new Map(
          Object.entries({
            'my-app': expect.objectContaining({
              tags: ['one', 'two', 'my-app'],
            }),
            'my-app-e2e': expect.objectContaining({
              implicitDependencies: ['my-app'],
              tags: [],
            }),
          })
        )
      );
    });

    it('should generate files', async () => {
      await generateApp(appTree);

      expect(appTree.exists('my-app/jest.config.ts')).toBeTruthy();
      expect(appTree.exists('my-app/src/main.ts')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/app.module.ts')).toBeTruthy();
      expect(appTree.exists('my-app/src/app/app.component.ts')).toBeTruthy();
      expect(appTree.read('my-app/src/app/app.module.ts', 'utf-8')).toContain(
        'class AppModule'
      );

      expect(readJson(appTree, 'my-app/tsconfig.json')).toMatchSnapshot(
        'tsconfig.json'
      );

      const tsconfigApp = parseJson(
        appTree.read('my-app/tsconfig.app.json', 'utf-8')
      );
      expect(tsconfigApp).toMatchSnapshot('tsconfig.app.json');

      const eslintrcJson = parseJson(
        appTree.read('my-app/.eslintrc.json', 'utf-8')
      );
      expect(eslintrcJson.extends).toEqual(['../.eslintrc.json']);

      expect(appTree.exists('my-app-e2e/cypress.config.ts')).toBeTruthy();
      const tsconfigE2E = parseJson(
        appTree.read('my-app-e2e/tsconfig.json', 'utf-8')
      );
      expect(tsconfigE2E).toMatchSnapshot('e2e tsconfig.json');
    });

    it('should setup playwright', async () => {
      await generateApp(appTree, 'playwright-app', {
        e2eTestRunner: E2eTestRunner.Playwright,
      });

      expect(
        appTree.exists('playwright-app-e2e/playwright.config.ts')
      ).toBeTruthy();
      expect(
        appTree.exists('playwright-app-e2e/src/example.spec.ts')
      ).toBeTruthy();
    });

    it('should setup jest with serializers', async () => {
      await generateApp(appTree);

      expect(appTree.read('my-app/jest.config.ts', 'utf-8')).toContain(
        `'jest-preset-angular/build/serializers/no-ng-attributes'`
      );
      expect(appTree.read('my-app/jest.config.ts', 'utf-8')).toContain(
        `'jest-preset-angular/build/serializers/ng-snapshot'`
      );
      expect(appTree.read('my-app/jest.config.ts', 'utf-8')).toContain(
        `'jest-preset-angular/build/serializers/html-comment'`
      );
    });

    it('should support a root tsconfig.json instead of tsconfig.base.json', async () => {
      // ARRANGE
      appTree.rename('tsconfig.base.json', 'tsconfig.json');

      // ACT
      await generateApp(appTree, 'app');

      // ASSERT
      const appTsConfig = readJson(appTree, 'app/tsconfig.json');
      expect(appTsConfig.extends).toBe('../tsconfig.json');
    });

    it('should not overwrite default project if already set', async () => {
      // ARRANGE
      const nxJson = readNxJson(appTree);
      nxJson.defaultProject = 'some-awesome-project';
      devkit.updateNxJson(appTree, nxJson);

      // ACT
      await generateApp(appTree);

      // ASSERT
      const { defaultProject } = readNxJson(appTree);
      expect(defaultProject).toBe('some-awesome-project');
    });

    it('should set esModuleInterop when using the application builder', async () => {
      await generateApp(appTree, 'my-app');

      expect(
        readJson(appTree, 'my-app/tsconfig.json').compilerOptions
          .esModuleInterop
      ).toBe(true);
    });

    it('should not set esModuleInterop when using the browser builder', async () => {
      await generateApp(appTree, 'my-app', { bundler: 'webpack' });

      expect(
        readJson(appTree, 'my-app/tsconfig.json').compilerOptions
          .esModuleInterop
      ).toBeUndefined();
    });
  });

  describe('nested', () => {
    it('should create project configs', async () => {
      await generateApp(appTree, 'my-app', { directory: 'my-dir/my-app' });
      expect(readProjectConfiguration(appTree, 'my-app')).toMatchSnapshot();
      expect(readProjectConfiguration(appTree, 'my-app-e2e')).toMatchSnapshot();
    });

    it('should update tags + implicit dependencies', async () => {
      await generateApp(appTree, 'my-app', {
        directory: 'my-dir/my-app',
        tags: 'one,two,my-app',
      });
      const projects = devkit.getProjects(appTree);
      expect(projects).toEqual(
        new Map(
          Object.entries({
            'my-app': expect.objectContaining({
              tags: ['one', 'two', 'my-app'],
            }),
            'my-app-e2e': expect.objectContaining({
              implicitDependencies: ['my-app'],
              tags: [],
            }),
          })
        )
      );
    });

    it('should generate files', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const content = readJson(appTree, path);

        expect(lookupFn(content)).toEqual(expectedValue);
      };
      await generateApp(appTree, 'my-app', { directory: 'my-dir/my-app' });

      const appModulePath = 'my-dir/my-app/src/app/app.module.ts';
      expect(appTree.read(appModulePath, 'utf-8')).toContain('class AppModule');

      // Make sure these exist
      [
        `my-dir/my-app/jest.config.ts`,
        'my-dir/my-app/src/main.ts',
        'my-dir/my-app/src/app/app.module.ts',
        'my-dir/my-app/src/app/app.component.ts',
        'my-dir/my-app-e2e/cypress.config.ts',
      ].forEach((path) => {
        expect(appTree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'my-dir/my-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../dist/out-tsc',
        },
        {
          path: 'my-dir/my-app/tsconfig.app.json',
          lookupFn: (json) => json.exclude,
          expectedValue: [
            'jest.config.ts',
            'src/**/*.test.ts',
            'src/**/*.spec.ts',
          ],
        },
        {
          path: 'my-dir/my-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });

    it('should extend from tsconfig.base.json', async () => {
      // ACT
      await generateApp(appTree, 'app', { directory: 'my-dir/app' });

      // ASSERT
      const appTsConfig = readJson(appTree, 'my-dir/app/tsconfig.json');
      expect(appTsConfig.extends).toBe('../../tsconfig.base.json');
    });

    it('should support a root tsconfig.json instead of tsconfig.base.json', async () => {
      // ARRANGE
      appTree.rename('tsconfig.base.json', 'tsconfig.json');

      // ACT
      await generateApp(appTree, 'app', { directory: 'my-dir/app' });

      // ASSERT
      const appTsConfig = readJson(appTree, 'my-dir/app/tsconfig.json');
      expect(appTsConfig.extends).toBe('../../tsconfig.json');
    });
  });

  describe('at the root', () => {
    beforeEach(() => {
      appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      updateJson(appTree, 'nx.json', (json) => ({
        ...json,
        workspaceLayout: { appsDir: '' },
      }));
    });

    it('should accept numbers in the path', async () => {
      // ACT
      await generateApp(appTree, 'my-app', {
        directory: 'src/9-websites/my-app',
      });

      // ASSERT

      expect(
        readProjectConfiguration(appTree, 'my-app').root
      ).toMatchSnapshot();
    });

    it('should generate files', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const content = readJson(appTree, path);

        expect(lookupFn(content)).toEqual(expectedValue);
      };
      await generateApp(appTree, 'my-app', { directory: 'my-dir/my-app' });

      const appModulePath = 'my-dir/my-app/src/app/app.module.ts';
      expect(appTree.read(appModulePath, 'utf-8')).toContain('class AppModule');

      // Make sure these exist
      [
        'my-dir/my-app/jest.config.ts',
        'my-dir/my-app/src/main.ts',
        'my-dir/my-app/src/app/app.module.ts',
        'my-dir/my-app/src/app/app.component.ts',
        'my-dir/my-app-e2e/cypress.config.ts',
      ].forEach((path) => {
        expect(appTree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'my-dir/my-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../dist/out-tsc',
        },
        {
          path: 'my-dir/my-app/tsconfig.app.json',
          lookupFn: (json) => json.exclude,
          expectedValue: [
            'jest.config.ts',
            'src/**/*.test.ts',
            'src/**/*.spec.ts',
          ],
        },
        {
          path: 'my-dir/my-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });

    it('should set esModuleInterop when using the application builder', async () => {
      await generateApp(appTree, 'my-app', { rootProject: true });

      expect(
        readJson(appTree, 'tsconfig.json').compilerOptions.esModuleInterop
      ).toBe(true);
    });

    it('should not set esModuleInterop when using the browser builder', async () => {
      await generateApp(appTree, 'my-app', {
        rootProject: true,
        bundler: 'webpack',
      });

      expect(
        readJson(appTree, 'tsconfig.json').compilerOptions.esModuleInterop
      ).toBeUndefined();
    });
  });

  describe('routing', () => {
    it('should include RouterTestingModule', async () => {
      await generateApp(appTree, 'myApp', {
        directory: 'my-dir/my-app',
      });
      expect(
        appTree.read('my-dir/my-app/src/app/app.module.ts', 'utf-8')
      ).toContain('RouterModule.forRoot');
      expect(
        appTree.read('my-dir/my-app/src/app/app.component.spec.ts', 'utf-8')
      ).toContain('imports: [RouterTestingModule]');
    });

    it('should not modify tests when --skip-tests is set', async () => {
      await generateApp(appTree, 'myApp', {
        directory: 'my-dir/my-app',
        skipTests: true,
      });
      expect(
        appTree.exists('my-dir/my-app/src/app/app.component.spec.ts')
      ).toBeFalsy();
    });
  });

  describe('template generation mode', () => {
    it('should create Nx specific `app.component.html` template', async () => {
      await generateApp(appTree, 'my-app', { directory: 'my-dir/my-app' });
      expect(
        appTree.read('my-dir/my-app/src/app/app.component.html', 'utf-8')
      ).toContain('<app-nx-welcome></app-nx-welcome>');
    });

    it("should update `template`'s property of AppComponent with Nx content", async () => {
      await generateApp(appTree, 'my-app', {
        directory: 'my-dir/my-app',
        inlineTemplate: true,
      });
      expect(
        appTree.read('my-dir/my-app/src/app/app.component.ts', 'utf-8')
      ).toContain('<app-nx-welcome></app-nx-welcome>');
    });

    it('should create Nx specific `nx-welcome.component.ts` file', async () => {
      await generateApp(appTree, 'my-app', { directory: 'my-dir/my-app' });
      expect(
        appTree.read('my-dir/my-app/src/app/nx-welcome.component.ts', 'utf-8')
      ).toContain('Hello there');
    });

    it('should update the AppComponent spec to target Nx content', async () => {
      await generateApp(appTree, 'my-app', {
        directory: 'my-dir/my-app',
        inlineTemplate: true,
      });
      const testFileContent = appTree.read(
        'my-dir/my-app/src/app/app.component.spec.ts',
        'utf-8'
      );

      expect(testFileContent).toContain(`querySelector('h1')`);
      expect(testFileContent).toContain('Welcome my-app');
    });
  });

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      await generateApp(appTree, 'my-app', { style: 'scss' });
      expect(appTree.exists('my-app/src/app/app.component.scss')).toEqual(true);
    });
  });

  describe('--style sass', () => {
    it('should generate sass styles', async () => {
      await generateApp(appTree, 'my-app', { style: 'sass' });
      expect(appTree.exists('my-app/src/app/app.component.sass')).toEqual(true);
    });
  });

  describe('--style less', () => {
    it('should generate less styles', async () => {
      await generateApp(appTree, 'my-app', { style: 'less' });
      expect(appTree.exists('my-app/src/app/app.component.less')).toEqual(true);
    });
  });

  describe('format files', () => {
    it('should format files', async () => {
      const formatFilesSpy = jest.spyOn(devkit, 'formatFiles');

      await generateApp(appTree, 'my-app', { skipFormat: false });

      expect(formatFilesSpy).toHaveBeenCalled();
      expect(
        appTree.read('my-app/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('my-app/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('my-app/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('my-app/src/app/app.routes.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('--linter', () => {
    describe('eslint', () => {
      it('should add lint target to application', async () => {
        await generateApp(appTree, 'my-app', { linter: Linter.EsLint });
        expect(readProjectConfiguration(appTree, 'my-app').targets.lint)
          .toMatchInlineSnapshot(`
          {
            "executor": "@nx/eslint:lint",
          }
        `);
      });

      it('should add eslint plugin and no lint target to e2e project', async () => {
        await generateApp(appTree, 'my-app', { linter: Linter.EsLint });

        expect(readNxJson(appTree).plugins).toMatchInlineSnapshot(`
          [
            {
              "options": {
                "ciTargetName": "e2e-ci",
                "componentTestingTargetName": "component-test",
                "openTargetName": "open-cypress",
                "targetName": "e2e",
              },
              "plugin": "@nx/cypress/plugin",
            },
            {
              "options": {
                "targetName": "lint",
              },
              "plugin": "@nx/eslint/plugin",
            },
          ]
        `);
        expect(
          readProjectConfiguration(appTree, 'my-app-e2e').targets.lint
        ).toBeUndefined();
      });

      it('should not add eslint plugin when no e2e test runner', async () => {
        await generateApp(appTree, 'my-app', {
          linter: Linter.EsLint,
          e2eTestRunner: E2eTestRunner.None,
        });

        expect(readNxJson(appTree).plugins).toBeUndefined();
      });

      it('should add valid eslint JSON configuration which extends from Nx presets', async () => {
        await generateApp(appTree, 'my-app', { linter: Linter.EsLint });

        const eslintConfig = readJson(appTree, 'my-app/.eslintrc.json');
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
                      "prefix": "app",
                      "style": "kebab-case",
                      "type": "element",
                    },
                  ],
                  "@angular-eslint/directive-selector": [
                    "error",
                    {
                      "prefix": "app",
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
      it('should add no lint target', async () => {
        await generateApp(appTree, 'my-app', { linter: Linter.None });
        expect(
          readProjectConfiguration(appTree, 'my-app').targets.lint
        ).toBeUndefined();
      });
    });
  });

  describe('--unit-test-runner', () => {
    describe('default (jest)', () => {
      it('should generate jest.config.ts with serializers', async () => {
        await generateApp(appTree);

        const jestConfig = appTree.read('my-app/jest.config.ts', 'utf-8');

        expect(jestConfig).toContain(
          `'jest-preset-angular/build/serializers/no-ng-attributes'`
        );
        expect(jestConfig).toContain(
          `'jest-preset-angular/build/serializers/ng-snapshot'`
        );
        expect(jestConfig).toContain(
          `'jest-preset-angular/build/serializers/html-comment'`
        );
      });

      it('should add reference to tsconfig.spec.json to tsconfig.json', async () => {
        await generateApp(appTree);

        const { references } = readJson(appTree, 'my-app/tsconfig.json');
        expect(
          references.find((r) => r.path.includes('tsconfig.spec.json'))
        ).toBeTruthy();
      });
    });

    describe('none', () => {
      it('should not generate test configuration', async () => {
        await generateApp(appTree, 'my-app', {
          unitTestRunner: UnitTestRunner.None,
        });
        expect(appTree.exists('my-app/src/test-setup.ts')).toBeFalsy();
        expect(appTree.exists('my-app/src/test.ts')).toBeFalsy();
        expect(appTree.exists('my-app/tsconfig.spec.json')).toBeFalsy();
        expect(appTree.exists('my-app/jest.config.ts')).toBeFalsy();
        expect(appTree.exists('my-app/karma.config.js')).toBeFalsy();
        expect(
          appTree.exists('my-app/src/app/app.component.spec.ts')
        ).toBeFalsy();
        expect(
          readProjectConfiguration(appTree, 'my-app').targets.test
        ).toBeUndefined();
        // check tsconfig.spec.json is not referenced
        const { references } = readJson(appTree, 'my-app/tsconfig.json');
        expect(
          references.every((r) => !r.path.includes('tsconfig.spec.json'))
        ).toBe(true);
      });
    });
  });

  describe('--e2e-test-runner', () => {
    describe('none', () => {
      it('should not generate test configuration', async () => {
        await generateApp(appTree, 'my-app', {
          e2eTestRunner: E2eTestRunner.None,
        });
        expect(appTree.exists('my-app-e2e')).toBeFalsy();
      });
    });
  });

  describe('--backend-project', () => {
    describe('with a backend project', () => {
      it('should add a proxy.conf.json to app', async () => {
        await generateApp(appTree, 'customer-ui', {
          backendProject: 'customer-api',
        });

        const proxyConfContent = JSON.stringify(
          {
            '/customer-api': {
              target: 'http://localhost:3333',
              secure: false,
            },
          },
          null,
          2
        );

        expect(appTree.exists('customer-ui/proxy.conf.json')).toBeTruthy();
        expect(appTree.read('customer-ui/proxy.conf.json', 'utf-8')).toContain(
          proxyConfContent
        );
      });
    });

    describe('with no backend project', () => {
      it('should not generate a proxy.conf.json', async () => {
        await generateApp(appTree, 'customer-ui');

        expect(appTree.exists('customer-ui/proxy.conf.json')).toBeFalsy();
      });
    });
  });

  describe('--strict', () => {
    it('should enable strict type checking', async () => {
      await generateApp(appTree, 'my-app', { strict: true });

      const appTsConfig = readJson(appTree, 'my-app/tsconfig.json');
      expect(appTsConfig).toMatchSnapshot('app tsconfig.json');
      const e2eTsConfig = readJson(appTree, 'my-app-e2e/tsconfig.json');
      expect(e2eTsConfig).toMatchSnapshot('e2e tsconfig.json');

      // should not update workspace configuration since --strict=true is the default
      const nxJson = readJson<NxJsonConfiguration>(appTree, 'nx.json');
      expect(
        nxJson.generators['@nx/angular:application'].strict
      ).not.toBeDefined();
    });

    it('should set defaults when --strict=false', async () => {
      await generateApp(appTree, 'my-app', { strict: false });

      // check to see if the workspace configuration has been updated to turn off
      // strict mode by default in future applications
      const nxJson = readJson<NxJsonConfiguration>(appTree, 'nx.json');
      expect(nxJson.generators['@nx/angular:application'].strict).toBe(false);
    });
  });

  describe('--add-tailwind', () => {
    it('should not add a tailwind.config.js and relevant packages when "--add-tailwind" is not specified', async () => {
      // ACT
      await generateApp(appTree, 'app1');

      // ASSERT
      expect(appTree.exists('app1/tailwind.config.js')).toBeFalsy();
      const { devDependencies } = readJson(appTree, 'package.json');
      expect(devDependencies['tailwindcss']).toBeUndefined();
      expect(devDependencies['postcss']).toBeUndefined();
      expect(devDependencies['autoprefixer']).toBeUndefined();
    });

    it('should not add a tailwind.config.js and relevant packages when "--add-tailwind=false"', async () => {
      // ACT
      await generateApp(appTree, 'app1', { addTailwind: false });

      // ASSERT
      expect(appTree.exists('app1/tailwind.config.js')).toBeFalsy();
      const { devDependencies } = readJson(appTree, 'package.json');
      expect(devDependencies['tailwindcss']).toBeUndefined();
      expect(devDependencies['postcss']).toBeUndefined();
      expect(devDependencies['autoprefixer']).toBeUndefined();
    });

    it('should add a tailwind.config.js and relevant packages when "--add-tailwind=true"', async () => {
      // ACT
      await generateApp(appTree, 'app1', { addTailwind: true });

      // ASSERT
      expect(appTree.read('app1/tailwind.config.js', 'utf-8'))
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
      const { devDependencies } = readJson(appTree, 'package.json');
      expect(devDependencies['tailwindcss']).toBe(tailwindVersion);
      expect(devDependencies['postcss']).toBe(postcssVersion);
      expect(devDependencies['autoprefixer']).toBe(autoprefixerVersion);
    });
  });

  describe('--standalone', () => {
    it('should generate a standalone app correctly with routing', async () => {
      // ACT
      await generateApp(appTree, 'standalone', {
        standalone: true,
      });

      // ASSERT
      expect(appTree.read('standalone/src/main.ts', 'utf-8')).toMatchSnapshot();
      expect(
        appTree.read('standalone/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('standalone/src/app/app.routes.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('standalone/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('standalone/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(appTree.exists('standalone/src/app/app.module.ts')).toBeFalsy();
      expect(
        appTree.read('standalone/src/app/nx-welcome.component.ts', 'utf-8')
      ).toContain('standalone: true');
    });

    it('should generate a standalone app correctly without routing', async () => {
      // ACT
      await generateApp(appTree, 'standalone', {
        standalone: true,
        routing: false,
      });

      // ASSERT
      expect(appTree.read('standalone/src/main.ts', 'utf-8')).toMatchSnapshot();
      expect(
        appTree.read('standalone/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('standalone/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('standalone/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(appTree.exists('standalone/src/app/app.module.ts')).toBeFalsy();
      expect(
        appTree.read('standalone/src/app/nx-welcome.component.ts', 'utf-8')
      ).toContain('standalone: true');
    });

    it('should should not use event coalescing in versions lower than v18', async () => {
      updateJson(appTree, 'package.json', (json) => ({
        ...json,
        dependencies: { ...json.dependencies, '@angular/core': '~17.0.0' },
      }));

      await generateApp(appTree, 'standalone', { standalone: true });

      expect(
        appTree.read('standalone/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  it('should generate correct main.ts', async () => {
    // ACT
    await generateApp(appTree, 'myapp');

    // ASSERT
    expect(appTree.read('myapp/src/main.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
      import { AppModule } from './app/app.module';

      platformBrowserDynamic()
        .bootstrapModule(AppModule, {
          ngZoneEventCoalescing: true
        })
        .catch((err) => console.error(err));
      "
    `);
  });

  it('should should not use event coalescing in versions lower than v18', async () => {
    updateJson(appTree, 'package.json', (json) => ({
      ...json,
      dependencies: { ...json.dependencies, '@angular/core': '~17.0.0' },
    }));

    await generateApp(appTree, 'myapp');

    expect(appTree.read('myapp/src/main.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
      import { AppModule } from './app/app.module';

      platformBrowserDynamic()
        .bootstrapModule(AppModule)
        .catch((err) => console.error(err));
      "
    `);
  });

  describe('--root-project', () => {
    it('should create files at the root', async () => {
      await generateApp(appTree, 'my-app', {
        rootProject: true,
      });

      expect(appTree.exists('src/main.ts')).toBe(true);
      expect(appTree.exists('src/app/app.module.ts')).toBe(true);
      expect(appTree.exists('src/app/app.component.ts')).toBe(true);
      expect(appTree.exists('e2e/cypress.config.ts')).toBe(true);
      expect(readJson(appTree, 'tsconfig.json').extends).toBeUndefined();
      const project = readProjectConfiguration(appTree, 'my-app');
      expect(project.targets.build.options['outputPath']).toBe('dist/my-app');
    });

    it('should generate playwright with root project', async () => {
      await generateApp(appTree, 'root-app', {
        e2eTestRunner: E2eTestRunner.Playwright,
        rootProject: true,
      });
      expect(appTree.exists('e2e/playwright.config.ts')).toBeTruthy();
      expect(appTree.exists('e2e/src/example.spec.ts')).toBeTruthy();
    });
  });

  describe('--minimal', () => {
    it('should skip "nx-welcome.component.ts" file and references for non-standalone apps without routing', async () => {
      await generateApp(appTree, 'plain', { minimal: true, routing: false });

      expect(
        appTree.exists('plain/src/app/nx-welcome.component.ts')
      ).toBeFalsy();
      expect(
        appTree.read('plain/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('plain/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('plain/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('plain/src/app/app.component.html', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should skip "nx-welcome.component.ts" file and references for non-standalone apps with routing', async () => {
      await generateApp(appTree, 'plain', { minimal: true });

      expect(
        appTree.exists('plain/src/app/nx-welcome.component.ts')
      ).toBeFalsy();
      expect(
        appTree.read('plain/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('plain/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('plain/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('plain/src/app/app.component.html', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should skip "nx-welcome.component.ts" file and references for standalone apps without routing', async () => {
      await generateApp(appTree, 'plain', {
        minimal: true,
        standalone: true,
        routing: false,
      });

      expect(
        appTree.exists('plain/src/app/nx-welcome.component.ts')
      ).toBeFalsy();
      expect(
        appTree.read('plain/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('plain/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('plain/src/app/app.component.html', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should skip "nx-welcome.component.ts" file and references for standalone apps with routing', async () => {
      await generateApp(appTree, 'plain', {
        minimal: true,
        standalone: true,
      });

      expect(
        appTree.exists('plain/src/app/nx-welcome.component.ts')
      ).toBeFalsy();
      expect(
        appTree.read('plain/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('plain/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('plain/src/app/app.component.html', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a correct build target for --bundler=esbuild', async () => {
      await generateApp(appTree, 'ngesbuild', {
        bundler: 'esbuild',
      });

      const project = readProjectConfiguration(appTree, 'ngesbuild');
      expect(project.targets.build.executor).toEqual(
        '@angular-devkit/build-angular:application'
      );
      expect(
        project.targets.build.configurations.development.buildOptimizer
      ).toBeUndefined();
      expect(
        project.targets.build.configurations.development.namedChunks
      ).toBeUndefined();
      expect(
        project.targets.build.configurations.development.vendorChunks
      ).toBeUndefined();
      expect(project.targets.build.configurations.production.budgets)
        .toMatchInlineSnapshot(`
        [
          {
            "maximumError": "1mb",
            "maximumWarning": "500kb",
            "type": "initial",
          },
          {
            "maximumError": "4kb",
            "maximumWarning": "2kb",
            "type": "anyComponentStyle",
          },
        ]
      `);
    });

    it('should generate a correct build target for --bundler=webpack', async () => {
      await generateApp(appTree, 'app1', {
        bundler: 'webpack',
      });

      const project = readProjectConfiguration(appTree, 'app1');
      expect(project.targets.build.executor).toEqual(
        '@angular-devkit/build-angular:browser'
      );
      expect(
        project.targets.build.configurations.development.buildOptimizer
      ).toBe(false);
      expect(project.targets.build.configurations.development.namedChunks).toBe(
        true
      );
      expect(project.targets.build.configurations.development.vendorChunk).toBe(
        true
      );
      expect(project.targets.build.configurations.production.budgets)
        .toMatchInlineSnapshot(`
        [
          {
            "maximumError": "1mb",
            "maximumWarning": "500kb",
            "type": "initial",
          },
          {
            "maximumError": "4kb",
            "maximumWarning": "2kb",
            "type": "anyComponentStyle",
          },
        ]
      `);
    });

    it('should generate target options "browser" and "buildTarget"', async () => {
      await generateApp(appTree, 'my-app', { standalone: true });

      const project = readProjectConfiguration(appTree, 'my-app');
      expect(project.targets.build.options.browser).toBeDefined();
      expect(
        project.targets.serve.configurations.development.buildTarget
      ).toBeDefined();
    });
  });

  describe('--ssr', () => {
    it('should generate with ssr set up', async () => {
      await generateApp(appTree, 'app1', { ssr: true });

      expect(appTree.exists('app1/src/main.server.ts')).toBe(true);
      expect(appTree.exists('app1/server.ts')).toBe(true);
    });
  });

  describe('--project-name-and-root-format=derived', () => {
    it('should generate correctly when no directory is provided', async () => {
      await generateApp(appTree, 'myApp', {
        projectNameAndRootFormat: 'derived',
      });

      expect(readProjectConfiguration(appTree, 'my-app')).toMatchSnapshot();
      expect(readProjectConfiguration(appTree, 'my-app-e2e')).toMatchSnapshot();
      expect(appTree.exists('apps/my-app/jest.config.ts')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/main.ts')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/app.module.ts')).toBeTruthy();
      expect(
        appTree.exists('apps/my-app/src/app/app.component.ts')
      ).toBeTruthy();
      expect(
        appTree.read('apps/my-app/src/app/app.module.ts', 'utf-8')
      ).toContain('class AppModule');
      expect(readJson(appTree, 'apps/my-app/tsconfig.json')).toMatchSnapshot(
        'tsconfig.json'
      );
      const tsconfigApp = parseJson(
        appTree.read('apps/my-app/tsconfig.app.json', 'utf-8')
      );
      expect(tsconfigApp).toMatchSnapshot('tsconfig.app.json');
      const eslintrcJson = parseJson(
        appTree.read('apps/my-app/.eslintrc.json', 'utf-8')
      );
      expect(eslintrcJson.extends).toEqual(['../../.eslintrc.json']);
      expect(appTree.exists('apps/my-app-e2e/cypress.config.ts')).toBeTruthy();
      const tsconfigE2E = parseJson(
        appTree.read('apps/my-app-e2e/tsconfig.json', 'utf-8')
      );
      expect(tsconfigE2E).toMatchSnapshot('e2e tsconfig.json');
    });

    it('should generate correctly when directory is provided', async () => {
      await generateApp(appTree, 'myApp', {
        directory: 'myDir',
        projectNameAndRootFormat: 'derived',
      });

      expect(
        readProjectConfiguration(appTree, 'my-dir-my-app')
      ).toMatchSnapshot();
      expect(
        readProjectConfiguration(appTree, 'my-dir-my-app-e2e')
      ).toMatchSnapshot();
      expect(appTree.exists('apps/my-dir/my-app/jest.config.ts')).toBeTruthy();
      expect(appTree.exists('apps/my-dir/my-app/src/main.ts')).toBeTruthy();
      expect(
        appTree.exists('apps/my-dir/my-app/src/app/app.module.ts')
      ).toBeTruthy();
      expect(
        appTree.exists('apps/my-dir/my-app/src/app/app.component.ts')
      ).toBeTruthy();
      expect(
        appTree.read('apps/my-dir/my-app/src/app/app.module.ts', 'utf-8')
      ).toContain('class AppModule');
      expect(
        readJson(appTree, 'apps/my-dir/my-app/tsconfig.json')
      ).toMatchSnapshot('tsconfig.json');
      const tsconfigApp = parseJson(
        appTree.read('apps/my-dir/my-app/tsconfig.app.json', 'utf-8')
      );
      expect(tsconfigApp).toMatchSnapshot('tsconfig.app.json');
      const eslintrcJson = parseJson(
        appTree.read('apps/my-dir/my-app/.eslintrc.json', 'utf-8')
      );
      expect(eslintrcJson.extends).toEqual(['../../../.eslintrc.json']);
      expect(
        appTree.exists('apps/my-dir/my-app-e2e/cypress.config.ts')
      ).toBeTruthy();
      const tsconfigE2E = parseJson(
        appTree.read('apps/my-dir/my-app-e2e/tsconfig.json', 'utf-8')
      );
      expect(tsconfigE2E).toMatchSnapshot('e2e tsconfig.json');
    });
  });

  describe('angular compat support', () => {
    beforeEach(() => {
      appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      updateJson(appTree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/core': '~16.2.0',
        },
      }));
    });

    it('should add angular peer dependencies when not installed', async () => {
      await generateApp(appTree, 'my-app');

      const { devDependencies } = readJson(appTree, 'package.json');
      expect(devDependencies['@angular-devkit/build-angular']).toEqual(
        backwardCompatibleVersions.angularV16.angularDevkitVersion
      );
      expect(devDependencies['@angular-devkit/schematics']).toEqual(
        backwardCompatibleVersions.angularV16.angularDevkitVersion
      );
      expect(devDependencies['@schematics/angular']).toEqual(
        backwardCompatibleVersions.angularV16.angularDevkitVersion
      );
    });

    it('should import "ApplicationConfig" from "@angular/platform-browser"', async () => {
      await generateApp(appTree, 'my-app', { standalone: true });

      expect(
        appTree.read('my-app/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should use "@angular-devkit/build-angular:browser-esbuild" for --bundler=esbuild', async () => {
      await generateApp(appTree, 'my-app', {
        standalone: true,
        bundler: 'esbuild',
      });

      const project = readProjectConfiguration(appTree, 'my-app');
      expect(project.targets.build.executor).toEqual(
        '@angular-devkit/build-angular:browser-esbuild'
      );
    });

    it('should generate target options "main" and "browserTarget"', async () => {
      await generateApp(appTree, 'my-app', { standalone: true });

      const project = readProjectConfiguration(appTree, 'my-app');
      expect(project.targets.build.options.main).toBeDefined();
      expect(
        project.targets.serve.configurations.development.browserTarget
      ).toBeDefined();
    });

    it('should not set esModuleInterop when using the browser-esbuild builder', async () => {
      await generateApp(appTree, 'my-app', { bundler: 'esbuild' });

      expect(
        readJson(appTree, 'my-app/tsconfig.json').compilerOptions
          .esModuleInterop
      ).toBeUndefined();
    });

    it('should not set esModuleInterop when using the browser builder', async () => {
      await generateApp(appTree, 'my-app', { bundler: 'webpack' });

      expect(
        readJson(appTree, 'my-app/tsconfig.json').compilerOptions
          .esModuleInterop
      ).toBeUndefined();
    });

    it('should configure the correct assets for versions lower than v18', async () => {
      updateJson(appTree, 'package.json', (json) => ({
        ...json,
        dependencies: { ...json.dependencies, '@angular/core': '~17.0.0' },
      }));

      await generateApp(appTree, 'my-app', { rootProject: true });

      const project = readProjectConfiguration(appTree, 'my-app');
      expect(project.targets.build.options.assets).toStrictEqual([
        './src/favicon.ico',
        './src/assets',
      ]);
    });
  });
});

async function generateApp(
  appTree: Tree,
  name: string = 'my-app',
  options: Partial<Schema> = {}
) {
  await generateTestApplication(appTree, {
    name,
    skipFormat: true,
    e2eTestRunner: E2eTestRunner.Cypress,
    unitTestRunner: UnitTestRunner.Jest,
    linter: Linter.EsLint,
    standalone: false,
    ...options,
  });
}
