import {
  getRelativeProjectJsonSchemaPath,
  updateProjectConfiguration,
} from 'nx/src/generators/utils/project-configuration';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertToInferred } from './convert-to-inferred';
import {
  addProjectConfiguration as _addProjectConfiguration,
  type ExpandedPluginConfiguration,
  joinPathFragments,
  type ProjectConfiguration,
  type ProjectGraph,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';
import type { VitestPluginOptions } from '../../plugins/plugin';

let fs: TempFs;
let projectGraph: ProjectGraph;
let mockedConfigs: Record<string, any> = {};

const getMockedConfig = (
  opts: { configFile: string; mode: 'development' },
  _target: string
) => {
  const relativeConfigFile = opts.configFile.replace(`${fs.tempDir}/`, '');
  return Promise.resolve({
    path: opts.configFile,
    config: mockedConfigs[relativeConfigFile],
    build: mockedConfigs[relativeConfigFile]['build'],
    test: mockedConfigs[relativeConfigFile]['test'],
    dependencies: [],
  });
};

jest.mock('vite', () => ({
  resolveConfig: jest.fn().mockImplementation(getMockedConfig),
}));

jest.mock('../../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn().mockImplementation(() => ({
    resolveConfig: jest.fn().mockImplementation(getMockedConfig),
  })),
}));

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
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
          delete projectConfiguration.targets;
          projectConfiguration['// targets'] =
            `to see all targets run: nx show project ${projectName} --web`;
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

function addProjectConfiguration(
  tree: Tree,
  name: string,
  project: ProjectConfiguration
) {
  _addProjectConfiguration(tree, name, project);
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

interface CreateVitestProjectOptions {
  appName: string;
  appRoot: string;
  testTargetName: string;
}

const defaultCreateVitestProjectOptions: CreateVitestProjectOptions = {
  appName: 'myapp',
  appRoot: 'myapp',
  testTargetName: 'test',
};

function createTestProject(
  tree: Tree,
  opts: Partial<CreateVitestProjectOptions> = defaultCreateVitestProjectOptions
) {
  const projectOpts = { ...defaultCreateVitestProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'library',
    targets: {
      [projectOpts.testTargetName]: {
        executor: '@nx/vitest:test',
        options: {
          configFile: `${projectOpts.appRoot}/vite.config.ts`,
        },
      },
    },
  };

  const viteConfigContents = `/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      reportsDirectory: '../../coverage/${projectOpts.appRoot}',
      provider: 'v8',
    },
  },
});`;

  tree.write(`${projectOpts.appRoot}/vite.config.ts`, viteConfigContents);
  fs.createFileSync(
    `${projectOpts.appRoot}/vite.config.ts`,
    viteConfigContents
  );

  mockedConfigs[`${projectOpts.appRoot}/vite.config.ts`] = {
    root: projectOpts.appRoot,
    build: {},
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.ts'],
      coverage: {
        reportsDirectory: `../../coverage/${projectOpts.appRoot}`,
        provider: 'v8',
      },
    },
  };

  jest.doMock(
    join(fs.tempDir, `${projectOpts.appRoot}/vite.config.ts`),
    () => ({
      default: mockedConfigs[`${projectOpts.appRoot}/vite.config.ts`],
    }),
    { virtual: true }
  );

  addProjectConfiguration(tree, project.name, project);
  fs.createFileSync(
    `${projectOpts.appRoot}/project.json`,
    JSON.stringify(project)
  );
  return project;
}

describe('@nx/vitest:convert-to-inferred', () => {
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('vitest');
    tree = createTreeWithEmptyWorkspace();
    tree.root = fs.tempDir;
    mockedConfigs = {};

    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  afterEach(() => {
    fs.reset();
  });

  describe('--project', () => {
    it('migrates only the requested project and scopes the new plugin entry to it', async () => {
      createTestProject(tree, {
        appRoot: 'other',
        appName: 'other',
        testTargetName: 'test',
      });
      const project = createTestProject(tree, {
        testTargetName: 'unit-test',
      });

      await convertToInferred(tree, { project: 'myapp', skipFormat: true });

      const updated = readProjectConfiguration(tree, project.name);
      expect(updated.targets).toMatchInlineSnapshot(`
        {
          "unit-test": {
            "options": {
              "config": "./vite.config.ts",
            },
          },
        }
      `);

      const nxJsonPlugins = readNxJson(tree).plugins;
      const scopedRegistration = nxJsonPlugins.find(
        (p): p is ExpandedPluginConfiguration<VitestPluginOptions> =>
          typeof p !== 'string' &&
          p.plugin === '@nx/vitest' &&
          p.include?.length === 1
      );
      expect(scopedRegistration).toBeTruthy();
      expect(scopedRegistration.include).toEqual(['myapp/**/*']);
      expect(scopedRegistration.options?.testTargetName).toBe('unit-test');
    });
  });

  describe('--all', () => {
    it('registers a single @nx/vitest plugin entry when all projects share the same test target name', async () => {
      const project = createTestProject(tree);

      await convertToInferred(tree, { skipFormat: true });

      const updated = readProjectConfiguration(tree, project.name);
      expect(updated.targets).toMatchInlineSnapshot(`
        {
          "test": {
            "options": {
              "config": "./vite.config.ts",
            },
          },
        }
      `);

      const nxJsonPlugins = readNxJson(tree).plugins;
      const vitestRegistrations = nxJsonPlugins.filter(
        (p): p is ExpandedPluginConfiguration<VitestPluginOptions> =>
          typeof p !== 'string' && p.plugin === '@nx/vitest'
      );
      expect(vitestRegistrations).toHaveLength(1);
      expect(vitestRegistrations[0].options?.testTargetName).toBe('test');
    });

    it('creates separate plugin registrations for projects with different test target names', async () => {
      const project1 = createTestProject(tree);
      const project2 = createTestProject(tree, {
        appRoot: 'project2',
        appName: 'project2',
        testTargetName: 'unit',
      });

      await convertToInferred(tree, { skipFormat: true });

      const nxJsonPlugins = readNxJson(tree).plugins;
      const vitestRegistrations = nxJsonPlugins.filter(
        (p): p is ExpandedPluginConfiguration<VitestPluginOptions> =>
          typeof p !== 'string' && p.plugin === '@nx/vitest'
      );
      expect(vitestRegistrations).toHaveLength(2);

      const testReg = vitestRegistrations.find(
        (r) => r.options?.testTargetName === 'test'
      );
      const unitReg = vitestRegistrations.find(
        (r) => r.options?.testTargetName === 'unit'
      );
      expect(testReg.include).toEqual([`${project1.root}/**/*`]);
      expect(unitReg.include).toEqual([`${project2.root}/**/*`]);
    });

    it('keeps non-inferred executor options on the migrated target', async () => {
      const project = createTestProject(tree);
      project.targets.test.options.watch = false;
      updateProjectConfiguration(tree, project.name, project);

      await convertToInferred(tree, { skipFormat: true });

      const updated = readProjectConfiguration(tree, project.name);
      expect(updated.targets.test).toMatchInlineSnapshot(`
        {
          "options": {
            "config": "./vite.config.ts",
            "watch": false,
          },
        }
      `);
    });

    it('inherits options declared in targetDefaults for the executor', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/vitest:test'] = {
        options: { watch: false },
      };
      updateNxJson(tree, nxJson);
      const project = createTestProject(tree);

      await convertToInferred(tree, { skipFormat: true });

      const updated = readProjectConfiguration(tree, project.name);
      expect(updated.targets.test).toMatchInlineSnapshot(`
        {
          "options": {
            "config": "./vite.config.ts",
            "watch": false,
          },
        }
      `);
    });
  });
});
