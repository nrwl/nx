import {
  addProjectConfiguration,
  joinPathFragments,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  writeJson,
  type ExpandedPluginConfiguration,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'node:path';
import {
  getRelativeProjectJsonSchemaPath,
  updateProjectConfiguration,
} from 'nx/src/generators/utils/project-configuration';
import type { JestPluginOptions } from '../../plugins/plugin';
import { convertToInferred } from './convert-to-inferred';

let fs: TempFs;
let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
  updateProjectConfiguration: jest
    .fn()
    .mockImplementation((tree, projectName, projectConfiguration) => {
      function handleEmptyTargets(
        projectName: string,
        projectConfiguration: ProjectConfiguration
      ): void {
        if (
          projectConfiguration.targets &&
          !Object.keys(projectConfiguration.targets).length
        ) {
          // Re-order `targets` to appear after the `// target` comment.
          delete projectConfiguration.targets;
          projectConfiguration[
            '// targets'
          ] = `to see all targets run: nx show project ${projectName} --web`;
          projectConfiguration.targets = {};
        } else {
          delete projectConfiguration['// targets'];
        }
      }

      const projectConfigFile = joinPathFragments(
        projectConfiguration.root,
        'project.json'
      );

      if (!tree.exists(projectConfigFile)) {
        throw new Error(
          `Cannot update Project ${projectName} at ${projectConfiguration.root}. It either doesn't exist yet, or may not use project.json for configuration. Use \`addProjectConfiguration()\` instead if you want to create a new project.`
        );
      }
      handleEmptyTargets(projectName, projectConfiguration);
      writeJson(tree, projectConfigFile, {
        name: projectConfiguration.name ?? projectName,
        $schema: getRelativeProjectJsonSchemaPath(tree, projectConfiguration),
        ...projectConfiguration,
        root: undefined,
      });
      projectGraph.nodes[projectName].data = projectConfiguration;
    }),
}));

function addProject(tree: Tree, name: string, project: ProjectConfiguration) {
  addProjectConfiguration(tree, name, project);
  projectGraph.nodes[name] = {
    name: name,
    type: project.projectType === 'application' ? 'app' : 'lib',
    data: {
      projectType: project.projectType,
      root: project.root,
      targets: project.targets,
    },
  };
}

interface TestProjectOptions {
  appName: string;
  appRoot: string;
  targetName: string;
  legacyExecutor?: boolean;
}

const defaultTestProjectOptions: TestProjectOptions = {
  appName: 'app1',
  appRoot: 'apps/app1',
  targetName: 'test',
  legacyExecutor: false,
};

function writeJestConfig(
  tree: Tree,
  projectRoot: string,
  jestConfig: any | undefined,
  configFileName = 'jest.config.js'
) {
  jestConfig ??= {
    coverageDirectory: `../../coverage/${projectRoot}`,
  };
  const jestConfigContents = `module.exports = ${JSON.stringify(jestConfig)};`;

  tree.write(`${projectRoot}/${configFileName}`, jestConfigContents);
  fs.createFileSync(`${projectRoot}/${configFileName}`, jestConfigContents);
  jest.doMock(join(fs.tempDir, projectRoot, configFileName), () => jestConfig, {
    virtual: true,
  });
}

function createTestProject(
  tree: Tree,
  opts: Partial<TestProjectOptions> = defaultTestProjectOptions,
  extraTargetOptions?: any,
  jestConfig?: any
) {
  let projectOpts = { ...defaultTestProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.targetName]: {
        executor: projectOpts.legacyExecutor
          ? '@nrwl/jest:jest'
          : '@nx/jest:jest',
        options: {
          jestConfig: `${projectOpts.appRoot}/jest.config.js`,
          ...extraTargetOptions,
        },
      },
    },
  };

  writeJestConfig(tree, projectOpts.appRoot, jestConfig);

  tree.write(`${projectOpts.appRoot}/src/app/test.spec.ts`, '');
  fs.createFileSync(`${projectOpts.appRoot}/src/app/test.spec.ts`, '');

  addProject(tree, project.name, project);
  fs.createFileSync(
    `${projectOpts.appRoot}/project.json`,
    JSON.stringify(project)
  );
  return project;
}

describe('Jest - Convert Executors To Plugin', () => {
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('jest');
    tree = createTreeWithEmptyWorkspace();
    tree.root = fs.tempDir;

    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  afterEach(() => {
    fs.cleanup();
    jest.resetModules();
  });

  describe('--project', () => {
    it('should set up the jest plugin and migrate specified project by removing the target when it only has options that are removed', async () => {
      const project = createTestProject(tree, undefined, {
        tsConfig: `${defaultTestProjectOptions.appRoot}/tsconfig.spec.json`,
        config: `${defaultTestProjectOptions.appRoot}/jest.config.js`,
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // target only had options that are removed, assert no test target in converted project
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test).toBeUndefined();
      // assert plugin was added to nx.json
      const nxJsonPlugins = readNxJson(tree).plugins;
      const jestPlugin = nxJsonPlugins.find(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/jest/plugin' &&
          plugin.include?.length === 1
      );
      expect(jestPlugin).toBeTruthy();
      expect(jestPlugin.include).toEqual([`${project.root}/**/*`]);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should handle targets using the legacy package executor', async () => {
      const project = createTestProject(
        tree,
        { legacyExecutor: true },
        {
          tsConfig: `${defaultTestProjectOptions.appRoot}/tsconfig.spec.json`,
          config: `${defaultTestProjectOptions.appRoot}/jest.config.js`,
        }
      );
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // target only had options that are removed, assert no test target in converted project
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test).toBeUndefined();
      // assert plugin was added to nx.json
      const nxJsonPlugins = readNxJson(tree).plugins;
      const jestPlugin = nxJsonPlugins.find(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/jest/plugin' &&
          plugin.include?.length === 1
      );
      expect(jestPlugin).toBeTruthy();
      expect(jestPlugin.include).toEqual([`${project.root}/**/*`]);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should reuse existing plugin registration when the target name matches', async () => {
      const project = createTestProject(tree, undefined, {
        tsConfig: `${defaultTestProjectOptions.appRoot}/tsconfig.spec.json`,
        config: `${defaultTestProjectOptions.appRoot}/jest.config.js`,
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/jest/plugin',
        options: { targetName: defaultTestProjectOptions.targetName },
      });
      updateNxJson(tree, nxJson);

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // target only had options that are removed, assert no test target in converted project
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test).toBeUndefined();
      // assert plugin was added to nx.json
      const nxJsonPlugins = readNxJson(tree).plugins;
      const jestPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/jest/plugin'
      );
      expect(jestPluginRegistrations.length).toBe(1);
      expect(jestPluginRegistrations[0].include).toBeUndefined();
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should add a new plugin registration including the migrated project when the target name is different than the existing registration', async () => {
      const project = createTestProject(
        tree,
        { targetName: 'jest' },
        {
          tsConfig: `${defaultTestProjectOptions.appRoot}/tsconfig.spec.json`,
          config: `${defaultTestProjectOptions.appRoot}/jest.config.js`,
        }
      );
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/jest/plugin',
        options: { targetName: 'test' },
      });
      updateNxJson(tree, nxJson);

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // target only had options that are removed, assert no test target in converted project
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test).toBeUndefined();
      // assert plugin was added to nx.json
      const nxJsonPlugins = readNxJson(tree).plugins;
      const jestPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration<JestPluginOptions> =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/jest/plugin'
      );
      expect(jestPluginRegistrations.length).toBe(2);
      expect(jestPluginRegistrations[0].options.targetName).toBe('test');
      expect(jestPluginRegistrations[0].include).toBeUndefined();
      expect(jestPluginRegistrations[1].options.targetName).toBe('jest');
      expect(jestPluginRegistrations[1].include).toEqual([
        `${project.root}/**/*`,
      ]);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should merge target default options for the executor to the project target options', async () => {
      const project = createTestProject(tree, undefined, {
        tsConfig: `${defaultTestProjectOptions.appRoot}/tsconfig.spec.json`,
        config: `${defaultTestProjectOptions.appRoot}/jest.config.js`,
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/jest:jest'] = {
        options: { passWithNoTests: true },
      };
      updateNxJson(tree, nxJson);

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert passWithNoTests was merged into the project target options
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options).toStrictEqual({
        passWithNoTests: true,
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should rename "codeCoverage" to "coverage"', async () => {
      const project = createTestProject(tree, undefined, {
        codeCoverage: true,
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options).toStrictEqual({
        coverage: true,
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should make "testFile" relative to the project root and turn it into "testPathPattern"', async () => {
      const project = createTestProject(tree, undefined, {
        testFile: `${defaultTestProjectOptions.appRoot}/src/app/test.spec.ts`,
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options).toStrictEqual({
        testPathPattern: 'src/app/test.spec.ts',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it.each([
      defaultTestProjectOptions.appRoot,
      `${defaultTestProjectOptions.appRoot}/`,
      `./${defaultTestProjectOptions.appRoot}`,
      `./${defaultTestProjectOptions.appRoot}/`,
    ])(
      'should make "testFile" a catch-all wildcard when it is set to the project root (%s)',
      async (testFile) => {
        const project = createTestProject(tree, undefined, { testFile });
        const project2 = createTestProject(tree, {
          appRoot: 'apps/project2',
          appName: 'project2',
        });
        const project2TestTarget = project2.targets.test;

        await convertToInferred(tree, {
          project: project.name,
          skipFormat: true,
        });

        // assert updated project configuration
        const updatedProject = readProjectConfiguration(tree, project.name);
        expect(updatedProject.targets.test.options).toStrictEqual({
          testPathPattern: '.*',
        });
        // assert other projects were not modified
        const updatedProject2 = readProjectConfiguration(tree, project2.name);
        expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
      }
    );

    it('should make "testPathPattern" paths relative to the project root', async () => {
      const project = createTestProject(tree, undefined, {
        testPathPattern: [
          `${defaultTestProjectOptions.appRoot}/src/app/test1.spec.ts`,
          `${defaultTestProjectOptions.appRoot}/src/app/test2.spec.ts`,
        ],
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options).toStrictEqual({
        testPathPattern: '"src/app/test1.spec.ts|src/app/test2.spec.ts"',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it.each([
      [[defaultTestProjectOptions.appRoot]],
      [[`${defaultTestProjectOptions.appRoot}/`]],
      [[`./${defaultTestProjectOptions.appRoot}`]],
      [[`./${defaultTestProjectOptions.appRoot}/`]],
    ])(
      'should make "testPathPattern" a catch-all wildcard when it is set to the project root (%s)',
      async (testPathPattern) => {
        const project = createTestProject(tree, undefined, { testPathPattern });
        const project2 = createTestProject(tree, {
          appRoot: 'apps/project2',
          appName: 'project2',
        });
        const project2TestTarget = project2.targets.test;

        await convertToInferred(tree, {
          project: project.name,
          skipFormat: true,
        });

        // assert updated project configuration
        const updatedProject = readProjectConfiguration(tree, project.name);
        expect(updatedProject.targets.test.options).toStrictEqual({
          testPathPattern: '.*',
        });
        // assert other projects were not modified
        const updatedProject2 = readProjectConfiguration(tree, project2.name);
        expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
      }
    );

    it('should merge "testFile" and "testPathPattern" paths', async () => {
      const project = createTestProject(tree, undefined, {
        testFile: `${defaultTestProjectOptions.appRoot}/src/app/test1.spec.ts`,
        testPathPattern: [
          `${defaultTestProjectOptions.appRoot}/src/app/test2.spec.ts`,
          `${defaultTestProjectOptions.appRoot}/src/app/test3.spec.ts`,
        ],
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options).toStrictEqual({
        testPathPattern:
          '"src/app/test1.spec.ts|src/app/test2.spec.ts|src/app/test3.spec.ts"',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should make "testPathIgnorePatterns" paths relative to the project root', async () => {
      const project = createTestProject(tree, undefined, {
        testPathIgnorePatterns: [
          'node_modules',
          `${defaultTestProjectOptions.appRoot}/src/app/ignore-me/test.spec.ts`,
        ],
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options).toStrictEqual({
        testPathIgnorePatterns: '"node_modules|src/app/ignore-me/test.spec.ts"',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it.each([
      [[defaultTestProjectOptions.appRoot]],
      [[`${defaultTestProjectOptions.appRoot}/`]],
      [[`./${defaultTestProjectOptions.appRoot}`]],
      [[`./${defaultTestProjectOptions.appRoot}/`]],
    ])(
      'should make "testPathIgnorePatterns" a catch-all wildcard when it is set to the project root (%s)',
      async (testPathIgnorePatterns) => {
        const project = createTestProject(tree, undefined, {
          testPathIgnorePatterns,
        });
        const project2 = createTestProject(tree, {
          appRoot: 'apps/project2',
          appName: 'project2',
        });
        const project2TestTarget = project2.targets.test;

        await convertToInferred(tree, {
          project: project.name,
          skipFormat: true,
        });

        // assert updated project configuration
        const updatedProject = readProjectConfiguration(tree, project.name);
        expect(updatedProject.targets.test.options).toStrictEqual({
          testPathIgnorePatterns: '.*',
        });
        // assert other projects were not modified
        const updatedProject2 = readProjectConfiguration(tree, project2.name);
        expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
      }
    );

    it('should replace the project root in "testMatch" glob patterns', async () => {
      const project = createTestProject(tree, undefined, {
        testMatch: [
          `**/${defaultTestProjectOptions.appRoot}/**/?(*.)+(module.)(spec|test).[jt]s?(x)`,
          `**/${defaultTestProjectOptions.appRoot}/src/__tests__/**/*.[jt]s?(x)`,
        ],
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options).toStrictEqual({
        testMatch:
          '"**/?(*.)+(module.)(spec|test).[jt]s?(x)" "**/src/__tests__/**/*.[jt]s?(x)"',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should make "findRelatedTests" paths relative to the project root and a space separated list', async () => {
      const project = createTestProject(tree, undefined, {
        findRelatedTests: [
          `${defaultTestProjectOptions.appRoot}/src/app/test1.spec.ts`,
          `${defaultTestProjectOptions.appRoot}/src/app/test2.spec.ts`,
        ].join(','),
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options).toStrictEqual({
        args: [
          '--findRelatedTests ./src/app/test1.spec.ts ./src/app/test2.spec.ts',
        ],
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should merge "setupFile" with the "setupFilesAfterEnv" option values', async () => {
      const project = createTestProject(tree, undefined, {
        setupFile: `${defaultTestProjectOptions.appRoot}/src/test-setup.ts`,
        setupFilesAfterEnv: [
          `<rootDir>/src/test-setup2.ts`,
          `./src/test-setup3.ts`,
        ],
      });
      fs.createFilesSync({
        'apps/app1/src/test-setup.ts': '',
        'apps/app1/src/test-setup2.ts': '',
        'apps/app1/src/test-setup3.ts': '',
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options).toStrictEqual({
        setupFilesAfterEnv:
          '"./src/test-setup2.ts" "./src/test-setup3.ts" "./src/test-setup.ts"',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should merge "setupFile" with the "setupFilesAfterEnv" config value', async () => {
      const project = createTestProject(
        tree,
        undefined,
        {
          setupFile: `${defaultTestProjectOptions.appRoot}/src/test-setup.ts`,
        },
        {
          setupFilesAfterEnv: [
            `<rootDir>/src/test-setup2.ts`,
            `<rootDir>/src/test-setup3.ts`,
          ],
        }
      );
      fs.createFilesSync({
        'apps/app1/src/test-setup.ts': '',
        'apps/app1/src/test-setup2.ts': '',
        'apps/app1/src/test-setup3.ts': '',
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options).toStrictEqual({
        setupFilesAfterEnv:
          '"./src/test-setup2.ts" "./src/test-setup3.ts" "./src/test-setup.ts"',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should delete "setupFile" when it is already set in the jest config', async () => {
      const project = createTestProject(
        tree,
        undefined,
        {
          setupFile: `${defaultTestProjectOptions.appRoot}/src/test-setup.ts`,
        },
        {
          setupFilesAfterEnv: [
            `<rootDir>/src/test-setup.ts`, // this resolves to the same path as the setupFile
            `<rootDir>/src/test-setup2.ts`,
          ],
        }
      );
      fs.createFilesSync({
        'apps/app1/src/test-setup.ts': '',
        'apps/app1/src/test-setup2.ts': '',
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test).toBeUndefined(); // setupFile was removed and there are no other options, so the target is removed
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should make "ouputFile" relative to the project root', async () => {
      const project = createTestProject(tree, undefined, {
        outputFile: `test-results/${defaultTestProjectOptions.appRoot}/test-results.json`,
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options.outputFile).toBe(
        `../../test-results/${project.root}/test-results.json`
      );
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should make "coverageDirectory" relative to the project root', async () => {
      const project = createTestProject(tree, undefined, {
        coverageDirectory: `coverage/${defaultTestProjectOptions.appRoot}`,
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.options.coverageDirectory).toBe(
        `../../coverage/${project.root}`
      );
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should remove inputs when they are inferred', async () => {
      const project = createTestProject(tree, undefined, {
        codeCoverage: true,
      });
      project.targets.test.inputs = ['default', '^default'];
      updateProjectConfiguration(tree, project.name, project);
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // target only had options that are removed, assert no test target in converted project
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.inputs).toBeUndefined();
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should add external dependencies input from inferred task', async () => {
      const project = createTestProject(tree, undefined, {
        codeCoverage: true,
      });
      project.targets.test.inputs = [
        'default',
        '^default',
        '{workspaceRoot}/some-file.ts',
      ];
      updateProjectConfiguration(tree, project.name, project);
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // target only had options that are removed, assert no test target in converted project
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.inputs).toStrictEqual([
        'default',
        '^default',
        '{workspaceRoot}/some-file.ts',
        { externalDependencies: ['jest'] },
      ]);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should merge external dependencies input from inferred task', async () => {
      const project = createTestProject(tree, undefined, {
        codeCoverage: true,
      });
      project.targets.test.inputs = [
        'default',
        '^default',
        '{workspaceRoot}/some-file.ts',
        { externalDependencies: ['some-external-dep'] },
      ];
      updateProjectConfiguration(tree, project.name, project);
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // target only had options that are removed, assert no test target in converted project
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.inputs).toStrictEqual([
        'default',
        '^default',
        '{workspaceRoot}/some-file.ts',
        { externalDependencies: ['some-external-dep', 'jest'] },
      ]);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should not duplicate already existing external dependencies input', async () => {
      const project = createTestProject(tree, undefined, {
        codeCoverage: true,
      });
      project.targets.test.inputs = [
        'default',
        '^default',
        '{workspaceRoot}/some-file.ts',
        { externalDependencies: ['jest', 'some-external-dep'] },
      ];
      updateProjectConfiguration(tree, project.name, project);
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // target only had options that are removed, assert no test target in converted project
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.inputs).toStrictEqual([
        'default',
        '^default',
        '{workspaceRoot}/some-file.ts',
        { externalDependencies: ['jest', 'some-external-dep'] },
      ]);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should delete outputs when they are inferred', async () => {
      const project = createTestProject(
        tree,
        undefined,
        { coverage: true },
        {
          coverageDirectory: `../../coverage/${defaultTestProjectOptions.appRoot}`, // the plugin will infer {workspaceRoot}/coverage/apps/app1
        }
      );
      project.targets.test.outputs = [
        `{workspaceRoot}/coverage/{projectRoot}`, // this is equivalent to the inferred {workspaceRoot}/coverage/apps/app1
      ];
      updateProjectConfiguration(tree, project.name, project);
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.outputs).toBeUndefined();
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should keep outputs adding any extra inferred outputs', async () => {
      const project = createTestProject(
        tree,
        undefined,
        {
          outputFile: `test-results/${defaultTestProjectOptions.appRoot}/test-results.json`,
        },
        {
          coverageDirectory: `../../coverage/${defaultTestProjectOptions.appRoot}`, // the plugin will infer {workspaceRoot}/coverage/apps/app1
        }
      );
      project.targets.test.outputs = [`{workspaceRoot}/{options.outputFile}`];
      updateProjectConfiguration(tree, project.name, project);
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.test.outputs).toStrictEqual([
        `{projectRoot}/{options.outputFile}`, // updated to be relative to the project root
        `{workspaceRoot}/coverage/${project.root}`, // added from the inferred outputs
      ]);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });

    it('should keep the "jestConfig" and set it to "config" when present in configurations', async () => {
      const project = createTestProject(tree);
      project.targets.test.configurations = {
        production: {
          jestConfig: `${defaultTestProjectOptions.appRoot}/jest.config.prod.js`,
        },
      };
      updateProjectConfiguration(tree, project.name, project);
      writeJestConfig(
        tree,
        defaultTestProjectOptions.appRoot,
        undefined,
        'jest.config.prod.js'
      );
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      const project2TestTarget = project2.targets.test;

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // assert updated project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(
        updatedProject.targets.test.configurations.production
      ).toStrictEqual({
        config: `./jest.config.prod.js`,
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toStrictEqual(project2TestTarget);
    });
  });

  describe('all projects', () => {
    it('should migrate multiple projects using the jest executors', async () => {
      const project1 = createTestProject(tree, undefined, {
        tsConfig: `${defaultTestProjectOptions.appRoot}/tsconfig.spec.json`,
        config: `${defaultTestProjectOptions.appRoot}/jest.config.js`,
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
        legacyExecutor: true,
      });
      const project3 = createTestProject(tree, {
        appRoot: 'apps/project3',
        appName: 'project3',
        legacyExecutor: true,
      });

      await convertToInferred(tree, { skipFormat: true });

      // target only had options that are removed, assert no test target in converted project
      const updatedProject1 = readProjectConfiguration(tree, project1.name);
      expect(updatedProject1.targets.test).toBeUndefined();
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toBeUndefined();
      const updatedProject3 = readProjectConfiguration(tree, project3.name);
      expect(updatedProject3.targets.test).toBeUndefined();
      // assert plugin was added to nx.json
      const nxJsonPlugins = readNxJson(tree).plugins;
      const jestPlugin = nxJsonPlugins.find(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/jest/plugin'
      );
      expect(jestPlugin).toBeTruthy();
      expect(jestPlugin.include).toBeUndefined();
    });

    it('should add new plugin registrations with "includes" set to the migrated projects grouped by different target names', async () => {
      const project1 = createTestProject(tree, undefined, {
        tsConfig: `${defaultTestProjectOptions.appRoot}/tsconfig.spec.json`,
        config: `${defaultTestProjectOptions.appRoot}/jest.config.js`,
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
        legacyExecutor: true,
      });
      const project3 = createTestProject(tree, {
        appRoot: 'apps/project3',
        appName: 'project3',
        targetName: 'jest',
      });

      await convertToInferred(tree, { skipFormat: true });

      // target only had options that are removed, assert no test target in converted project
      const updatedProject1 = readProjectConfiguration(tree, project1.name);
      expect(updatedProject1.targets.test).toBeUndefined();
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.test).toBeUndefined();
      const updatedProject3 = readProjectConfiguration(tree, project3.name);
      expect(updatedProject3.targets.test).toBeUndefined();
      // assert plugin was added to nx.json
      const nxJsonPlugins = readNxJson(tree).plugins;
      const jestPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration<JestPluginOptions> =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/jest/plugin'
      );
      expect(jestPluginRegistrations.length).toBe(2);
      expect(jestPluginRegistrations[0].options.targetName).toBe('test');
      expect(jestPluginRegistrations[0].include).toEqual([
        `${project1.root}/**/*`,
        `${project2.root}/**/*`,
      ]);
      expect(jestPluginRegistrations[1].options.targetName).toBe('jest');
      expect(jestPluginRegistrations[1].include).toEqual([
        `${project3.root}/**/*`,
      ]);
    });
  });
});
