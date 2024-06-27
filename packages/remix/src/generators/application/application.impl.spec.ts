import 'nx/src/internal-testing-utils/mock-project-graph';

import { joinPathFragments, readJson, type Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from './application.impl';
import { join } from 'path';
import { PackageManagerCommands } from 'nx/src/utils/package-manager';

describe('Remix Application', () => {
  beforeEach(() => {
    jest
      .spyOn(devkit, 'getPackageManagerCommand')
      .mockReturnValue({ exec: 'npx' } as PackageManagerCommands);
  });

  describe('Standalone Project Repo', () => {
    it('should create the application correctly', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      await applicationGenerator(tree, {
        name: 'test',
        rootProject: true,
        addPlugin: true,
      });

      // ASSERT
      expectTargetsToBeCorrect(tree, '.');

      expect(tree.read('remix.config.js', 'utf-8')).toMatchSnapshot();
      expect(tree.read('app/root.tsx', 'utf-8')).toMatchSnapshot();
      expect(tree.read('app/routes/_index.tsx', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('tests/routes/_index.spec.tsx', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read('vite.config.ts', 'utf-8')).toMatchSnapshot();
      expect(tree.read('.eslintrc.json', 'utf-8')).toMatchSnapshot();
    });

    describe(`--js`, () => {
      it('should create the application correctly', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace();

        // ACT
        await applicationGenerator(tree, {
          name: 'test',
          js: true,
          rootProject: true,
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, '.');

        expect(tree.read('remix.config.js', 'utf-8')).toMatchSnapshot();
        expect(tree.read('app/root.js', 'utf-8')).toMatchSnapshot();
        expect(tree.read('app/routes/_index.js', 'utf-8')).toMatchSnapshot();
      });
    });

    describe('--unitTestRunner', () => {
      it('should generate the correct files for testing using vitest', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace();

        // ACT
        await applicationGenerator(tree, {
          name: 'test',
          unitTestRunner: 'vitest',
          rootProject: true,
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, '.');

        expect(tree.read('remix.config.js', 'utf-8')).toMatchSnapshot();
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
          unitTestRunner: 'jest',
          rootProject: true,
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, '.');

        expect(tree.read('remix.config.js', 'utf-8')).toMatchSnapshot();
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
        e2eTestRunner: 'playwright',
        rootProject: true,
        addPlugin: true,
      });

      // ASSERT
      expectTargetsToBeCorrect(tree, '.');

      expect(tree.read('e2e/playwright.config.ts', 'utf-8')).toMatchSnapshot();
    });
  });

  describe.each([
    ['derived', 'apps/test', 'apps/test-e2e'],
    ['as-provided', 'test', 'test-e2e'],
  ])(
    'Integrated Repo --projectNameAndRootFormat=%s',
    (projectNameAndRootFormat: ProjectNameAndRootFormat, appDir, e2eDir) => {
      it('should create the application correctly', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

        // ACT
        await applicationGenerator(tree, {
          name: 'test',
          projectNameAndRootFormat,
          addPlugin: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, appDir);

        expect(
          tree.read(`${appDir}/remix.config.js`, 'utf-8')
        ).toMatchSnapshot();
        expect(tree.read(`${appDir}/app/root.tsx`, 'utf-8')).toMatchSnapshot();
        expect(
          tree.read(`${appDir}/app/routes/_index.tsx`, 'utf-8')
        ).toMatchSnapshot();
      });

      describe('--js', () => {
        it('should create the application correctly', async () => {
          // ARRANGE
          const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

          // ACT
          await applicationGenerator(tree, {
            name: 'test',
            js: true,
            projectNameAndRootFormat,
            addPlugin: true,
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, appDir);

          expect(
            tree.read(`${appDir}/remix.config.js`, 'utf-8')
          ).toMatchSnapshot();
          expect(tree.read(`${appDir}/app/root.js`, 'utf-8')).toMatchSnapshot();
          expect(
            tree.read(`${appDir}/app/routes/_index.js`, 'utf-8')
          ).toMatchSnapshot();
        });
      });
      describe('--directory', () => {
        it('should create the application correctly', async () => {
          // ARRANGE
          const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
          const newAppDir =
            projectNameAndRootFormat === 'as-provided'
              ? 'demo'
              : 'apps/demo/test';

          // ACT
          await applicationGenerator(tree, {
            name: 'test',
            directory: 'demo',
            projectNameAndRootFormat,
            addPlugin: true,
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, newAppDir);

          expect(
            tree.read(`${newAppDir}/remix.config.js`, 'utf-8')
          ).toMatchSnapshot();
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
          const newAppDir =
            projectNameAndRootFormat === 'as-provided'
              ? 'apps/demo'
              : 'apps/demo/test';

          // ACT
          await applicationGenerator(tree, {
            name: 'test',
            directory: 'apps/demo',
            projectNameAndRootFormat,
            addPlugin: true,
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, newAppDir);

          expect(
            tree.read(`${newAppDir}/remix.config.js`, 'utf-8')
          ).toMatchSnapshot();
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
            name: 'test',
            unitTestRunner: 'vitest',
            projectNameAndRootFormat,
            addPlugin: true,
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, appDir);

          expect(
            tree.read(`${appDir}/remix.config.js`, 'utf-8')
          ).toMatchSnapshot();
          expect(
            tree.read(`${appDir}/vitest.config.ts`, 'utf-8')
          ).toMatchSnapshot();
          expect(
            tree.read(`${appDir}/test-setup.ts`, 'utf-8')
          ).toMatchSnapshot();
          expect(
            tree.read(`${appDir}/tsconfig.spec.json`, 'utf-8')
          ).toMatchSnapshot();
        });

        it('should generate the correct files for testing using jest', async () => {
          // ARRANGE
          const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

          // ACT
          await applicationGenerator(tree, {
            name: 'test',
            unitTestRunner: 'jest',
            projectNameAndRootFormat,
            addPlugin: true,
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, appDir);

          expect(
            tree.read(`${appDir}/remix.config.js`, 'utf-8')
          ).toMatchSnapshot();
          expect(
            tree.read(`${appDir}/jest.config.ts`, 'utf-8')
          ).toMatchSnapshot();
          expect(
            tree.read(`${appDir}/test-setup.ts`, 'utf-8')
          ).toMatchSnapshot();
        });
      });

      describe('--e2eTestRunner', () => {
        it('should generate a cypress e2e application for the app', async () => {
          // ARRANGE
          const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

          // ACT
          await applicationGenerator(tree, {
            name: 'test',
            e2eTestRunner: 'cypress',
            projectNameAndRootFormat,
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
            name: 'test',
            e2eTestRunner: 'playwright',
            projectNameAndRootFormat,
            addPlugin: true,
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, appDir);

          expect(
            tree.read(`${appDir}-e2e/playwright.config.ts`, 'utf-8')
          ).toMatchSnapshot();
        });
      });
    }
  );
});

function expectTargetsToBeCorrect(tree: Tree, projectRoot: string) {
  const { targets } = readJson(
    tree,
    joinPathFragments(projectRoot === '.' ? '/' : projectRoot, 'project.json')
  );
  expect(tree.exists(join(projectRoot, '.eslintrc.json'))).toBeTruthy();
}
