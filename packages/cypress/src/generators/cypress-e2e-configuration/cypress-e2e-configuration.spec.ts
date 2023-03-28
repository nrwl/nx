import {
  addProjectConfiguration,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { cypressE2EConfigurationGenerator } from './cypress-e2e-configuration';

import { installedCypressVersion } from '../../utils/cypress-version';

jest.mock('../../utils/cypress-version');
describe('Cypress e2e configuration', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('v10+', () => {
    beforeAll(() => {
      mockedInstalledCypressVersion.mockReturnValue(10);
    });

    it('should add e2e target to existing app', async () => {
      addProject(tree, { name: 'my-app', type: 'apps' });

      await cypressE2EConfigurationGenerator(tree, {
        project: 'my-app',
      });
      expect(tree.read('apps/my-app/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { defineConfig } from 'cypress';
        import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

        export default defineConfig({
          e2e: nxE2EPreset(__dirname, {
            cypressDir: 'src',
          }),
        });
        "
      `);
      expect(readProjectConfiguration(tree, 'my-app').targets.e2e)
        .toMatchInlineSnapshot(`
        Object {
          "configurations": Object {
            "production": Object {
              "devServerTarget": "my-app:serve:production",
            },
          },
          "executor": "@nrwl/cypress:cypress",
          "options": Object {
            "cypressConfig": "apps/my-app/cypress.config.ts",
            "devServerTarget": "my-app:serve",
            "testingType": "e2e",
          },
        }
      `);

      expect(readJson(tree, 'apps/my-app/tsconfig.json'))
        .toMatchInlineSnapshot(`
        Object {
          "compilerOptions": Object {
            "allowJs": true,
            "outDir": "../../dist/out-tsc",
            "sourceMap": false,
            "types": Array [
              "cypress",
              "node",
            ],
          },
          "extends": "../../tsconfig.base.json",
          "include": Array [
            "src/**/*.ts",
            "src/**/*.js",
            "cypress.config.ts",
          ],
        }
      `);
      assertCypressFiles(tree, 'apps/my-app/src');
    });

    it('should add e2e target to existing lib', async () => {
      addProject(tree, { name: 'my-lib', type: 'libs' });
      addProject(tree, { name: 'my-app', type: 'apps' });
      await cypressE2EConfigurationGenerator(tree, {
        project: 'my-lib',
        directory: 'cypress',
        devServerTarget: 'my-app:serve',
      });
      expect(tree.read('libs/my-lib/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { defineConfig } from 'cypress';
        import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

        export default defineConfig({
          e2e: nxE2EPreset(__dirname, {
            cypressDir: 'cypress',
          }),
        });
        "
      `);
      assertCypressFiles(tree, 'libs/my-lib/cypress');
    });

    it('should use --baseUrl', async () => {
      addProject(tree, { name: 'my-app', type: 'apps' });
      await cypressE2EConfigurationGenerator(tree, {
        project: 'my-app',
        baseUrl: 'http://localhost:4200',
      });
      assertCypressFiles(tree, 'apps/my-app/src');
      expect(
        readProjectConfiguration(tree, 'my-app').targets.e2e.options.baseUrl
      ).toEqual('http://localhost:4200');
    });

    it('should not overwrite existing e2e target', async () => {
      addProject(tree, { name: 'my-app', type: 'apps' });
      const pc = readProjectConfiguration(tree, 'my-app');
      pc.targets.e2e = {};
      updateProjectConfiguration(tree, 'my-app', pc);
      await expect(async () => {
        await cypressE2EConfigurationGenerator(tree, {
          project: 'my-app',
        });
      }).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Project my-app already has an e2e target.
        Rename or remove the existing e2e target."
      `);
    });

    it('should customize directory name', async () => {
      addProject(tree, { name: 'my-app', type: 'apps' });
      tree.write(
        'apps/my-app/tsconfig.json',
        JSON.stringify(
          {
            compilerOptions: {
              target: 'es2022',
              useDefineForClassFields: false,
              forceConsistentCasingInFileNames: true,
              strict: true,
              noImplicitOverride: true,
              noPropertyAccessFromIndexSignature: true,
              noImplicitReturns: true,
              noFallthroughCasesInSwitch: true,
            },
            files: [],
            include: [],
            references: [
              {
                path: './tsconfig.app.json',
              },
              {
                path: './tsconfig.spec.json',
              },
              {
                path: './tsconfig.editor.json',
              },
            ],
            extends: '../../tsconfig.base.json',
            angularCompilerOptions: {
              enableI18nLegacyMessageIdFormat: false,
              strictInjectionParameters: true,
              strictInputAccessModifiers: true,
              strictTemplates: true,
            },
          },
          null,
          2
        )
      );
      await cypressE2EConfigurationGenerator(tree, {
        project: 'my-app',
        directory: 'e2e/something',
      });
      assertCypressFiles(tree, 'apps/my-app/e2e/something');
      expect(readJson(tree, 'apps/my-app/tsconfig.cy.json'))
        .toMatchInlineSnapshot(`
        Object {
          "compilerOptions": Object {
            "allowJs": true,
            "outDir": "../../dist/out-tsc",
            "sourceMap": false,
            "types": Array [
              "cypress",
              "node",
            ],
          },
          "extends": "./tsconfig.json",
          "include": Array [
            "e2e/something/**/*.ts",
            "e2e/something/**/*.js",
            "cypress.config.ts",
          ],
        }
      `);
      expect(readJson(tree, 'apps/my-app/tsconfig.json').references).toEqual(
        expect.arrayContaining([{ path: './tsconfig.cy.json' }])
      );
    });

    it('should use js instead of ts files with --js', async () => {
      addProject(tree, { name: 'my-lib', type: 'libs' });
      await cypressE2EConfigurationGenerator(tree, {
        project: 'my-lib',
        directory: 'src/e2e',
        js: true,
        baseUrl: 'http://localhost:4200',
      });
      assertCypressFiles(tree, 'libs/my-lib/src/e2e', 'js');
    });

    it('should not override eslint settings if preset', async () => {
      addProject(tree, { name: 'my-lib', type: 'libs' });
      const ngEsLintContents = {
        extends: ['../../.eslintrc.json'],
        ignorePatterns: ['!**/*'],
        overrides: [
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                {
                  type: 'attribute',
                  prefix: 'cyPortTest',
                  style: 'camelCase',
                },
              ],
              '@angular-eslint/component-selector': [
                'error',
                {
                  type: 'element',
                  prefix: 'cy-port-test',
                  style: 'kebab-case',
                },
              ],
            },
            extends: [
              'plugin:@nrwl/nx/angular',
              'plugin:@angular-eslint/template/process-inline-templates',
            ],
          },
          {
            files: ['*.html'],
            extends: ['plugin:@nrwl/nx/angular-template'],
            rules: {},
          },
        ],
      };
      tree.write(
        'libs/my-lib/.eslintrc.json',
        JSON.stringify(ngEsLintContents, null, 2)
      );

      await cypressE2EConfigurationGenerator(tree, {
        project: 'my-lib',
        directory: 'cypress',
        baseUrl: 'http://localhost:4200',
      });
      expect(readJson(tree, 'libs/my-lib/.eslintrc.json')).toMatchSnapshot();
    });

    it('should add serve-static target to CI configuration', async () => {
      addProject(tree, { name: 'my-lib', type: 'libs' });
      addProject(tree, { name: 'my-app', type: 'apps' });
      const pc = readProjectConfiguration(tree, 'my-app');
      pc.targets['serve-static'] = {
        executor: 'some-file-server',
      };

      updateProjectConfiguration(tree, 'my-lib', pc);
      await cypressE2EConfigurationGenerator(tree, {
        project: 'my-lib',
        devServerTarget: 'my-app:serve',
        directory: 'cypress',
      });
      assertCypressFiles(tree, 'libs/my-lib/cypress');
      expect(
        readProjectConfiguration(tree, 'my-lib').targets['e2e'].configurations
          .ci
      ).toMatchInlineSnapshot(`
        Object {
          "devServerTarget": "my-app:serve-static",
        }
      `);
    });

    it('should set --port', async () => {
      addProject(tree, { name: 'my-app', type: 'apps' });
      await cypressE2EConfigurationGenerator(tree, {
        project: 'my-app',
        port: 0,
      });

      expect(readProjectConfiguration(tree, 'my-app').targets['e2e'].options)
        .toMatchInlineSnapshot(`
        Object {
          "cypressConfig": "apps/my-app/cypress.config.ts",
          "devServerTarget": "my-app:serve",
          "port": 0,
          "testingType": "e2e",
        }
      `);
    });

    it('should throw if cypress config already exists', async () => {
      addProject(tree, { name: 'my-lib', type: 'libs' });
      tree.write('libs/my-lib/cypress.config.ts', 'some content');
      await expect(async () => {
        await cypressE2EConfigurationGenerator(tree, {
          project: 'my-lib',
          baseUrl: 'http://localhost:4200',
        });
      }).rejects.toThrowErrorMatchingInlineSnapshot(`
        "The project, my-lib, already has a 'cypress.config.ts' file.
        This means that Cypress is already setup in this project.
        If you want to re-add Cypress to this project, remove the 'libs/my-lib/cypress.config.ts' file and try again."
      `);
    });
    it('should not overwrite --directory', async () => {
      addProject(tree, { name: 'my-lib', type: 'libs' });
      tree.write('libs/my-lib/cypress.config.ts', 'some content');
      tree.write('libs/my-lib/cypress/e2e/app.cy.ts', 'some content');
      await expect(async () => {
        await cypressE2EConfigurationGenerator(tree, {
          project: 'my-lib',
          baseUrl: 'http://localhost:4200',
          directory: 'cypress',
        });
      }).rejects.toThrowErrorMatchingInlineSnapshot(`
        "The project, my-lib, already has a 'cypress' directory.
        This most likely means you already have Cypress setup in this project.
        Make sure Cypress is not already setup in this project and try again."
      `);
    });
  });
});

function addProject(
  tree: Tree,
  opts: { name: string; standalone?: boolean; type: 'apps' | 'libs' }
) {
  const config: ProjectConfiguration = {
    name: opts.name,
    root: `${opts.type}/${opts.name}`,
    sourceRoot: `${opts.type}/${opts.name}`,
    targets: {
      serve: opts.type === 'apps' ? {} : undefined,
    },
  };

  addProjectConfiguration(tree, opts.name, config);
}

function assertCypressFiles(tree: Tree, basePath: string, ext = 'ts') {
  expect(tree.exists(`${basePath}/fixtures/example.json`)).toBeTruthy();
  expect(tree.exists(`${basePath}/support/e2e.${ext}`)).toBeTruthy();
  expect(tree.exists(`${basePath}/support/commands.${ext}`)).toBeTruthy();
  expect(tree.exists(`${basePath}/support/app.po.${ext}`)).toBeTruthy();
  expect(tree.exists(`${basePath}/e2e/app.cy.${ext}`)).toBeTruthy();
}
