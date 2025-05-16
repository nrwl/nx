import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  type Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';

import * as devkitExports from 'nx/src/devkit-exports';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from './application.impl';
import { join } from 'path';
import { PackageManagerCommands } from 'nx/src/utils/package-manager';

describe('Remix Application', () => {
  beforeEach(() => {
    jest
      .spyOn(devkitExports, 'getPackageManagerCommand')
      .mockReturnValue({ exec: 'npx' } as PackageManagerCommands);
  });

  describe('Standalone Project Repo', () => {
    it('should create the application correctly', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      await applicationGenerator(tree, {
        name: 'test',
        directory: '.',
        addPlugin: true,
      });

      // ASSERT
      expectTargetsToBeCorrect(tree, '.');

      expect(tree.exists('remix.config.js')).toBeFalsy();
      expect(tree.read('app/root.tsx', 'utf-8')).toMatchSnapshot();
      expect(tree.read('app/routes/_index.tsx', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('tests/routes/_index.spec.tsx', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read('vite.config.ts', 'utf-8')).toMatchSnapshot();
      expect(tree.read('.eslintrc.json', 'utf-8')).toMatchSnapshot();
    });

    it('should ignore vite temp files', async () => {
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      await applicationGenerator(tree, {
        name: 'test',
        directory: '.',
        addPlugin: true,
        skipFormat: true,
      });

      expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
        "null
        .cache
        build
        public/build
        .env

        vite.config.*.timestamp*
        vitest.config.*.timestamp*"
      `);
      expect(tree.read('.eslintrc.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "root": true,
          "ignorePatterns": [
            "!**/*",
            "build",
            "public/build",
            "**/vite.config.*.timestamp*",
            "**/vitest.config.*.timestamp*"
          ],
          "plugins": [
            "@nx"
          ],
          "overrides": [
            {
              "files": [
                "*.ts",
                "*.tsx"
              ],
              "extends": [
                "plugin:@nx/typescript"
              ],
              "rules": {}
            },
            {
              "files": [
                "*.js",
                "*.jsx"
              ],
              "extends": [
                "plugin:@nx/javascript"
              ],
              "rules": {}
            }
          ]
        }
        "
      `);
    });

    describe('--unitTestRunner', () => {
      it('should generate the correct files for testing using vitest', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace();

        // ACT
        await applicationGenerator(tree, {
          name: 'test',
          directory: '.',
          unitTestRunner: 'vitest',
          rootProject: true,
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, '.');

        expect(tree.exists('remix.config.js')).toBeFalsy();
        expect(tree.read('vitest.config.ts', 'utf-8')).toMatchSnapshot();
        expect(
          tree.read('tests/routes/_index.spec.tsx', 'utf-8')
        ).toMatchSnapshot();
        expect(tree.read('tsconfig.spec.json', 'utf-8')).toMatchSnapshot();
        expect(tree.read('test-setup.ts', 'utf-8')).toMatchSnapshot();
      });

      it('should generate the correct files for testing using jest', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace();

        // ACT
        await applicationGenerator(tree, {
          name: 'test',
          directory: '.',
          unitTestRunner: 'jest',
          rootProject: true,
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, '.');

        expect(tree.exists('remix.config.js')).toBeFalsy();
        expect(tree.read('jest.config.ts', 'utf-8')).toMatchSnapshot();
        expect(tree.read('test-setup.ts', 'utf-8')).toMatchSnapshot();
        expect(
          tree.read('tests/routes/_index.spec.tsx', 'utf-8')
        ).toMatchSnapshot();
        expect(tree.exists('jest.preset.cjs')).toBeTruthy();
      });
    });

    describe('--e2eTestRunner', () => {
      it('should generate a cypress e2e application for the app', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace();

        // ACT
        await applicationGenerator(tree, {
          name: 'test',
          directory: '.',
          e2eTestRunner: 'cypress',
          rootProject: true,
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, '.');

        expect(tree.read('e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
      });
    });

    it('should generate a playwright e2e application for the app', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      await applicationGenerator(tree, {
        name: 'test',
        directory: '.',
        e2eTestRunner: 'playwright',
        rootProject: true,
        addPlugin: true,
      });

      // ASSERT
      expectTargetsToBeCorrect(tree, '.');

      expect(tree.read('e2e/playwright.config.ts', 'utf-8')).toMatchSnapshot();
    });
  });

  describe.each([['test', 'test-e2e']])('Integrated Repo', (appDir, e2eDir) => {
    it('should create the application correctly', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      // ACT
      await applicationGenerator(tree, {
        directory: 'test',
        addPlugin: true,
      });

      // ASSERT
      expectTargetsToBeCorrect(tree, appDir);

      expect(tree.exists(`${appDir}/remix.config.js`)).toBeFalsy();
      expect(tree.read(`${appDir}/app/root.tsx`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`${appDir}/app/routes/_index.tsx`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should ignore vite temp files', async () => {
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      await applicationGenerator(tree, {
        directory: 'test',
        addPlugin: true,
        skipFormat: true,
      });

      expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
        "vite.config.*.timestamp*
        vitest.config.*.timestamp*"
      `);
      expect(tree.read(`${appDir}/.eslintrc.json`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "extends": [
            "../.eslintrc.json"
          ],
          "ignorePatterns": [
            "!**/*",
            "build",
            "public/build",
            "**/vite.config.*.timestamp*",
            "**/vitest.config.*.timestamp*"
          ],
          "overrides": [
            {
              "files": [
                "*.ts",
                "*.tsx",
                "*.js",
                "*.jsx"
              ],
              "rules": {}
            },
            {
              "files": [
                "*.ts",
                "*.tsx"
              ],
              "rules": {}
            },
            {
              "files": [
                "*.js",
                "*.jsx"
              ],
              "rules": {}
            }
          ]
        }
        "
      `);
    });

    describe('--directory', () => {
      it('should create the application correctly', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
        const newAppDir = 'demo';

        // ACT
        await applicationGenerator(tree, {
          name: 'test',
          directory: 'demo',
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, newAppDir);

        expect(tree.exists(`${newAppDir}/remix.config.js`)).toBeFalsy();
        expect(
          tree.read(`${newAppDir}/app/root.tsx`, 'utf-8')
        ).toMatchSnapshot();
        expect(
          tree.read(`${newAppDir}/app/routes/_index.tsx`, 'utf-8')
        ).toMatchSnapshot();
      });

      it('should extract the layout directory from the directory options if it exists', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
        const newAppDir = 'apps/demo';

        // ACT
        await applicationGenerator(tree, {
          name: 'test',
          directory: 'apps/demo',
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, newAppDir);

        expect(tree.exists(`${newAppDir}/remix.config.js`)).toBeFalsy();
        expect(
          tree.read(`${newAppDir}/app/root.tsx`, 'utf-8')
        ).toMatchSnapshot();
        expect(
          tree.read(`${newAppDir}/app/routes/_index.tsx`, 'utf-8')
        ).toMatchSnapshot();
      });
    });

    describe('--unitTestRunner', () => {
      it('should generate the correct files for testing using vitest', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

        // ACT
        await applicationGenerator(tree, {
          directory: 'test',
          unitTestRunner: 'vitest',
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, appDir);

        expect(tree.exists(`${appDir}/remix.config.js`)).toBeFalsy();
        expect(
          tree.read(`${appDir}/vitest.config.ts`, 'utf-8')
        ).toMatchSnapshot();
        expect(tree.read(`${appDir}/test-setup.ts`, 'utf-8')).toMatchSnapshot();
        expect(
          tree.read(`${appDir}/tsconfig.spec.json`, 'utf-8')
        ).toMatchSnapshot();
      });

      it('should generate the correct files for testing using jest', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

        // ACT
        await applicationGenerator(tree, {
          directory: 'test',
          unitTestRunner: 'jest',
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, appDir);

        expect(tree.exists(`${appDir}/remix.config.js`)).toBeFalsy();
        expect(
          tree.read(`${appDir}/jest.config.ts`, 'utf-8')
        ).toMatchSnapshot();
        expect(tree.read(`${appDir}/test-setup.ts`, 'utf-8')).toMatchSnapshot();
      });
    });

    describe('--e2eTestRunner', () => {
      it('should generate a cypress e2e application for the app', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

        // ACT
        await applicationGenerator(tree, {
          directory: 'test',
          e2eTestRunner: 'cypress',
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, appDir);

        expect(
          tree.read(`${appDir}-e2e/cypress.config.ts`, 'utf-8')
        ).toMatchSnapshot();
      });

      it('should generate a playwright e2e application for the app', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

        // ACT
        await applicationGenerator(tree, {
          directory: 'test',
          e2eTestRunner: 'playwright',
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, appDir);

        expect(
          tree.read(`${appDir}-e2e/playwright.config.ts`, 'utf-8')
        ).toMatchSnapshot();
      });
    });
  });

  describe('TS solution setup', () => {
    let tree: Tree;

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
        unitTestRunner: 'jest',
        addPlugin: true,
        tags: 'foo',
        useProjectJson: false,
      });

      const packageJson = readJson(tree, 'myapp/package.json');
      // Make sure keys are in idiomatic order
      expect(Object.keys(packageJson)).toMatchInlineSnapshot(`
        [
          "name",
          "private",
          "type",
          "scripts",
          "engines",
          "sideEffects",
          "nx",
          "dependencies",
          "devDependencies",
        ]
      `);
      expect(packageJson).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "@remix-run/node": "^2.15.0",
            "@remix-run/react": "^2.15.0",
            "@remix-run/serve": "^2.15.0",
            "isbot": "^4.4.0",
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
          },
          "devDependencies": {
            "@remix-run/dev": "^2.15.0",
            "@types/react": "^18.2.0",
            "@types/react-dom": "^18.2.0",
          },
          "name": "@proj/myapp",
          "nx": {
            "tags": [
              "foo",
            ],
          },
          "private": true,
          "scripts": {},
          "sideEffects": false,
          "type": "module",
        }
      `);

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
      expect(readJson(tree, 'myapp/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
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
            "allowJs": true,
            "esModuleInterop": true,
            "forceConsistentCasingInFileNames": true,
            "isolatedModules": true,
            "jsx": "react-jsx",
            "lib": [
              "DOM",
              "DOM.Iterable",
              "ES2019",
            ],
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "dist",
            "resolveJsonModule": true,
            "rootDir": ".",
            "skipLibCheck": true,
            "strict": true,
            "target": "ES2022",
            "types": [
              "@remix-run/node",
              "vite/client",
            ],
          },
          "exclude": [
            "out-tsc",
            "dist",
            "tests/**/*.spec.ts",
            "tests/**/*.test.ts",
            "tests/**/*.spec.tsx",
            "tests/**/*.test.tsx",
            "tests/**/*.spec.js",
            "tests/**/*.test.js",
            "tests/**/*.spec.jsx",
            "tests/**/*.test.jsx",
            "jest.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
            "eslint.config.js",
            "eslint.config.cjs",
            "eslint.config.mjs",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            "app/**/*.ts",
            "app/**/*.tsx",
            "app/**/*.js",
            "app/**/*.jsx",
            "**/.server/**/*.ts",
            "**/.server/**/*.tsx",
            "**/.client/**/*.ts",
            "**/.client/**/*.tsx",
          ],
        }
      `);
      expect(readJson(tree, 'myapp/tsconfig.spec.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "./out-tsc/jest",
            "types": [
              "jest",
              "node",
            ],
          },
          "extends": "../tsconfig.base.json",
          "include": [
            "vite.config.ts",
            "vitest.config.ts",
            "app/**/*.ts",
            "app/**/*.tsx",
            "app/**/*.js",
            "app/**/*.jsx",
            "tests/**/*.spec.ts",
            "tests/**/*.test.ts",
            "tests/**/*.spec.tsx",
            "tests/**/*.test.tsx",
            "tests/**/*.spec.js",
            "tests/**/*.test.js",
            "tests/**/*.spec.jsx",
            "tests/**/*.test.jsx",
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
        unitTestRunner: 'jest',
        addPlugin: true,
        tags: 'foo',
        useProjectJson: false,
      });

      const packageJson = readJson(tree, 'myapp/package.json');
      expect(packageJson.name).toBe('@proj/myapp');
      expect(packageJson.nx.name).toBe('myapp');
      // Make sure keys are in idiomatic order
      expect(Object.keys(packageJson)).toMatchInlineSnapshot(`
        [
          "name",
          "private",
          "type",
          "scripts",
          "engines",
          "sideEffects",
          "nx",
          "dependencies",
          "devDependencies",
        ]
      `);
    });

    it('should skip nx property in package.json when no tags are provided', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/myapp',
        e2eTestRunner: 'playwright',
        unitTestRunner: 'jest',
        addPlugin: true,
        useProjectJson: false,
      });

      expect(readJson(tree, 'apps/myapp/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "@remix-run/node": "^2.15.0",
            "@remix-run/react": "^2.15.0",
            "@remix-run/serve": "^2.15.0",
            "isbot": "^4.4.0",
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
          },
          "devDependencies": {
            "@remix-run/dev": "^2.15.0",
            "@types/react": "^18.2.0",
            "@types/react-dom": "^18.2.0",
          },
          "name": "@proj/myapp",
          "private": true,
          "scripts": {},
          "sideEffects": false,
          "type": "module",
        }
      `);
    });

    it('should generate valid package.json without formatting', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        e2eTestRunner: 'playwright',
        unitTestRunner: 'jest',
        addPlugin: true,
        useProjectJson: false,
        skipFormat: true,
      });

      expect(() =>
        JSON.parse(tree.read('myapp/package.json', 'utf-8'))
      ).not.toThrow();
    });

    it('should generate jest test config with @swc/jest', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        unitTestRunner: 'jest',
        addPlugin: true,
        useProjectJson: false,
        skipFormat: true,
      });

      expect(tree.exists('myapp/tsconfig.spec.json')).toBeTruthy();
      expect(tree.exists('myapp/tests/routes/_index.spec.tsx')).toBeTruthy();
      expect(tree.exists('myapp/jest.config.ts')).toBeTruthy();
      expect(tree.read('myapp/jest.config.ts', 'utf-8')).toMatchInlineSnapshot(`
        "/* eslint-disable */
        import { readFileSync } from 'fs';

        // Reading the SWC compilation config for the spec files
        const swcJestConfig = JSON.parse(
          readFileSync(\`\${__dirname}/.spec.swcrc\`, 'utf-8')
        );

        // Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
        swcJestConfig.swcrc = false;

        export default {
          displayName: '@proj/myapp',
          preset: '../jest.preset.js',
          transform: {
            '^.+\\\\.[tj]sx?$': ['@swc/jest', swcJestConfig]
          },
          moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
          coverageDirectory: 'test-output/jest/coverage'
        };
        "
      `);
      expect(tree.read('myapp/.spec.swcrc', 'utf-8')).toMatchInlineSnapshot(`
          "{
            "jsc": {
              "target": "es2017",
              "parser": {
                "syntax": "typescript",
                "decorators": true,
                "dynamicImport": true,
                "tsx": true
              },
              "transform": {
                "decoratorMetadata": true,
                "legacyDecorator": true,
                "react": {
                  "runtime": "automatic"
                }
              },
              "keepClassNames": true,
              "externalHelpers": true,
              "loose": true
            },
            "module": {
              "type": "es6"
            },
            "sourceMaps": true,
            "exclude": []
          }
          "
        `);
    });

    it('should generate project.json if useProjectJson is true', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        e2eTestRunner: 'playwright',
        addPlugin: true,
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
          "sourceRoot": "myapp",
          "tags": [],
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
          "tags": [],
          "targets": {},
        }
      `);
      expect(readJson(tree, 'myapp-e2e/package.json').nx).toBeUndefined();
    });
  });
});

function expectTargetsToBeCorrect(tree: Tree, projectRoot: string) {
  const { targets } = readJson(
    tree,
    joinPathFragments(projectRoot === '.' ? '/' : projectRoot, 'project.json')
  );
  expect(tree.exists(join(projectRoot, '.eslintrc.json'))).toBeTruthy();
}
