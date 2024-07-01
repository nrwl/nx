import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson, readProjectConfiguration } from '@nx/devkit';
import { applicationGenerator } from './application';

describe('app', () => {
  let tree: Tree;

  describe.each(['my-app', 'myApp'])(
    'generated files content - as-provided - %s',
    (name: string) => {
      describe('general application', () => {
        beforeEach(async () => {
          tree = createTreeWithEmptyWorkspace();
          await applicationGenerator(tree, {
            name,
            projectNameAndRootFormat: 'as-provided',
            unitTestRunner: 'vitest',
          });
        });

        it('should not add targets', async () => {
          const projectConfig = readProjectConfiguration(tree, name);
          expect(projectConfig.targets.build).toBeUndefined();
          expect(projectConfig.targets.serve).toBeUndefined();
          expect(projectConfig.targets.test).toBeUndefined();
          expect(projectConfig.targets['build-static']).toBeUndefined();
          expect(projectConfig.targets['serve-static']).toBeUndefined();
        });

        it('should create all new files in the correct location', async () => {
          const newFiles = tree.listChanges().map((change) => change.path);
          expect(newFiles).toMatchSnapshot();
        });

        it('should add nuxt entries in .gitignore', () => {
          expect(tree.read('.gitignore', 'utf-8')).toMatchSnapshot();
        });

        it('should configure nuxt correctly', () => {
          expect(
            tree.read(`${name}/nuxt.config.ts`, 'utf-8')
          ).toMatchSnapshot();
        });

        it('should configure eslint correctly', () => {
          expect(
            tree.read(`${name}/.eslintrc.json`, 'utf-8')
          ).toMatchSnapshot();
        });

        it('should configure vitest correctly', () => {
          expect(
            tree.read(`${name}/vitest.config.ts`, 'utf-8')
          ).toMatchSnapshot();
          expect(
            tree.read(`${name}/tsconfig.spec.json`, 'utf-8')
          ).toMatchSnapshot();
          expect(tree.read(`${name}/tsconfig.json`, 'utf-8')).toMatchSnapshot();
          const packageJson = readJson(tree, 'package.json');
          expect(packageJson.devDependencies['vitest']).toEqual('^1.3.1');
        });

        it('should configure tsconfig and project.json correctly', () => {
          expect(tree.read(`${name}/project.json`, 'utf-8')).toMatchSnapshot();
          expect(tree.read(`${name}/tsconfig.json`, 'utf-8')).toMatchSnapshot();
        });

        it('should add the nuxt and vitest plugins', () => {
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
        });
      });

      describe('styles setup', () => {
        beforeAll(async () => {
          tree = createTreeWithEmptyWorkspace();
        });
        it('should configure css', async () => {
          await applicationGenerator(tree, {
            name: 'myapp1',
            projectNameAndRootFormat: 'as-provided',
            unitTestRunner: 'none',
            style: 'css',
          });
          expect(tree.exists('myapp1/src/assets/css/styles.css')).toBeTruthy();
          expect(tree.read('myapp1/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
        });

        it('should configure scss', async () => {
          await applicationGenerator(tree, {
            name: 'myapp2',
            projectNameAndRootFormat: 'as-provided',
            unitTestRunner: 'none',
            style: 'scss',
          });
          expect(tree.exists('myapp2/src/assets/css/styles.scss')).toBeTruthy();
          expect(tree.read('myapp2/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
        });

        it('should configure less', async () => {
          await applicationGenerator(tree, {
            name: 'myapp3',
            projectNameAndRootFormat: 'as-provided',
            unitTestRunner: 'none',
            style: 'less',
          });
          expect(tree.exists('myapp3/src/assets/css/styles.less')).toBeTruthy();
          expect(tree.read('myapp3/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
        });

        it('should not configure styles', async () => {
          await applicationGenerator(tree, {
            name: 'myapp4',
            projectNameAndRootFormat: 'as-provided',
            unitTestRunner: 'none',
            style: 'none',
          });
          expect(tree.exists('myapp4/src/assets/css/styles.css')).toBeFalsy();
          expect(tree.read('myapp4/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
        });
      });
    }
  );
});
