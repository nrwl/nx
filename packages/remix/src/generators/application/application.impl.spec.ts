import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  joinPathFragments,
  readJson,
  readNxJson,
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
        expect(readNxJson(tree).targetDefaults['e2e-ci--**/*'])
          .toMatchInlineSnapshot(`
          {
            "dependsOn": [
              "^build",
            ],
          }
        `);
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
      expect(readNxJson(tree).targetDefaults['e2e-ci--**/*'])
        .toMatchInlineSnapshot(`
          {
            "dependsOn": [
              "^build",
            ],
          }
        `);
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
    it('should add project references when using TS solution', async () => {
      const tree = createTreeWithEmptyWorkspace();
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

      await applicationGenerator(tree, {
        directory: 'myapp',
        e2eTestRunner: 'playwright',
        addPlugin: true,
      });

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
            "skipLibCheck": true,
            "strict": true,
            "target": "ES2022",
            "types": [
              "@remix-run/node",
              "vite/client",
            ],
          },
          "exclude": [
            "dist",
            "tests/**/*.spec.ts",
            "tests/**/*.test.ts",
            "tests/**/*.spec.tsx",
            "tests/**/*.test.tsx",
            "tests/**/*.spec.js",
            "tests/**/*.test.js",
            "tests/**/*.spec.jsx",
            "tests/**/*.test.jsx",
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
            "outDir": "dist",
            "sourceMap": false,
            "tsBuildInfoFile": "dist/tsconfig.tsbuildinfo",
          },
          "exclude": [
            "dist",
            "eslint.config.js",
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
          "references": [
            {
              "path": "../myapp",
            },
          ],
        }
      `);
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
