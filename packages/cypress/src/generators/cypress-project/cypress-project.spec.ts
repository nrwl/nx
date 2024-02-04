import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { cypressProjectGenerator } from './cypress-project';
import { Schema } from './schema';
import { Linter } from '@nx/eslint';
import { installedCypressVersion } from '../../utils/cypress-version';
import { cypressInitGenerator } from '../init/init';

jest.mock('../../utils/cypress-version');
jest.mock('../init/init');
describe('Cypress Project', () => {
  let tree: Tree;
  const defaultOptions: Omit<Schema, 'name' | 'project'> = {
    linter: Linter.EsLint,
  };
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  let mockInitCypress: jest.Mock<ReturnType<typeof cypressInitGenerator>> =
    cypressInitGenerator as never;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'my-app', {
      root: 'my-app',
      targets: {
        serve: {
          executor: 'serve-executor',
          options: {},
          configurations: {
            production: {},
          },
        },
      },
    });

    addProjectConfiguration(tree, 'my-dir-my-app', {
      root: 'my-dir/my-app',
      targets: {
        serve: {
          executor: 'serve-executor',
          options: {},
          configurations: {
            production: {},
          },
        },
      },
    });
  });
  afterEach(() => jest.clearAllMocks());

  it('should call init if cypress is not installed', async () => {
    mockedInstalledCypressVersion.mockReturnValue(null);

    await cypressProjectGenerator(tree, {
      ...defaultOptions,
      name: 'my-app-e2e',
      project: 'my-app',
      projectNameAndRootFormat: 'as-provided',
    });

    expect(mockInitCypress).toHaveBeenCalled();
  });

  it('should call not init if cypress is installed', async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);

    await cypressProjectGenerator(tree, {
      ...defaultOptions,
      name: 'my-app-e2e',
      project: 'my-app',
      projectNameAndRootFormat: 'as-provided',
    });

    expect(mockInitCypress).not.toHaveBeenCalled();
  });

  describe('> v10', () => {
    beforeEach(() => {
      mockedInstalledCypressVersion.mockReturnValue(10);
    });

    it('should generate files for v10 and above', async () => {
      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'my-app-e2e',
        project: 'my-app',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.exists('my-app-e2e/cypress.config.ts')).toBeTruthy();
      expect(tree.exists('my-app-e2e/src/fixtures/example.json')).toBeTruthy();
      expect(tree.exists('my-app-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('my-app-e2e/src/support/app.po.ts')).toBeTruthy();
      expect(tree.exists('my-app-e2e/src/support/commands.ts')).toBeTruthy();
      expect(tree.exists('my-app-e2e/src/support/e2e.ts')).toBeTruthy();
    });

    it('should update configuration when eslint is passed', async () => {
      await cypressProjectGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        linter: Linter.EsLint,
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.read('my-app-e2e/.eslintrc.json', 'utf-8')).toMatchSnapshot();
    });

    it('should not add lint target when "none" is passed', async () => {
      await cypressProjectGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        linter: Linter.None,
        projectNameAndRootFormat: 'as-provided',
      });

      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.targets.lint).toBeUndefined();
    });

    it('should update tags and implicit dependencies', async () => {
      await cypressProjectGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        linter: Linter.EsLint,
        projectNameAndRootFormat: 'as-provided',
      });

      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-app']);
    });

    it('should set right path names in `cypress.config.ts`', async () => {
      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'my-app-e2e',
        project: 'my-app',
        projectNameAndRootFormat: 'as-provided',
      });

      const cypressConfig = tree.read('my-app-e2e/cypress.config.ts', 'utf-8');
      expect(cypressConfig).toMatchSnapshot();
    });

    it('should set right path names in `tsconfig.e2e.json`', async () => {
      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'my-app-e2e',
        project: 'my-app',
        projectNameAndRootFormat: 'as-provided',
      });

      const tsconfigJson = readJson(tree, 'my-app-e2e/tsconfig.json');
      expect(tsconfigJson).toMatchSnapshot();
    });

    it('should extend from tsconfig.base.json', async () => {
      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'my-app-e2e',
        project: 'my-app',
        projectNameAndRootFormat: 'as-provided',
      });

      const tsConfig = readJson(tree, 'my-app-e2e/tsconfig.json');
      expect(tsConfig.extends).toBe('../tsconfig.base.json');
    });

    it('should support a root tsconfig.json instead of tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'my-app-e2e',
        project: 'my-app',
        projectNameAndRootFormat: 'as-provided',
      });

      const tsConfig = readJson(tree, 'my-app-e2e/tsconfig.json');
      expect(tsConfig.extends).toBe('../tsconfig.json');
    });

    describe('for bundler:vite', () => {
      it('should pass the bundler info to nxE2EPreset in `cypress.config.ts`', async () => {
        await cypressProjectGenerator(tree, {
          ...defaultOptions,
          name: 'my-app-e2e',
          project: 'my-app',
          bundler: 'vite',
          projectNameAndRootFormat: 'as-provided',
        });

        const cypressConfig = tree.read(
          'my-app-e2e/cypress.config.ts',
          'utf-8'
        );
        expect(cypressConfig).toMatchSnapshot();
      });
    });

    describe('nested', () => {
      it('should set right path names in `cypress.config.ts`', async () => {
        await cypressProjectGenerator(tree, {
          ...defaultOptions,
          name: 'my-app-e2e',
          project: 'my-dir-my-app',
          directory: 'my-dir/my-app-e2e',
          projectNameAndRootFormat: 'as-provided',
        });

        const cypressConfig = tree.read(
          'my-dir/my-app-e2e/cypress.config.ts',
          'utf-8'
        );
        expect(cypressConfig).toMatchSnapshot();
      });

      it('should set right path names in `tsconfig.e2e.json`', async () => {
        await cypressProjectGenerator(tree, {
          ...defaultOptions,
          name: 'my-app-e2e',
          project: 'my-dir-my-app',
          directory: 'my-dir/my-app-e2e',
          projectNameAndRootFormat: 'as-provided',
        });

        const tsconfigJson = readJson(tree, 'my-dir/my-app-e2e/tsconfig.json');
        expect(tsconfigJson).toMatchSnapshot();
      });

      it('should extend from tsconfig.base.json', async () => {
        await cypressProjectGenerator(tree, {
          ...defaultOptions,
          name: 'my-app-e2e',
          project: 'my-app',
          directory: 'my-dir/my-app-e2e',
          projectNameAndRootFormat: 'as-provided',
        });

        const tsConfig = readJson(tree, 'my-dir/my-app-e2e/tsconfig.json');
        expect(tsConfig.extends).toBe('../../tsconfig.base.json');
      });

      it('should support a root tsconfig.json instead of tsconfig.base.json', async () => {
        tree.rename('tsconfig.base.json', 'tsconfig.json');

        await cypressProjectGenerator(tree, {
          ...defaultOptions,
          name: 'my-app-e2e',
          project: 'my-app',
          directory: 'my-dir/my-app-e2e',
          projectNameAndRootFormat: 'as-provided',
        });

        const tsConfig = readJson(tree, 'my-dir/my-app-e2e/tsconfig.json');
        expect(tsConfig.extends).toBe('../../tsconfig.json');
      });

      describe('root project', () => {
        it('should generate in option.name when root project detected', async () => {
          addProjectConfiguration(tree, 'root', { root: '.' });

          await cypressProjectGenerator(tree, {
            ...defaultOptions,
            name: 'e2e-tests',
            baseUrl: 'http://localhost:1234',
            project: 'root',
            projectNameAndRootFormat: 'as-provided',
          });

          expect(tree.listChanges().map((c) => c.path)).toEqual(
            expect.arrayContaining([
              'e2e-tests/cypress.config.ts',
              'e2e-tests/src/e2e/app.cy.ts',
              'e2e-tests/src/fixtures/example.json',
              'e2e-tests/src/support/app.po.ts',
              'e2e-tests/src/support/commands.ts',
              'e2e-tests/src/support/e2e.ts',
              'e2e-tests/tsconfig.json',
            ])
          );
        });

        it('should not generate a root project when the passed in project is not the root project', async () => {
          addProjectConfiguration(tree, 'root', { root: '.' });
          addProjectConfiguration(tree, 'my-cool-app', { root: 'my-cool-app' });

          await cypressProjectGenerator(tree, {
            ...defaultOptions,
            name: 'e2e-tests',
            baseUrl: 'http://localhost:1234',
            project: 'my-cool-app',
            projectNameAndRootFormat: 'as-provided',
          });

          expect(tree.listChanges().map((c) => c.path)).toEqual(
            expect.arrayContaining([
              'e2e-tests/cypress.config.ts',
              'e2e-tests/src/e2e/app.cy.ts',
              'e2e-tests/src/fixtures/example.json',
              'e2e-tests/src/support/app.po.ts',
              'e2e-tests/src/support/commands.ts',
              'e2e-tests/src/support/e2e.ts',
              'e2e-tests/tsconfig.json',
            ])
          );
        });
      });
    });

    describe('--project', () => {
      describe('none', () => {
        it('should not add any implicit dependencies', async () => {
          await cypressProjectGenerator(tree, {
            ...defaultOptions,
            name: 'my-app-e2e',
            baseUrl: 'http://localhost:7788',
            projectNameAndRootFormat: 'as-provided',
          });

          const projectConfig = readProjectConfiguration(tree, 'my-app-e2e');
          expect(projectConfig.implicitDependencies).not.toBeDefined();
          expect(projectConfig.tags).toEqual([]);
        });
      });

      it('should not throw an error when --project does not have targets', async () => {
        const projectConf = readProjectConfiguration(tree, 'my-app');
        delete projectConf.targets;
        updateProjectConfiguration(tree, 'my-app', projectConf);

        await cypressProjectGenerator(tree, {
          name: 'my-app-e2e',
          project: 'my-app',
          linter: Linter.EsLint,
          projectNameAndRootFormat: 'as-provided',
        });

        const projectConfig = readProjectConfiguration(tree, 'my-app-e2e');
        expect(projectConfig.targets['e2e'].options.devServerTarget).toEqual(
          'my-app:serve'
        );
      });
    });

    it('should generate in the correct folder', async () => {
      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'one-two-other-e2e',
        project: 'my-app',
        directory: 'one/two/other-e2e',
        projectNameAndRootFormat: 'as-provided',
      });

      const project = readProjectConfiguration(tree, 'one-two-other-e2e');
      expect(project).toBeDefined();
      [
        'one/two/other-e2e/cypress.config.ts',
        'one/two/other-e2e/src/e2e/app.cy.ts',
      ].forEach((path) => expect(tree.exists(path)).toBeTruthy());
    });

    it('should generate in the correct folder when --project-name-and-root-format=derived', async () => {
      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'other-e2e',
        project: 'my-app',
        directory: 'one/two',
        projectNameAndRootFormat: 'derived',
      });

      const project = readProjectConfiguration(tree, 'one-two-other-e2e');
      expect(project).toBeDefined();
      [
        'apps/one/two/other-e2e/cypress.config.ts',
        'apps/one/two/other-e2e/src/e2e/app.cy.ts',
      ].forEach((path) => expect(tree.exists(path)).toBeTruthy());
    });

    describe('serve-static', () => {
      it('should configure Cypress with ci configuration if serve-static is found', async () => {
        const appConfig = readProjectConfiguration(tree, 'my-app');
        appConfig.targets['serve-static'] = {
          executor: 'serve-static-executor',
          options: {},
          configurations: {
            production: {},
          },
        };
        updateProjectConfiguration(tree, 'my-app', appConfig);

        await cypressProjectGenerator(tree, {
          ...defaultOptions,
          name: 'my-app-e2e',
          project: 'my-app',
          projectNameAndRootFormat: 'as-provided',
        });

        const e2eConfig = readProjectConfiguration(tree, 'my-app-e2e');
        expect(e2eConfig.targets.e2e).toMatchObject({
          options: {
            devServerTarget: 'my-app:serve',
          },
          configurations: {
            production: { devServerTarget: 'my-app:serve:production' },
            ci: { devServerTarget: 'my-app:serve-static' },
          },
        });
      });

      it('should not configure Cypress with ci configuration if serve-static is not found', async () => {
        await cypressProjectGenerator(tree, {
          ...defaultOptions,
          name: 'my-app-e2e',
          project: 'my-app',
          projectNameAndRootFormat: 'as-provided',
        });

        const e2eConfig = readProjectConfiguration(tree, 'my-app-e2e');
        expect(e2eConfig.targets.e2e.configurations.ci).toBeUndefined();
      });
    });
  });

  describe('v9 - v7', () => {
    beforeEach(() => {
      mockedInstalledCypressVersion.mockReturnValue(9);
    });

    it('should generate files', async () => {
      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'my-app-e2e',
        project: 'my-app',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.exists('my-app-e2e/cypress.json')).toBeTruthy();
      expect(tree.exists('my-app-e2e/src/fixtures/example.json')).toBeTruthy();
      expect(
        tree.exists('my-app-e2e/src/integration/app.spec.ts')
      ).toBeTruthy();
      expect(tree.exists('my-app-e2e/src/support/app.po.ts')).toBeTruthy();
      expect(tree.exists('my-app-e2e/src/support/commands.ts')).toBeTruthy();
      expect(tree.exists('my-app-e2e/src/support/index.ts')).toBeTruthy();
    });
  });

  describe('< v7', () => {
    beforeEach(() => {
      mockedInstalledCypressVersion.mockReturnValue(6);
    });

    it('should generate a plugin file if cypress is below version 7', async () => {
      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'my-app-e2e',
        project: 'my-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: false,
      });

      expect(tree.exists('my-app-e2e/src/plugins/index.js')).toBeTruthy();
    });

    it('should update project configuration', async () => {
      await cypressProjectGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        linter: Linter.EsLint,
        projectNameAndRootFormat: 'as-provided',
        addPlugin: false,
      });

      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.root).toEqual('my-app-e2e');
      expect(project.targets).toMatchSnapshot();
    });

    it('should update project configuration (baseUrl)', async () => {
      await cypressProjectGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        baseUrl: 'http://localhost:3000',
        linter: Linter.EsLint,
        projectNameAndRootFormat: 'as-provided',
        addPlugin: false,
      });

      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.root).toEqual('my-app-e2e');
      expect(project.targets).toMatchSnapshot();
    });

    it('should update target configurations', async () => {
      const originalProject = readProjectConfiguration(tree, 'my-app');
      originalProject.targets.serve.defaultConfiguration = 'development';
      originalProject.targets.serve.configurations.development = {};
      updateProjectConfiguration(tree, 'my-app', originalProject);

      await cypressProjectGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        linter: Linter.EsLint,
        projectNameAndRootFormat: 'as-provided',
        addPlugin: false,
      });

      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.root).toEqual('my-app-e2e');
      expect(project.targets).toMatchSnapshot();
    });

    describe('nested', () => {
      it('should update configuration', async () => {
        await cypressProjectGenerator(tree, {
          name: 'my-dir-my-app-e2e',
          project: 'my-dir-my-app',
          directory: 'my-dir/my-app-e2e',
          linter: Linter.EsLint,
          projectNameAndRootFormat: 'as-provided',
          addPlugin: false,
        });

        const projectConfig = readProjectConfiguration(
          tree,
          'my-dir-my-app-e2e'
        );
        expect(projectConfig).toBeDefined();
        expect(projectConfig.targets).toMatchSnapshot();
      });
    });

    describe('--linter', () => {
      describe('eslint', () => {
        it('should add eslint-plugin-cypress', async () => {
          await cypressProjectGenerator(tree, {
            name: 'my-app-e2e',
            project: 'my-app',
            linter: Linter.EsLint,
            projectNameAndRootFormat: 'as-provided',
            addPlugin: false,
          });

          const packageJson = readJson(tree, 'package.json');
          expect(
            packageJson.devDependencies['eslint-plugin-cypress']
          ).toBeTruthy();
          const eslintrcJson = readJson(tree, 'my-app-e2e/.eslintrc.json');
          expect(eslintrcJson).toMatchSnapshot();
        });
      });
    });

    describe('project with directory in its name', () => {
      beforeEach(async () => {
        await cypressProjectGenerator(tree, {
          name: 'my-dir-my-app-e2e',
          project: 'my-dir-my-app',
          directory: 'my-dir/my-app-e2e',
          linter: Linter.EsLint,
          projectNameAndRootFormat: 'as-provided',
          addPlugin: false,
        });
      });

      it('should update configuration', async () => {
        const projectConfig = readProjectConfiguration(
          tree,
          'my-dir-my-app-e2e'
        );
        expect(projectConfig).toBeDefined();
        expect(projectConfig.targets).toMatchSnapshot();
      });

      it('should update nx.json', async () => {
        const project = readProjectConfiguration(tree, 'my-dir-my-app-e2e');
        expect(project.tags).toEqual([]);
        expect(project.implicitDependencies).toEqual(['my-dir-my-app']);
      });

      it('should set right path names in `cypress.json`', async () => {
        const cypressConfig = tree.read(
          'my-dir/my-app-e2e/cypress.json',
          'utf-8'
        );
        expect(cypressConfig).toMatchSnapshot();
      });
    });
  });
});
