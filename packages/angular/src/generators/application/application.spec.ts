import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import {
  NxJsonConfiguration,
  parseJson,
  readJson,
  readNxJson,
  readProjectConfiguration,
  stripIndents,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import * as enquirer from 'enquirer';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import {
  autoprefixerVersion,
  postcssVersion,
  tailwindVersion,
} from '../../utils/versions';
import { generateTestApplication } from '../utils/testing';
import type { Schema } from './schema';

// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');
jest.mock('enquirer');

describe('app', () => {
  let appTree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    // @ts-ignore
    enquirer.prompt = jest
      .fn()
      .mockReturnValue(Promise.resolve({ 'standalone-components': true }));
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
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
        appTree.exists('apps/my-app/src/app/app.component.spec.ts')
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
      await generateApp(appTree, 'myApp', { tags: 'one,two,my-app' });

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

      expect(appTree.exists(`apps/my-app/jest.config.ts`)).toBeTruthy();
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

    it('should setup jest with serializers', async () => {
      await generateApp(appTree);

      expect(appTree.read('apps/my-app/jest.config.ts', 'utf-8')).toContain(
        `'jest-preset-angular/build/serializers/no-ng-attributes'`
      );
      expect(appTree.read('apps/my-app/jest.config.ts', 'utf-8')).toContain(
        `'jest-preset-angular/build/serializers/ng-snapshot'`
      );
      expect(appTree.read('apps/my-app/jest.config.ts', 'utf-8')).toContain(
        `'jest-preset-angular/build/serializers/html-comment'`
      );
    });

    it('should support a root tsconfig.json instead of tsconfig.base.json', async () => {
      // ARRANGE
      appTree.rename('tsconfig.base.json', 'tsconfig.json');

      // ACT
      await generateApp(appTree, 'app');

      // ASSERT
      const appTsConfig = readJson(appTree, 'apps/app/tsconfig.json');
      expect(appTsConfig.extends).toBe('../../tsconfig.json');
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
  });

  describe('nested', () => {
    it('should create project configs', async () => {
      await generateApp(appTree, 'myApp', { directory: 'myDir' });
      expect(
        readProjectConfiguration(appTree, 'my-dir-my-app')
      ).toMatchSnapshot();
      expect(
        readProjectConfiguration(appTree, 'my-dir-my-app-e2e')
      ).toMatchSnapshot();
    });

    it('should update tags + implicit dependencies', async () => {
      await generateApp(appTree, 'myApp', {
        directory: 'myDir',
        tags: 'one,two,my-dir-my-app',
      });
      const projects = devkit.getProjects(appTree);
      expect(projects).toEqual(
        new Map(
          Object.entries({
            'my-dir-my-app': expect.objectContaining({
              tags: ['one', 'two', 'my-dir-my-app'],
            }),
            'my-dir-my-app-e2e': expect.objectContaining({
              implicitDependencies: ['my-dir-my-app'],
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
      await generateApp(appTree, 'myApp', { directory: 'myDir' });

      const appModulePath = 'apps/my-dir/my-app/src/app/app.module.ts';
      expect(appTree.read(appModulePath, 'utf-8')).toContain('class AppModule');

      // Make sure these exist
      [
        `apps/my-dir/my-app/jest.config.ts`,
        'apps/my-dir/my-app/src/main.ts',
        'apps/my-dir/my-app/src/app/app.module.ts',
        'apps/my-dir/my-app/src/app/app.component.ts',
        'apps/my-dir/my-app-e2e/cypress.config.ts',
      ].forEach((path) => {
        expect(appTree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'apps/my-dir/my-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc',
        },
        {
          path: 'apps/my-dir/my-app/tsconfig.app.json',
          lookupFn: (json) => json.exclude,
          expectedValue: [
            'jest.config.ts',
            'src/**/*.test.ts',
            'src/**/*.spec.ts',
          ],
        },
        {
          path: 'apps/my-dir/my-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['../../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });

    it('should extend from tsconfig.base.json', async () => {
      // ACT
      await generateApp(appTree, 'app', { directory: 'myDir' });

      // ASSERT
      const appTsConfig = readJson(appTree, 'apps/my-dir/app/tsconfig.json');
      expect(appTsConfig.extends).toBe('../../../tsconfig.base.json');
    });

    it('should support a root tsconfig.json instead of tsconfig.base.json', async () => {
      // ARRANGE
      appTree.rename('tsconfig.base.json', 'tsconfig.json');

      // ACT
      await generateApp(appTree, 'app', { directory: 'myDir' });

      // ASSERT
      const appTsConfig = readJson(appTree, 'apps/my-dir/app/tsconfig.json');
      expect(appTsConfig.extends).toBe('../../../tsconfig.json');
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
      await generateApp(appTree, 'myApp', { directory: 'src/9-websites' });

      // ASSERT

      expect(
        readProjectConfiguration(appTree, 'src-9-websites-my-app').root
      ).toMatchSnapshot();
    });

    it('should generate files', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const content = readJson(appTree, path);

        expect(lookupFn(content)).toEqual(expectedValue);
      };
      await generateApp(appTree, 'myApp', { directory: 'myDir' });

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
  });

  describe('routing', () => {
    it('should include RouterTestingModule', async () => {
      await generateApp(appTree, 'myApp', {
        directory: 'myDir',
        routing: true,
      });
      expect(
        appTree.read('apps/my-dir/my-app/src/app/app.module.ts', 'utf-8')
      ).toContain('RouterModule.forRoot');
      expect(
        appTree.read(
          'apps/my-dir/my-app/src/app/app.component.spec.ts',
          'utf-8'
        )
      ).toContain('imports: [RouterTestingModule]');
    });

    it('should not modify tests when --skip-tests is set', async () => {
      await generateApp(appTree, 'myApp', {
        directory: 'myDir',
        routing: true,
        skipTests: true,
      });
      expect(
        appTree.exists('apps/my-dir/my-app/src/app/app.component.spec.ts')
      ).toBeFalsy();
    });
  });

  describe('template generation mode', () => {
    it('should create Nx specific `app.component.html` template', async () => {
      await generateApp(appTree, 'myApp', { directory: 'myDir' });
      expect(
        appTree.read('apps/my-dir/my-app/src/app/app.component.html', 'utf-8')
      ).toContain('<proj-nx-welcome></proj-nx-welcome>');
    });

    it("should update `template`'s property of AppComponent with Nx content", async () => {
      await generateApp(appTree, 'myApp', {
        directory: 'myDir',
        inlineTemplate: true,
      });
      expect(
        appTree.read('apps/my-dir/my-app/src/app/app.component.ts', 'utf-8')
      ).toContain('<proj-nx-welcome></proj-nx-welcome>');
    });

    it('should create Nx specific `nx-welcome.component.ts` file', async () => {
      await generateApp(appTree, 'myApp', { directory: 'myDir' });
      expect(
        appTree.read(
          'apps/my-dir/my-app/src/app/nx-welcome.component.ts',
          'utf-8'
        )
      ).toContain('Hello there');
    });

    it('should update the AppComponent spec to target Nx content', async () => {
      await generateApp(appTree, 'myApp', {
        directory: 'myDir',
        inlineTemplate: true,
      });
      const testFileContent = appTree.read(
        'apps/my-dir/my-app/src/app/app.component.spec.ts',
        'utf-8'
      );

      expect(testFileContent).toContain(`querySelector('h1')`);
      expect(testFileContent).toContain('Welcome my-dir-my-app');
    });
  });

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      await generateApp(appTree, 'myApp', { style: 'scss' });
      expect(appTree.exists('apps/my-app/src/app/app.component.scss')).toEqual(
        true
      );
    });
  });

  describe('--style sass', () => {
    it('should generate sass styles', async () => {
      await generateApp(appTree, 'myApp', { style: 'sass' });
      expect(appTree.exists('apps/my-app/src/app/app.component.sass')).toEqual(
        true
      );
    });
  });

  describe('--style less', () => {
    it('should generate less styles', async () => {
      await generateApp(appTree, 'myApp', { style: 'less' });
      expect(appTree.exists('apps/my-app/src/app/app.component.less')).toEqual(
        true
      );
    });
  });

  describe('--skipFormat', () => {
    it('should format files by default', async () => {
      const spy = jest.spyOn(devkit, 'formatFiles');

      await generateApp(appTree);

      expect(spy).toHaveBeenCalled();
    });

    // Need a better way of determing if the formatFiles function
    // was called directly from the application generator
    // and not by a different generator that's used withing this
    xit('should skip format when set to true', async () => {
      const spy = jest.spyOn(devkit, 'formatFiles');

      await generateApp(appTree, 'myApp', { skipFormat: true });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('--linter', () => {
    describe('eslint', () => {
      it('should add lint taret', async () => {
        await generateApp(appTree, 'myApp', { linter: Linter.EsLint });
        expect(readProjectConfiguration(appTree, 'my-app').targets.lint)
          .toMatchInlineSnapshot(`
          {
            "executor": "@nx/linter:eslint",
            "options": {
              "lintFilePatterns": [
                "apps/my-app/**/*.ts",
                "apps/my-app/**/*.html",
              ],
            },
            "outputs": [
              "{options.outputFile}",
            ],
          }
        `);
        expect(readProjectConfiguration(appTree, 'my-app-e2e').targets.lint)
          .toMatchInlineSnapshot(`
          {
            "executor": "@nx/linter:eslint",
            "options": {
              "lintFilePatterns": [
                "apps/my-app-e2e/**/*.{js,ts}",
              ],
            },
            "outputs": [
              "{options.outputFile}",
            ],
          }
        `);
      });

      it('should add valid eslint JSON configuration which extends from Nx presets', async () => {
        await generateApp(appTree, 'myApp', { linter: Linter.EsLint });

        const eslintConfig = readJson(appTree, 'apps/my-app/.eslintrc.json');
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
      it('should add no lint target', async () => {
        await generateApp(appTree, 'myApp', { linter: Linter.None });
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

        const jestConfig = appTree.read('apps/my-app/jest.config.ts', 'utf-8');

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

        const { references } = readJson(appTree, 'apps/my-app/tsconfig.json');
        expect(
          references.find((r) => r.path.includes('tsconfig.spec.json'))
        ).toBeTruthy();
      });
    });

    describe('none', () => {
      it('should not generate test configuration', async () => {
        await generateApp(appTree, 'myApp', {
          unitTestRunner: UnitTestRunner.None,
        });
        expect(appTree.exists('apps/my-app/src/test-setup.ts')).toBeFalsy();
        expect(appTree.exists('apps/my-app/src/test.ts')).toBeFalsy();
        expect(appTree.exists('apps/my-app/tsconfig.spec.json')).toBeFalsy();
        expect(appTree.exists('apps/my-app/jest.config.ts')).toBeFalsy();
        expect(appTree.exists('apps/my-app/karma.config.js')).toBeFalsy();
        expect(
          appTree.exists('apps/my-app/src/app/app.component.spec.ts')
        ).toBeFalsy();
        expect(
          readProjectConfiguration(appTree, 'my-app').targets.test
        ).toBeUndefined();
        // check tsconfig.spec.json is not referenced
        const { references } = readJson(appTree, 'apps/my-app/tsconfig.json');
        expect(
          references.every((r) => !r.path.includes('tsconfig.spec.json'))
        ).toBe(true);
      });
    });
  });

  describe('--e2e-test-runner', () => {
    describe('none', () => {
      it('should not generate test configuration', async () => {
        await generateApp(appTree, 'myApp', {
          e2eTestRunner: E2eTestRunner.None,
        });
        expect(appTree.exists('apps/my-app-e2e')).toBeFalsy();
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

        expect(appTree.exists('apps/customer-ui/proxy.conf.json')).toBeTruthy();
        expect(
          appTree.read('apps/customer-ui/proxy.conf.json', 'utf-8')
        ).toContain(proxyConfContent);
      });
    });

    describe('with no backend project', () => {
      it('should not generate a proxy.conf.json', async () => {
        await generateApp(appTree, 'customer-ui');

        expect(appTree.exists('apps/customer-ui/proxy.conf.json')).toBeFalsy();
      });
    });
  });

  describe('--strict', () => {
    it('should enable strict type checking', async () => {
      await generateApp(appTree, 'my-app', { strict: true });

      const appTsConfig = readJson(appTree, 'apps/my-app/tsconfig.json');
      expect(appTsConfig).toMatchSnapshot('app tsconfig.json');
      const e2eTsConfig = readJson(appTree, 'apps/my-app-e2e/tsconfig.json');
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
      expect(appTree.exists('apps/app1/tailwind.config.js')).toBeFalsy();
      const { devDependencies } = readJson(appTree, 'package.json');
      expect(devDependencies['tailwindcss']).toBeUndefined();
      expect(devDependencies['postcss']).toBeUndefined();
      expect(devDependencies['autoprefixer']).toBeUndefined();
    });

    it('should not add a tailwind.config.js and relevant packages when "--add-tailwind=false"', async () => {
      // ACT
      await generateApp(appTree, 'app1', { addTailwind: false });

      // ASSERT
      expect(appTree.exists('apps/app1/tailwind.config.js')).toBeFalsy();
      const { devDependencies } = readJson(appTree, 'package.json');
      expect(devDependencies['tailwindcss']).toBeUndefined();
      expect(devDependencies['postcss']).toBeUndefined();
      expect(devDependencies['autoprefixer']).toBeUndefined();
    });

    it('should add a tailwind.config.js and relevant packages when "--add-tailwind=true"', async () => {
      // ACT
      await generateApp(appTree, 'app1', { addTailwind: true });

      // ASSERT
      expect(appTree.read('apps/app1/tailwind.config.js', 'utf-8'))
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
        routing: true,
      });

      // ASSERT
      expect(
        appTree.read('apps/standalone/src/main.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/standalone/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/standalone/src/app/app.routes.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/standalone/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/standalone/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.exists('apps/standalone/src/app/app.module.ts')
      ).toBeFalsy();
      expect(
        appTree.read('apps/standalone/src/app/nx-welcome.component.ts', 'utf-8')
      ).toContain('standalone: true');
    });

    it('should generate a standalone app correctly without routing', async () => {
      // ACT
      await generateApp(appTree, 'standalone', {
        standalone: true,
        routing: false,
      });

      // ASSERT
      expect(
        appTree.read('apps/standalone/src/main.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/standalone/src/app/app.config.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/standalone/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/standalone/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.exists('apps/standalone/src/app/app.module.ts')
      ).toBeFalsy();
      expect(
        appTree.read('apps/standalone/src/app/nx-welcome.component.ts', 'utf-8')
      ).toContain('standalone: true');
    });

    it('should prompt for standalone components and not use them when the user selects false', async () => {
      // ARRANGE
      process.env.NX_INTERACTIVE = 'true';
      // @ts-ignore
      enquirer.prompt = jest
        .fn()
        .mockReturnValue(Promise.resolve({ 'standalone-components': false }));

      // ACT
      await generateApp(appTree, 'nostandalone');

      // ASSERT
      expect(
        appTree.exists('apps/nostandalone/src/app/app.module.ts')
      ).toBeTruthy();
      expect(enquirer.prompt).toHaveBeenCalled();

      // CLEANUP
      process.env.NX_INTERACTIVE = undefined;
    });

    it('should prompt for standalone components and use them when the user selects true', async () => {
      // ARRANGE
      process.env.NX_INTERACTIVE = 'true';
      // @ts-ignore
      enquirer.prompt = jest
        .fn()
        .mockReturnValue(Promise.resolve({ 'standalone-components': true }));

      // ACT
      await generateApp(appTree, 'nostandalone');

      // ASSERT
      expect(
        appTree.exists('apps/nostandalone/src/app/app.module.ts')
      ).not.toBeTruthy();
      expect(enquirer.prompt).toHaveBeenCalled();

      // CLEANUP
      process.env.NX_INTERACTIVE = undefined;
    });
  });

  it('should generate correct main.ts', async () => {
    // ACT
    await generateApp(appTree, 'myapp');

    // ASSERT
    expect(appTree.read('apps/myapp/src/main.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
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
  });

  it('should error correctly when Angular version does not support standalone', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        '@angular/core': '14.0.0',
      },
    }));

    // ACT & ASSERT
    await expect(
      generateApp(tree, 'my-app', {
        standalone: true,
      })
    ).rejects
      .toThrow(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using 14.0.0.
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  });

  describe('--minimal', () => {
    it('should skip "nx-welcome.component.ts" file and references for non-standalone apps without routing', async () => {
      await generateApp(appTree, 'plain', { minimal: true });

      expect(
        appTree.exists('apps/plain/src/app/nx-welcome.component.ts')
      ).toBeFalsy();
      expect(
        appTree.read('apps/plain/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/plain/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/plain/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/plain/src/app/app.component.html', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should skip "nx-welcome.component.ts" file and references for non-standalone apps with routing', async () => {
      await generateApp(appTree, 'plain', { minimal: true, routing: true });

      expect(
        appTree.exists('apps/plain/src/app/nx-welcome.component.ts')
      ).toBeFalsy();
      expect(
        appTree.read('apps/plain/src/app/app.module.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/plain/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/plain/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/plain/src/app/app.component.html', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should skip "nx-welcome.component.ts" file and references for standalone apps without routing', async () => {
      await generateApp(appTree, 'plain', { minimal: true, standalone: true });

      expect(
        appTree.exists('apps/plain/src/app/nx-welcome.component.ts')
      ).toBeFalsy();
      expect(
        appTree.read('apps/plain/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/plain/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/plain/src/app/app.component.html', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should skip "nx-welcome.component.ts" file and references for standalone apps with routing', async () => {
      await generateApp(appTree, 'plain', {
        minimal: true,
        standalone: true,
        routing: true,
      });

      expect(
        appTree.exists('apps/plain/src/app/nx-welcome.component.ts')
      ).toBeFalsy();
      expect(
        appTree.read('apps/plain/src/app/app.component.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/plain/src/app/app.component.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        appTree.read('apps/plain/src/app/app.component.html', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a correct build target for --bundler=esbuild', async () => {
      await generateApp(appTree, 'ngesbuild', {
        routing: true,
        bundler: 'esbuild',
      });

      const project = readProjectConfiguration(appTree, 'ngesbuild');
      expect(project.targets.build.executor).toEqual(
        '@angular-devkit/build-angular:browser-esbuild'
      );
      expect(
        project.targets.build.configurations.development.namedChunks
      ).toBeUndefined();
      expect(
        project.targets.build.configurations.development.vendorChunks
      ).toBeUndefined();
      expect(
        project.targets.build.configurations.production.budgets
      ).toBeUndefined();
    });
  });
});

async function generateApp(
  appTree: Tree,
  name: string = 'myApp',
  options: Partial<Schema> = {}
) {
  await generateTestApplication(appTree, {
    name,
    skipFormat: false,
    e2eTestRunner: E2eTestRunner.Cypress,
    unitTestRunner: UnitTestRunner.Jest,
    linter: Linter.EsLint,
    ...options,
  });
}
