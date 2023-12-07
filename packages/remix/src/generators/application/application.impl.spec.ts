import type { Tree } from '@nx/devkit';
import { joinPathFragments, readJson } from '@nx/devkit';
import { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from './application.impl';

describe('Remix Application', () => {
  describe('Standalone Project Repo', () => {
    it('should create the application correctly', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      // ACT
      await applicationGenerator(tree, {
        name: 'test',
        rootProject: true,
      });

      // ASSERT
      expectTargetsToBeCorrect(tree, '.');

      expect(tree.read('remix.config.cjs', 'utf-8')).toMatchSnapshot();
      expect(tree.read('app/root.tsx', 'utf-8')).toMatchSnapshot();
      expect(tree.read('app/routes/_index.tsx', 'utf-8')).toMatchSnapshot();
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
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, '.');

        expect(tree.read('remix.config.cjs', 'utf-8')).toMatchSnapshot();
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
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, '.');

        expect(tree.read('remix.config.cjs', 'utf-8')).toMatchSnapshot();
        expect(tree.read('vite.config.ts', 'utf-8')).toMatchSnapshot();
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
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, '.');

        expect(tree.read('remix.config.cjs', 'utf-8')).toMatchSnapshot();
        expect(tree.read('jest.config.ts', 'utf-8')).toMatchSnapshot();
        expect(tree.read('test-setup.ts', 'utf-8')).toMatchSnapshot();
      });
    });

    describe('--e2eTestRunner', () => {
      it('should generate an e2e application for the app', async () => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace();

        // ACT
        await applicationGenerator(tree, {
          name: 'test',
          e2eTestRunner: 'cypress',
          rootProject: true,
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, '.');

        expect(tree.read('e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
      });
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
        });

        // ASSERT
        expectTargetsToBeCorrect(tree, appDir);

        expect(
          tree.read(`${appDir}/remix.config.cjs`, 'utf-8')
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
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, appDir);

          expect(
            tree.read(`${appDir}/remix.config.cjs`, 'utf-8')
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
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, newAppDir);

          expect(
            tree.read(`${newAppDir}/remix.config.cjs`, 'utf-8')
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
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, newAppDir);

          expect(
            tree.read(`${newAppDir}/remix.config.cjs`, 'utf-8')
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
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, appDir);

          expect(
            tree.read(`${appDir}/remix.config.cjs`, 'utf-8')
          ).toMatchSnapshot();
          expect(
            tree.read(`${appDir}/vite.config.ts`, 'utf-8')
          ).toMatchSnapshot();
          expect(
            tree.read(`${appDir}/test-setup.ts`, 'utf-8')
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
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, appDir);

          expect(
            tree.read(`${appDir}/remix.config.cjs`, 'utf-8')
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
        it('should generate an e2e application for the app', async () => {
          // ARRANGE
          const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

          // ACT
          await applicationGenerator(tree, {
            name: 'test',
            e2eTestRunner: 'cypress',
            projectNameAndRootFormat,
          });

          // ASSERT
          expectTargetsToBeCorrect(tree, appDir);

          expect(
            tree.read(`${appDir}-e2e/cypress.config.ts`, 'utf-8')
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
  expect(targets.build).toBeTruthy();
  expect(targets.build.executor).toEqual('@nx/remix:build');
  expect(targets.build.options.outputPath).toEqual(
    joinPathFragments('dist', projectRoot)
  );
  expect(targets.serve).toBeTruthy();
  expect(targets.serve.executor).toEqual('@nx/remix:serve');
  expect(targets.serve.options.port).toEqual(4200);
  expect(targets.start).toBeTruthy();
  expect(targets.start.command).toEqual('remix-serve build/index.js');
  expect(targets.start.options.cwd).toEqual(projectRoot);
  expect(targets.typecheck).toBeTruthy();
  expect(targets.typecheck.command).toEqual('tsc');
  expect(targets.typecheck.options.cwd).toEqual(projectRoot);
}
