import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readJson,
  readProjectConfiguration,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { applicationGenerator } from './application';

describe('app', () => {
  let tree: Tree;

  describe.each(['my-app', 'myApp'])(
    'generated files content - as-provided - %s',
    (name: string) => {
      describe('general application', () => {
        beforeEach(async () => {
          tree = createTreeWithEmptyWorkspace();
        });

        it('should not add targets', async () => {
          await applicationGenerator(tree, {
            directory: name,
            unitTestRunner: 'vitest',
          });

          const projectConfig = readProjectConfiguration(tree, name);
          expect(projectConfig.targets.build).toBeUndefined();
          expect(projectConfig.targets.serve).toBeUndefined();
          expect(projectConfig.targets.test).toBeUndefined();
          expect(projectConfig.targets['build-static']).toBeUndefined();
          expect(projectConfig.targets['serve-static']).toBeUndefined();
        });

        it('should create all new files in the correct location', async () => {
          await applicationGenerator(tree, {
            directory: name,
            unitTestRunner: 'vitest',
          });

          const newFiles = tree.listChanges().map((change) => change.path);
          expect(newFiles).toMatchSnapshot();
        });

        it('should add nuxt entries in .gitignore', async () => {
          await applicationGenerator(tree, {
            directory: name,
            unitTestRunner: 'vitest',
          });

          expect(tree.read('.gitignore', 'utf-8')).toMatchSnapshot();
        });

        it('should configure nuxt correctly', async () => {
          await applicationGenerator(tree, {
            directory: name,
            unitTestRunner: 'vitest',
          });

          expect(
            tree.read(`${name}/nuxt.config.ts`, 'utf-8')
          ).toMatchSnapshot();
        });

        it('should configure eslint correctly (flat config ESM)', async () => {
          tree.write('eslint.config.mjs', 'export default {};');

          await applicationGenerator(tree, {
            directory: name,
            unitTestRunner: 'vitest',
          });

          expect(
            tree.read(`${name}/eslint.config.mjs`, 'utf-8')
          ).toMatchSnapshot();
        });

        it('should configure eslint correctly (flat config CJS)', async () => {
          tree.write('eslint.config.cjs', 'module.exports = {};');

          await applicationGenerator(tree, {
            directory: name,
            unitTestRunner: 'vitest',
          });

          expect(
            tree.read(`${name}/eslint.config.cjs`, 'utf-8')
          ).toMatchSnapshot();
        });

        it('should configure eslint correctly (eslintrc)', async () => {
          await applicationGenerator(tree, {
            directory: name,
            unitTestRunner: 'vitest',
          });

          expect(
            tree.read(`${name}/.eslintrc.json`, 'utf-8')
          ).toMatchSnapshot();
        });

        it('should configure vitest correctly', async () => {
          await applicationGenerator(tree, {
            directory: name,
            unitTestRunner: 'vitest',
          });

          expect(
            tree.read(`${name}/vitest.config.ts`, 'utf-8')
          ).toMatchSnapshot();
          expect(
            tree.read(`${name}/tsconfig.spec.json`, 'utf-8')
          ).toMatchSnapshot();
          expect(tree.read(`${name}/tsconfig.json`, 'utf-8')).toMatchSnapshot();
          const packageJson = readJson(tree, 'package.json');
          expect(packageJson.devDependencies['vitest']).toEqual('^3.0.0');
        });

        it('should configure tsconfig and project.json correctly', async () => {
          await applicationGenerator(tree, {
            directory: name,
            unitTestRunner: 'vitest',
          });

          expect(tree.read(`${name}/project.json`, 'utf-8')).toMatchSnapshot();
          expect(tree.read(`${name}/tsconfig.json`, 'utf-8')).toMatchSnapshot();
        });

        it('should add the nuxt and vitest plugins', async () => {
          await applicationGenerator(tree, {
            directory: name,
            unitTestRunner: 'vitest',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.plugins).toMatchObject([
            {
              plugin: '@nx/eslint/plugin',
              options: { targetName: 'lint' },
            },
            {
              plugin: '@nx/vite/plugin',
              options: { testTargetName: 'test' },
            },
            {
              plugin: '@nx/nuxt/plugin',
              options: { buildTargetName: 'build', serveTargetName: 'serve' },
            },
            {
              plugin: '@nx/playwright/plugin',
              options: { targetName: 'e2e' },
            },
          ]);
          expect(
            nxJson.plugins.indexOf(
              nxJson.plugins.find((p) => p.plugin === '@nx/nuxt/plugin')
            )
          ).toBeGreaterThan(
            nxJson.plugins.indexOf(
              nxJson.plugins.find((p) => p.plugin === '@nx/vite/plugin')
            )
          );
          expect(nxJson.targetDefaults['e2e-ci--**/**']).toMatchSnapshot();
        });
      });

      describe('styles setup', () => {
        beforeAll(async () => {
          tree = createTreeWithEmptyWorkspace();
        });
        it('should configure css', async () => {
          await applicationGenerator(tree, {
            directory: 'myapp1',
            unitTestRunner: 'none',
            style: 'css',
          });
          expect(tree.exists('myapp1/src/assets/css/styles.css')).toBeTruthy();
          expect(tree.read('myapp1/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
        });

        it('should configure scss', async () => {
          await applicationGenerator(tree, {
            directory: 'myapp2',
            unitTestRunner: 'none',
            style: 'scss',
          });
          expect(tree.exists('myapp2/src/assets/css/styles.scss')).toBeTruthy();
          expect(tree.read('myapp2/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
        });

        it('should configure less', async () => {
          await applicationGenerator(tree, {
            directory: 'myapp3',
            unitTestRunner: 'none',
            style: 'less',
          });
          expect(tree.exists('myapp3/src/assets/css/styles.less')).toBeTruthy();
          expect(tree.read('myapp3/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
        });

        it('should not configure styles', async () => {
          await applicationGenerator(tree, {
            directory: 'myapp4',
            unitTestRunner: 'none',
            style: 'none',
          });
          expect(tree.exists('myapp4/src/assets/css/styles.css')).toBeFalsy();
          expect(tree.read('myapp4/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
        });
      });
    }
  );

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should add project references when using TS solution', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        e2eTestRunner: 'playwright',
        unitTestRunner: 'vitest',
        linter: 'eslint',
        useProjectJson: false,
      });

      expect(tree.read('myapp/vite.config.ts', 'utf-8')).toMatchInlineSnapshot(
        `null`
      );
      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./myapp-e2e",
          },
          {
            "path": "./myapp",
          },
        ]
      `);
      const packageJson = readJson(tree, 'myapp/package.json');
      expect(packageJson.name).toBe('@proj/myapp');
      expect(packageJson.nx).toBeUndefined();
      // Make sure keys are in idiomatic order
      expect(Object.keys(packageJson)).toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "private",
        ]
      `);
      expect(readJson(tree, 'myapp/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.base.json",
          "files": [],
          "references": [
            {
              "path": "./tsconfig.app.json",
            },
            {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);
      expect(readJson(tree, 'myapp/tsconfig.app.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "preserve",
            "jsxImportSource": "vue",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "dist",
            "resolveJsonModule": true,
            "rootDir": "src",
            "tsBuildInfoFile": "dist/tsconfig.app.tsbuildinfo",
          },
          "exclude": [
            "out-tsc",
            "dist",
            "vite.config.ts",
            "vite.config.mts",
            "vitest.config.ts",
            "vitest.config.mts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "eslint.config.js",
            "eslint.config.cjs",
            "eslint.config.mjs",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            ".nuxt/nuxt.d.ts",
            "src/**/*",
          ],
        }
      `);
      expect(readJson(tree, 'myapp/tsconfig.spec.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "preserve",
            "jsxImportSource": "vue",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "./out-tsc/vitest",
            "resolveJsonModule": true,
            "types": [
              "vitest/globals",
              "vitest/importMeta",
              "vite/client",
              "node",
              "vitest",
            ],
          },
          "extends": "../tsconfig.base.json",
          "include": [
            ".nuxt/nuxt.d.ts",
            "vite.config.ts",
            "vite.config.mts",
            "vitest.config.ts",
            "vitest.config.mts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "src/**/*.d.ts",
          ],
          "references": [
            {
              "path": "./tsconfig.app.json",
            },
          ],
        }
      `);
      expect(readJson(tree, 'myapp-e2e/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "allowJs": true,
            "outDir": "out-tsc/playwright",
            "sourceMap": false,
          },
          "exclude": [
            "out-tsc",
            "test-output",
            "eslint.config.js",
            "eslint.config.mjs",
            "eslint.config.cjs",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            "**/*.ts",
            "**/*.js",
            "playwright.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.spec.js",
            "src/**/*.test.ts",
            "src/**/*.test.js",
            "src/**/*.d.ts",
          ],
        }
      `);
    });

    it('should respect the provided name', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        name: 'myapp',
        e2eTestRunner: 'playwright',
        unitTestRunner: 'vitest',
        linter: 'eslint',
        useProjectJson: false,
      });

      const packageJson = readJson(tree, 'myapp/package.json');
      expect(packageJson.name).toBe('@proj/myapp');
      expect(packageJson.nx.name).toBe('myapp');
      // Make sure keys are in idiomatic order
      expect(Object.keys(packageJson)).toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "private",
          "nx",
        ]
      `);
    });

    it('should generate project.json if useProjectJson is true', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        e2eTestRunner: 'playwright',
        unitTestRunner: 'vitest',
        linter: 'eslint',
        useProjectJson: true,
        skipFormat: true,
      });

      expect(tree.exists('myapp/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, '@proj/myapp'))
        .toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "name": "@proj/myapp",
          "projectType": "application",
          "root": "myapp",
          "sourceRoot": "myapp/src",
          "targets": {},
        }
      `);
      expect(readJson(tree, 'myapp/package.json').nx).toBeUndefined();
      expect(tree.exists('myapp-e2e/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, '@proj/myapp-e2e'))
        .toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "implicitDependencies": [
            "@proj/myapp",
          ],
          "name": "@proj/myapp-e2e",
          "projectType": "application",
          "root": "myapp-e2e",
          "sourceRoot": "myapp-e2e/src",
          "targets": {},
        }
      `);
      expect(readJson(tree, 'myapp-e2e/package.json').nx).toBeUndefined();
    });
  });
});
