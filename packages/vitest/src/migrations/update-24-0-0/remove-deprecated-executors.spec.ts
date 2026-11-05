import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration as _addProjectConfiguration,
  joinPathFragments,
  type ProjectConfiguration,
  type ProjectGraph,
  readNxJson,
  readProjectConfiguration,
  type TargetConfiguration,
  type Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import {
  mockCjsModule as mockConverterModule,
  TempFs,
} from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';
import { getRelativeProjectJsonSchemaPath } from '@nx/devkit/internal';

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

import * as converter from '../../generators/convert-to-inferred/convert-to-inferred';
import update from './remove-deprecated-executors';

describe('remove-deprecated-executors', () => {
  // The migration loads its converter through `require`, which vi.mock cannot
  // reach, so hand it the module that sees the mocked project graph.
  beforeEach(() => {
    mockConverterModule(
      import.meta.url,
      '../../generators/convert-to-inferred/convert-to-inferred',
      converter
    );
  });
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

  it('converts targets using the removed executors to the inference plugin', async () => {
    const project = createTestProject(tree);

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) => typeof plugin !== 'string' && plugin.plugin === '@nx/vitest'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "testMode": "run",
          "testTargetName": "test",
        },
        "plugin": "@nx/vitest",
      }
    `);
    expect(readProjectConfiguration(tree, project.name).targets)
      .toMatchInlineSnapshot(`
      {
        "test": {
          "options": {
            "config": "./vite.config.ts",
          },
        },
      }
    `);
  });

  describe('targets on a config file the plugin does not infer', () => {
    function addTarget(
      projectName: string,
      targetName: string,
      target: TargetConfiguration
    ) {
      const project = readProjectConfiguration(tree, projectName);
      project.targets[targetName] = target;
      updateProjectConfiguration(tree, projectName, project);
      fs.createFileSync(
        `${project.root}/project.json`,
        JSON.stringify(project)
      );
    }

    it('runs Vitest with the config file from the workspace root', async () => {
      const project = createTestProject(tree);
      addTarget(project.name, 'e2e-test', {
        executor: '@nx/vitest:test',
        outputs: ['{options.reportsDirectory}'],
        options: {
          configFile: `${project.root}/vitest.config.e2e.mts`,
          reportsDirectory: `coverage/${project.root}/e2e`,
          testFiles: ['src/app.e2e.spec.ts'],
          mode: 'e2e',
          passWithNoTests: true,
        },
        configurations: { ci: { coverage: true } },
      });

      const result = await update(tree);

      expect(readProjectConfiguration(tree, project.name).targets)
        .toMatchInlineSnapshot(`
        {
          "e2e-test": {
            "configurations": {
              "ci": {
                "coverage.enabled": true,
              },
            },
            "executor": "nx:run-commands",
            "options": {
              "args": [
                "src/app.e2e.spec.ts",
              ],
              "command": "vitest run --root myapp --config ./vitest.config.e2e.mts",
              "coverage.reportsDirectory": "../coverage/myapp/e2e",
              "cwd": ".",
              "mode": "e2e",
              "passWithNoTests": true,
            },
            "outputs": [
              "{workspaceRoot}/coverage/myapp/e2e",
            ],
          },
          "test": {
            "options": {
              "config": "./vite.config.ts",
            },
          },
        }
      `);
      expect(result.nextSteps).toBeUndefined();
    });

    it('passes --root . for a root project', async () => {
      const project = createTestProject(tree, {
        appName: 'root-app',
        appRoot: '.',
      });
      addTarget(project.name, 'e2e-test', {
        executor: '@nx/vitest:test',
        options: { configFile: 'vitest.config.e2e.mts' },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, project.name).targets['e2e-test'].options
      ).toEqual({
        command: 'vitest run --root . --config ./vitest.config.e2e.mts',
        cwd: '.',
      });
    });

    it('converts the other projects when one project has no config file', async () => {
      createTestProject(tree);
      addProjectConfiguration(tree, 'no-config', {
        root: 'no-config',
        projectType: 'library',
        targets: { test: { executor: '@nx/vitest:test', options: {} } },
      });
      fs.createFileSync('no-config/project.json', '{}');

      const result = await update(tree);

      expect(readProjectConfiguration(tree, 'myapp').targets.test).toEqual({
        options: { config: './vite.config.ts' },
      });
      expect(readProjectConfiguration(tree, 'no-config').targets.test).toEqual({
        executor: '@nx/vitest:test',
        options: {},
      });
      expect(result.nextSteps).toEqual([
        'These targets still use removed executors: no-config:test (@nx/vitest:test). Replace each one before running them.',
      ]);
    });

    it('keeps a target on its executor when an option has no CLI equivalent', async () => {
      const project = createTestProject(tree);
      const benchmark: TargetConfiguration = {
        executor: '@nx/vitest:test',
        options: {
          configFile: `${project.root}/vitest.config.bench.mts`,
          runMode: 'benchmark',
        },
      };
      addTarget(project.name, 'bench', benchmark);

      const result = await update(tree);

      expect(readProjectConfiguration(tree, project.name).targets).toEqual({
        test: { options: { config: './vite.config.ts' } },
        bench: benchmark,
      });
      expect(result.nextSteps).toEqual([
        'These targets still use removed executors: myapp:bench (@nx/vitest:test). Replace each one before running them.',
      ]);
    });
  });

  it('skips the prompt when no project uses the removed executors', async () => {
    const nxJson = readNxJson(tree);

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(readNxJson(tree)).toEqual(nxJson);
  });
});
