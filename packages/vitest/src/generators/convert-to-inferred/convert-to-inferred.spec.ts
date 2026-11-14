import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertToInferred } from './convert-to-inferred';
import {
  addProjectConfiguration as _addProjectConfiguration,
  type ExpandedPluginConfiguration,
  joinPathFragments,
  logger,
  type ProjectConfiguration,
  type ProjectGraph,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
  writeJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';
import type { VitestPluginOptions } from '../../plugins/plugin';
import {
  getRelativeProjectJsonSchemaPath,
  NoTargetsToMigrateError,
} from '@nx/devkit/internal';

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

vi.mock('vite', () => ({
  resolveConfig: vi.fn().mockImplementation(getMockedConfig),
}));

vi.mock('../../utils/executor-utils', () => ({
  loadViteDynamicImport: vi.fn().mockImplementation(() => ({
    resolveConfig: vi.fn().mockImplementation(getMockedConfig),
  })),
}));

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: vi.fn().mockImplementation(async () => {
    return projectGraph;
  }),
  updateProjectConfiguration: vi
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

  vi.doMock(
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

function addE2eTarget(tree: Tree, projectName: string) {
  const project = readProjectConfiguration(tree, projectName);
  project.targets['e2e-test'] = {
    executor: '@nx/vitest:test',
    options: { configFile: `${project.root}/vitest.config.e2e.mts` },
  };
  updateProjectConfiguration(tree, projectName, project);
  fs.createFileSync(`${project.root}/project.json`, JSON.stringify(project));
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
    it('runs a target on a config file the plugin does not infer only in the named project', async () => {
      createTestProject(tree);
      addE2eTarget(tree, 'myapp');
      createTestProject(tree, { appRoot: 'other', appName: 'other' });
      addE2eTarget(tree, 'other');
      const otherTargets = readProjectConfiguration(tree, 'other').targets;

      await convertToInferred(tree, { project: 'myapp', skipFormat: true });

      expect(
        readProjectConfiguration(tree, 'myapp').targets['e2e-test']
      ).toEqual({
        executor: 'nx:run-commands',
        options: {
          command: 'vitest run --root myapp --config ./vitest.config.e2e.mts',
          cwd: '.',
        },
      });
      expect(readProjectConfiguration(tree, 'other').targets).toEqual(
        otherTargets
      );
    });

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

    it('leaves the test target on its executor when the vite config has no test block', async () => {
      const project = createTestProject(tree);
      const viteConfig = `import { defineConfig } from 'vite';

export default defineConfig({ root: __dirname });`;
      tree.write('myapp/vite.config.ts', viteConfig);
      fs.createFileSync('myapp/vite.config.ts', viteConfig);
      delete mockedConfigs['myapp/vite.config.ts'].test;
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      await expect(
        convertToInferred(tree, { project: 'myapp', skipFormat: true })
      ).rejects.toThrow(NoTargetsToMigrateError);

      expect(readProjectConfiguration(tree, project.name).targets).toEqual(
        project.targets
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'convert-to-inferred left target "test" in project "myapp" on its executor'
        )
      );
      warn.mockRestore();
    });
  });

  describe('--all', () => {
    it('runs a target on a config file the plugin does not infer when it is the only vitest target', async () => {
      const project = createTestProject(tree);
      const configured = readProjectConfiguration(tree, project.name);
      delete configured.targets.test;
      updateProjectConfiguration(tree, project.name, configured);
      addE2eTarget(tree, project.name);

      await convertToInferred(tree, { skipFormat: true });

      expect(readProjectConfiguration(tree, project.name).targets).toEqual({
        'e2e-test': {
          executor: 'nx:run-commands',
          options: {
            command: 'vitest run --root myapp --config ./vitest.config.e2e.mts',
            cwd: '.',
          },
        },
      });
    });

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
      expect(vitestRegistrations[0].options?.testMode).toBe('run');
    });

    it('does not add converted projects to an existing watch-mode registration', async () => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [
        {
          plugin: '@nx/vitest',
          include: ['existing/**/*'],
          options: { testTargetName: 'test' },
        },
      ];
      updateNxJson(tree, nxJson);
      createTestProject(tree);

      await convertToInferred(tree, { skipFormat: true });

      const vitestRegistrations = readNxJson(tree).plugins.filter(
        (p): p is ExpandedPluginConfiguration<VitestPluginOptions> =>
          typeof p !== 'string' && p.plugin === '@nx/vitest'
      );
      expect(vitestRegistrations).toEqual([
        {
          plugin: '@nx/vitest',
          include: ['existing/**/*'],
          options: { testTargetName: 'test' },
        },
        expect.objectContaining({
          options: {
            testTargetName: 'test',
            testMode: 'run',
            cwd: 'workspaceRoot',
          },
        }),
      ]);
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

    it('registers converted projects to run from the workspace root, apart from an existing registration', async () => {
      const existing = createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
      });
      updateProjectConfiguration(tree, existing.name, {
        ...existing,
        targets: {},
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins = [
        {
          plugin: '@nx/vitest',
          include: ['existing/**/*'],
          options: { testTargetName: 'test' },
        },
      ];
      updateNxJson(tree, nxJson);
      createTestProject(tree);
      createTestProject(tree, { appRoot: 'second', appName: 'second' });

      await convertToInferred(tree, { skipFormat: true });

      const vitestRegistrations = readNxJson(tree).plugins.filter(
        (p): p is ExpandedPluginConfiguration<VitestPluginOptions> =>
          typeof p !== 'string' && p.plugin === '@nx/vitest'
      );
      expect(vitestRegistrations).toHaveLength(2);
      expect(vitestRegistrations[0]).toStrictEqual({
        plugin: '@nx/vitest',
        include: ['existing/**/*'],
        options: { testTargetName: 'test' },
      });
      expect(vitestRegistrations[1].options).toMatchObject({
        testTargetName: 'test',
        cwd: 'workspaceRoot',
      });
      expect(vitestRegistrations[1].include).toEqual([
        'myapp/**/*',
        'second/**/*',
      ]);
    });

    it('leaves a root project on the default cwd', async () => {
      createTestProject(tree, { appRoot: '.', appName: 'root' });
      mockedConfigs['vite.config.ts'] = mockedConfigs['./vite.config.ts'];

      await convertToInferred(tree, { skipFormat: true });

      const vitestRegistrations = readNxJson(tree).plugins.filter(
        (p): p is ExpandedPluginConfiguration<VitestPluginOptions> =>
          typeof p !== 'string' && p.plugin === '@nx/vitest'
      );
      expect(vitestRegistrations).toHaveLength(1);
      expect(vitestRegistrations[0].options.cwd).toBeUndefined();
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
