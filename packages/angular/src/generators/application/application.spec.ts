import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import {
  NxJsonConfiguration,
  parseJson,
  readJson,
  readProjectConfiguration,
  updateJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import { applicationGenerator } from './application';
import type { Schema } from './schema';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      // ACT
      await generateApp(appTree);

      // ASSERT
      const workspaceJson = readJson(appTree, '/workspace.json');

      expect(workspaceJson.projects['my-app']).toMatchSnapshot();
      expect(workspaceJson.projects['my-app-e2e']).toMatchSnapshot();
    });

    it('should remove the e2e target on the application', async () => {
      // ACT
      await generateApp(appTree);

      // ASSERT
      const workspaceJson = readJson(appTree, '/workspace.json');
      expect(workspaceJson.projects['my-app'].architect.e2e).not.toBeDefined();
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

      expect(appTree.exists(`apps/my-app/jest.config.js`)).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/main.ts')).toBeTruthy();
      expect(appTree.exists('apps/my-app/src/app/app.module.ts')).toBeTruthy();
      expect(
        appTree.exists('apps/my-app/src/app/app.component.ts')
      ).toBeTruthy();
      expect(
        appTree.read('apps/my-app/src/app/app.module.ts', 'utf-8')
      ).toContain('class AppModule');

      const tsconfig = readJson(appTree, 'apps/my-app/tsconfig.json');
      expect(tsconfig.references).toContainEqual({
        path: './tsconfig.app.json',
      });
      expect(tsconfig.references).toContainEqual({
        path: './tsconfig.spec.json',
      });
      expect(tsconfig.references).toContainEqual({
        path: './tsconfig.editor.json',
      });

      const tsconfigApp = parseJson(
        appTree.read('apps/my-app/tsconfig.app.json', 'utf-8')
      );
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../../dist/out-tsc');
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');

      const eslintrcJson = parseJson(
        appTree.read('apps/my-app/.eslintrc.json', 'utf-8')
      );
      expect(eslintrcJson.extends).toEqual(['../../.eslintrc.json']);

      expect(appTree.exists('apps/my-app-e2e/cypress.json')).toBeTruthy();
      const tsconfigE2E = parseJson(
        appTree.read('apps/my-app-e2e/tsconfig.json', 'utf-8')
      );
      expect(tsconfigE2E).toMatchSnapshot();
    });

    it('should setup jest with serializers', async () => {
      await generateApp(appTree);

      expect(appTree.read('apps/my-app/jest.config.js', 'utf-8')).toContain(
        `'jest-preset-angular/build/serializers/no-ng-attributes'`
      );
      expect(appTree.read('apps/my-app/jest.config.js', 'utf-8')).toContain(
        `'jest-preset-angular/build/serializers/ng-snapshot'`
      );
      expect(appTree.read('apps/my-app/jest.config.js', 'utf-8')).toContain(
        `'jest-preset-angular/build/serializers/html-comment'`
      );
    });

    it('should default the prefix to npmScope', async () => {
      // Testing without prefix
      await generateApp(appTree, 'myApp', {
        e2eTestRunner: E2eTestRunner.Protractor,
      });

      const appE2eSpec = appTree.read(
        'apps/my-app-e2e/src/app.e2e-spec.ts',
        'utf-8'
      );
      const workspaceJson = parseJson(appTree.read('workspace.json', 'utf-8'));
      const myAppPrefix = workspaceJson.projects['my-app'].prefix;

      expect(myAppPrefix).toEqual('proj');
      expect(appE2eSpec).toContain('Welcome to my-app!');
    });

    it('should set a new prefix and use it', async () => {
      // Testing WITH prefix
      await generateApp(appTree, 'myAppWithPrefix', {
        prefix: 'custom',
        e2eTestRunner: E2eTestRunner.Protractor,
      });

      const appE2eSpec = appTree.read(
        'apps/my-app-with-prefix-e2e/src/app.e2e-spec.ts',
        'utf-8'
      );
      const workspaceJson = parseJson(appTree.read('workspace.json', 'utf-8'));
      const myAppPrefix = workspaceJson.projects['my-app-with-prefix'].prefix;

      expect(myAppPrefix).toEqual('custom');
      expect(appE2eSpec).toContain('Welcome to my-app-with-prefix!');
    });

    // TODO: this should work
    // This has been carried over from the Angular Devkit Schematic
    // It seems like Jest is failing as it's trying to look for the
    // tsconfig in the incorrect place
    xit('should work if the new project root is changed', async () => {
      // ARRANGE
      updateJson(appTree, '/workspace.json', (json) => ({
        ...json,
        newProjectRoot: 'newProjectRoot',
      }));

      // ACT
      await generateApp(appTree);

      // ASSERT
      expect(appTree.exists('apps/my-app/src/main.ts')).toEqual(true);
      expect(appTree.exists('apps/my-app-e2e/protractor.conf.js')).toEqual(
        true
      );
    });

    it('should set projectType to application', async () => {
      await generateApp(appTree, 'app');
      const workspaceJson = readJson(appTree, '/workspace.json');
      expect(workspaceJson.projects['app'].projectType).toEqual('application');
    });
  });

  describe('nested', () => {
    it('should update workspace.json', async () => {
      await generateApp(appTree, 'myApp', { directory: 'myDir' });
      const workspaceJson = readJson(appTree, '/workspace.json');

      expect(workspaceJson.projects['my-dir-my-app']).toMatchSnapshot();
      expect(workspaceJson.projects['my-dir-my-app-e2e']).toMatchSnapshot();
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
        `apps/my-dir/my-app/jest.config.js`,
        'apps/my-dir/my-app/src/main.ts',
        'apps/my-dir/my-app/src/app/app.module.ts',
        'apps/my-dir/my-app/src/app/app.component.ts',
        'apps/my-dir/my-app-e2e/cypress.json',
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
          path: 'apps/my-dir/my-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['../../../.eslintrc.json'],
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
      ).toContain('Thank you for using and showing some ♥ for Nx.');
    });

    it("should update `template`'s property of AppComponent with Nx content", async () => {
      await generateApp(appTree, 'myApp', {
        directory: 'myDir',
        inlineTemplate: true,
      });
      expect(
        appTree.read('apps/my-dir/my-app/src/app/app.component.ts', 'utf-8')
      ).toContain('Thank you for using and showing some ♥ for Nx.');
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
      expect(testFileContent).toContain('Welcome to my-dir-my-app!');
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
      it('should add an architect target for lint', async () => {
        await generateApp(appTree, 'myApp', { linter: Linter.EsLint });
        const workspaceJson = readJson(appTree, 'workspace.json');
        expect(workspaceJson.projects['my-app'].architect.lint)
          .toMatchInlineSnapshot(`
          Object {
            "builder": "@nrwl/linter:eslint",
            "options": Object {
              "lintFilePatterns": Array [
                "apps/my-app/src/**/*.ts",
                "apps/my-app/src/**/*.html",
              ],
            },
          }
        `);
        expect(workspaceJson.projects['my-app-e2e'].architect.lint)
          .toMatchInlineSnapshot(`
          Object {
            "builder": "@nrwl/linter:eslint",
            "options": Object {
              "lintFilePatterns": Array [
                "apps/my-app-e2e/**/*.{js,ts}",
              ],
            },
            "outputs": Array [
              "{options.outputFile}",
            ],
          }
        `);
      });

      it('should add a lint target when e2e test runner is protractor', async () => {
        await generateApp(appTree, 'myApp', {
          linter: Linter.EsLint,
          e2eTestRunner: E2eTestRunner.Protractor,
        });
        const workspaceJson = readJson(appTree, 'workspace.json');
        expect(workspaceJson.projects['my-app'].architect.lint)
          .toMatchInlineSnapshot(`
          Object {
            "builder": "@nrwl/linter:eslint",
            "options": Object {
              "lintFilePatterns": Array [
                "apps/my-app/src/**/*.ts",
                "apps/my-app/src/**/*.html",
              ],
            },
          }
        `);
        expect(appTree.exists('apps/my-app-e2e/.eslintrc.json')).toBeTruthy();
        expect(workspaceJson.projects['my-app-e2e'].architect.lint)
          .toMatchInlineSnapshot(`
          Object {
            "builder": "@nrwl/linter:eslint",
            "options": Object {
              "lintFilePatterns": Array [
                "apps/my-app-e2e/**/*.ts",
              ],
            },
            "outputs": Array [
              "{options.outputFile}",
            ],
          }
        `);
      });

      it('should add valid eslint JSON configuration which extends from Nx presets', async () => {
        await generateApp(appTree, 'myApp', { linter: Linter.EsLint });

        const eslintConfig = readJson(appTree, 'apps/my-app/.eslintrc.json');
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
        await generateApp(appTree, 'myApp', { linter: Linter.None });
        const workspaceJson = readJson(appTree, 'workspace.json');
        expect(workspaceJson.projects['my-app'].architect.lint).toBeUndefined();
        expect(
          workspaceJson.projects['my-app-e2e'].architect.lint
        ).toBeUndefined();
      });

      it('should not add an architect target for lint when e2e test runner is protractor', async () => {
        await generateApp(appTree, 'myApp', {
          linter: Linter.None,
          e2eTestRunner: E2eTestRunner.Protractor,
        });
        const workspaceJson = readJson(appTree, 'workspace.json');
        expect(workspaceJson.projects['my-app'].architect.lint).toBeUndefined();
        expect(
          workspaceJson.projects['my-app-e2e'].architect.lint
        ).toBeUndefined();
      });
    });
  });

  describe('--unit-test-runner', () => {
    describe('default (jest)', () => {
      it('should generate jest.config.js with serializers', async () => {
        await generateApp(appTree);

        const jestConfig = appTree.read('apps/my-app/jest.config.js', 'utf-8');

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
    });

    describe('karma', () => {
      it('should generate a karma config', async () => {
        await generateApp(appTree, 'myApp', {
          unitTestRunner: UnitTestRunner.Karma,
        });

        expect(appTree.exists('apps/my-app/tsconfig.spec.json')).toBeTruthy();
        expect(appTree.exists('apps/my-app/karma.conf.js')).toBeTruthy();
        const workspaceJson = readJson(appTree, 'workspace.json');
        expect(workspaceJson.projects['my-app'].architect.test.builder).toEqual(
          '@angular-devkit/build-angular:karma'
        );
        const tsconfigAppJson = readJson(
          appTree,
          'apps/my-app/tsconfig.app.json'
        );
        expect(tsconfigAppJson.compilerOptions.outDir).toEqual(
          '../../dist/out-tsc'
        );
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
        expect(appTree.exists('apps/my-app/jest.config.js')).toBeFalsy();
        expect(appTree.exists('apps/my-app/karma.config.js')).toBeFalsy();
        expect(
          appTree.exists('apps/my-app/src/app/app.component.spec.ts')
        ).toBeFalsy();
        const workspaceJson = readJson(appTree, 'workspace.json');
        expect(workspaceJson.projects['my-app'].architect.test).toBeUndefined();
      });
    });
  });

  describe('--e2e-test-runner', () => {
    describe(E2eTestRunner.Protractor, () => {
      it('should create the e2e project in v2 workspace', async () => {
        appTree = createTreeWithEmptyWorkspace(2);

        expect(
          () =>
            await generateApp(appTree, 'myApp', {
              e2eTestRunner: E2eTestRunner.Protractor,
              standaloneConfig: true,
            })
        ).not.toThrow();
      });

      it('should update workspace.json', async () => {
        await generateApp(appTree, 'myApp', {
          e2eTestRunner: E2eTestRunner.Protractor,
        });
        const workspaceJson = readJson(appTree, 'workspace.json');
        expect(
          workspaceJson.projects['my-app'].architect.e2e
        ).not.toBeDefined();
        expect(workspaceJson.projects['my-app-e2e']).toEqual({
          root: 'apps/my-app-e2e',
          projectType: 'application',
          architect: {
            e2e: {
              builder: '@angular-devkit/build-angular:protractor',
              options: {
                protractorConfig: 'apps/my-app-e2e/protractor.conf.js',
              },
              configurations: {
                development: {
                  devServerTarget: 'my-app:serve:development',
                },
                production: {
                  devServerTarget: 'my-app:serve:production',
                },
              },
              defaultConfiguration: 'development',
            },
            lint: {
              builder: '@nrwl/linter:eslint',
              outputs: ['{options.outputFile}'],
              options: {
                lintFilePatterns: ['apps/my-app-e2e/**/*.ts'],
              },
            },
          },
          implicitDependencies: ['my-app'],
          tags: [],
        });
      });

      it('should update E2E spec files to match the app name', async () => {
        await generateApp(appTree, 'myApp', {
          e2eTestRunner: E2eTestRunner.Protractor,
        });

        expect(
          appTree.read('apps/my-app-e2e/src/app.e2e-spec.ts', 'utf-8')
        ).toContain(`'Welcome to my-app!'`);
        expect(
          appTree.read('apps/my-app-e2e/src/app.po.ts', 'utf-8')
        ).toContain(`'proj-root header h1'`);
      });

      it('should update E2E spec files to match the app name when generating within a directory', async () => {
        await generateApp(appTree, 'myApp', {
          e2eTestRunner: E2eTestRunner.Protractor,
          directory: 'my-directory',
        });

        expect(
          appTree.read(
            'apps/my-directory/my-app-e2e/src/app.e2e-spec.ts',
            'utf-8'
          )
        ).toContain(`'Welcome to my-directory-my-app!'`);
        expect(
          appTree.read('apps/my-directory/my-app-e2e/src/app.po.ts', 'utf-8')
        ).toContain(`'proj-root header h1'`);
      });
    });

    describe('none', () => {
      it('should not generate test configuration', async () => {
        await generateApp(appTree, 'myApp', {
          e2eTestRunner: E2eTestRunner.None,
        });
        expect(appTree.exists('apps/my-app-e2e')).toBeFalsy();
        const workspaceJson = readJson(appTree, 'workspace.json');
        expect(workspaceJson.projects['my-app-e2e']).toBeUndefined();
      });
    });
  });

  describe('replaceAppNameWithPath', () => {
    it('should protect `workspace.json` commands and properties', async () => {
      await generateApp(appTree, 'ui');
      const workspaceJson = readJson(appTree, 'workspace.json');
      expect(workspaceJson.projects['ui']).toBeDefined();
      expect(
        workspaceJson.projects['ui']['architect']['build']['builder']
      ).toEqual('@angular-devkit/build-angular:browser');
    });

    it('should protect `workspace.json` sensible properties value to be renamed', async () => {
      await generateApp(appTree, 'ui', { prefix: 'ui' });
      const workspaceJson = readJson(appTree, 'workspace.json');
      expect(workspaceJson.projects['ui'].prefix).toEqual('ui');
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

      // define all the tsconfig files to update
      const configFiles = [
        'apps/my-app/tsconfig.json',
        'apps/my-app-e2e/tsconfig.json',
      ];

      for (const configFile of configFiles) {
        const { compilerOptions, angularCompilerOptions } = parseJson(
          appTree.read(configFile, 'utf-8')
        );

        // check that the TypeScript compiler options have been updated
        expect(compilerOptions.forceConsistentCasingInFileNames).toBe(true);
        expect(compilerOptions.strict).toBe(true);
        expect(compilerOptions.noImplicitReturns).toBe(true);
        expect(compilerOptions.noFallthroughCasesInSwitch).toBe(true);

        // check that the Angular Template options have been updated
        expect(angularCompilerOptions.strictInjectionParameters).toBe(true);
        expect(angularCompilerOptions.strictTemplates).toBe(true);
      }

      // should not update workspace configuration since --strict=true is the default
      const nxJson = readJson<NxJsonConfiguration>(appTree, 'nx.json');
      expect(
        nxJson.generators['@nrwl/angular:application'].strict
      ).not.toBeDefined();
    });

    it('should set defaults when --strict=false', async () => {
      await generateApp(appTree, 'my-app', { strict: false });

      // check to see if the workspace configuration has been updated to turn off
      // strict mode by default in future applications
      const nxJson = readJson<NxJsonConfiguration>(appTree, 'nx.json');
      expect(nxJson.generators['@nrwl/angular:application'].strict).toBe(false);
    });
  });

  describe('--mfe', () => {
    test.each(['host', 'remote'])(
      'should generate a Module Federation correctly for a each app',
      async (type: 'host' | 'remote') => {
        await generateApp(appTree, 'my-app', { mfe: true, mfeType: type });

        expect(appTree.exists(`apps/my-app/webpack.config.js`)).toBeTruthy();
        expect(
          appTree.exists(`apps/my-app/webpack.prod.config.js`)
        ).toBeTruthy();
        expect(
          appTree.read(`apps/my-app/webpack.config.js`, 'utf-8')
        ).toMatchSnapshot();
      }
    );

    test.each(['host', 'remote'])(
      'should update the builder to use webpack-browser',
      async (type: 'host' | 'remote') => {
        await generateApp(appTree, 'my-app', { mfe: true, mfeType: type });

        const projectConfig = readProjectConfiguration(appTree, 'my-app');

        expect(projectConfig.targets.build.executor).toEqual(
          '@nrwl/angular:webpack-browser'
        );
      }
    );

    it('should add a remote application and add it to a specified host applications webpack config when no other remote has been added to it', async () => {
      // ARRANGE
      await generateApp(appTree, 'app1', {
        mfe: true,
        mfeType: 'host',
      });

      // ACT
      await generateApp(appTree, 'remote1', {
        mfe: true,
        mfeType: 'remote',
        host: 'app1',
      });

      // ASSERT
      const hostWebpackConfig = appTree.read(
        'apps/app1/webpack.config.js',
        'utf-8'
      );
      expect(hostWebpackConfig).toMatchSnapshot();
    });

    it('should add a remote application and add it to a specified host applications webpack config that contains a remote application already', async () => {
      // ARRANGE
      await generateApp(appTree, 'app1', {
        mfe: true,
        mfeType: 'host',
      });

      await generateApp(appTree, 'remote1', {
        mfe: true,
        mfeType: 'remote',
        host: 'app1',
        port: 4201,
      });

      // ACT
      await generateApp(appTree, 'remote2', {
        mfe: true,
        mfeType: 'remote',
        host: 'app1',
        port: 4202,
      });

      // ASSERT
      const hostWebpackConfig = appTree.read(
        'apps/app1/webpack.config.js',
        'utf-8'
      );
      expect(hostWebpackConfig).toMatchSnapshot();
    });

    it('should add a port to a non-mfe app', async () => {
      // ACT
      await generateApp(appTree, 'app1', {
        port: 4205,
      });

      // ASSERT
      const projectConfig = readProjectConfiguration(appTree, 'app1');
      expect(projectConfig.targets.serve.options.port).toBe(4205);
    });
  });
});

async function generateApp(
  appTree: Tree,
  name: string = 'myApp',
  options: Partial<Schema> = {}
) {
  await applicationGenerator(appTree, {
    name,
    skipFormat: false,
    e2eTestRunner: E2eTestRunner.Cypress,
    unitTestRunner: UnitTestRunner.Jest,
    linter: Linter.EsLint,
    ...options,
  });
}
