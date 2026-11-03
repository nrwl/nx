import {
  addProjectConfiguration,
  joinPathFragments,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateJson,
  updateNxJson,
  writeJson,
  type NxJsonConfiguration,
  type ProjectConfiguration,
  type ProjectGraph,
  type TargetConfiguration,
  type Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { getRelativeProjectJsonSchemaPath } from '@nx/devkit/internal';

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
        if (
          tree.exists(
            joinPathFragments(projectConfiguration.root, 'package.json')
          )
        ) {
          jest
            .requireActual('@nx/devkit')
            .updateProjectConfiguration(
              tree,
              projectName,
              projectConfiguration
            );
          projectGraph.nodes[projectName].data = projectConfiguration;
          return;
        }
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

  updateJson(tree, `package.json`, (json) => {
    json.devDependencies ??= {};
    json.devDependencies.jest = '^30.0.0';
    return json;
  });

  return project;
}

import { getJestProjectsAsync } from '../../utils/config/get-jest-projects';
import update from './remove-deprecated-executors';

describe('remove-deprecated-executors', () => {
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

  it('converts targets using the removed executors to the inference plugin', async () => {
    const project = createTestProject(tree);

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/jest/plugin'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "targetName": "test",
        },
        "plugin": "@nx/jest/plugin",
      }
    `);
    expect(
      readProjectConfiguration(tree, project.name).targets
    ).toMatchInlineSnapshot(`{}`);
  });

  describe('when the plugin cannot infer one project', () => {
    let warn: jest.SpyInstance;

    beforeEach(() => {
      // The converter is required lazily, so it binds a fresh logger module.
      warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
    });

    function addApp2(configFileName: string, contents?: string) {
      const root = 'apps/app2';
      if (contents === undefined) {
        writeJestConfig(tree, root, undefined, configFileName);
      } else {
        tree.write(`${root}/${configFileName}`, contents);
        fs.createFileSync(`${root}/${configFileName}`, contents);
      }
      const project: ProjectConfiguration = {
        name: 'app2',
        root,
        projectType: 'application',
        targets: {
          test: {
            executor: '@nx/jest:jest',
            options: { jestConfig: `${root}/${configFileName}` },
          },
        },
      };
      addProject(tree, 'app2', project);
      fs.createFileSync(`${root}/project.json`, JSON.stringify(project));
    }

    async function runUpdate() {
      const result = await update(tree);
      return {
        app1: readProjectConfiguration(tree, 'app1').targets,
        app2: readProjectConfiguration(tree, 'app2').targets,
        nextSteps: result.nextSteps,
        warnings: warn.mock.calls
          .map(([message]) => stripVTControlCharacters(String(message)))
          .filter((message) => message.includes('left target')),
      };
    }

    const tsNodeEnv = {
      TS_NODE_COMPILER_OPTIONS: JSON.stringify({
        moduleResolution: 'node10',
        module: 'commonjs',
        customConditions: null,
      }),
    };

    it('runs Jest with a config file name the plugin does not detect', async () => {
      createTestProject(tree);
      addApp2('jest.app.config.js');

      expect(await runUpdate()).toMatchInlineSnapshot(`
        {
          "app1": {},
          "app2": {
            "test": {
              "executor": "nx:run-commands",
              "options": {
                "command": "jest --config ./apps/app2/jest.app.config.js",
                "cwd": ".",
                "env": {
                  "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"node10","module":"commonjs","customConditions":null}",
                },
              },
            },
          },
          "nextSteps": undefined,
          "warnings": [],
        }
      `);
    });

    it.each<{
      shape: string;
      targetDefaults?: NxJsonConfiguration['targetDefaults'];
      target: TargetConfiguration;
      expected?: Partial<TargetConfiguration>;
    }>([
      {
        shape: 'with its test settings in target defaults',
        targetDefaults: {
          '@nx/jest:jest': {
            cache: true,
            inputs: [
              'default',
              '^production',
              '{workspaceRoot}/jest.preset.js',
            ],
            options: { passWithNoTests: true },
            configurations: { ci: { ci: true, codeCoverage: true } },
          },
        },
        target: {
          executor: '@nx/jest:jest',
          outputs: ['{workspaceRoot}/coverage/{projectName}'],
          options: { jestConfig: 'jest.config.app.ts' },
        },
        expected: {
          cache: true,
          inputs: ['default', '^production', '{workspaceRoot}/jest.preset.js'],
        },
      },
      {
        shape: 'with its test settings and an Angular tsConfig on the target',
        target: {
          executor: '@nx/jest:jest',
          outputs: ['{workspaceRoot}/coverage/{projectName}'],
          options: {
            jestConfig: 'jest.config.app.ts',
            passWithNoTests: true,
            tsConfig: 'tsconfig.spec.json',
          },
          configurations: { ci: { ci: true, codeCoverage: true } },
        },
      },
    ])(
      'runs Jest with the renamed config of a root project $shape',
      async ({ targetDefaults, target, expected }) => {
        if (targetDefaults) {
          updateNxJson(tree, { ...readNxJson(tree), targetDefaults });
        }
        const workspaceConfig = `import { getJestProjectsAsync } from '@nx/jest';\n\nexport default async () => ({ projects: await getJestProjectsAsync() });\n`;
        tree.write('jest.config.ts', workspaceConfig);
        fs.createFileSync('jest.config.ts', workspaceConfig);
        writeJestConfig(tree, '.', undefined, 'jest.config.app.ts');
        const rootProject: ProjectConfiguration = {
          name: 'my-app',
          root: '.',
          projectType: 'application',
          targets: { test: target },
        };
        addProject(tree, 'my-app', rootProject);
        fs.createFileSync('project.json', JSON.stringify(rootProject));
        createTestProject(tree, { appName: 'lib1', appRoot: 'libs/lib1' });

        const result = await update(tree);

        expect(readProjectConfiguration(tree, 'my-app').targets.test).toEqual({
          ...expected,
          executor: 'nx:run-commands',
          outputs: ['{workspaceRoot}/coverage/{projectName}'],
          options: {
            command: 'jest --config ./jest.config.app.ts',
            cwd: '.',
            env: tsNodeEnv,
            passWithNoTests: true,
          },
          configurations: { ci: { ci: true, coverage: true } },
        });
        expect(
          readProjectConfiguration(tree, 'lib1').targets.test?.executor
        ).toBeUndefined();
        expect(result.nextSteps).toBeUndefined();
      }
    );

    it('converts the other projects when one config file fails to load', async () => {
      createTestProject(tree);
      addApp2('jest.config.js', `throw new Error('cannot load preset');`);

      expect(await runUpdate()).toMatchInlineSnapshot(`
        {
          "app1": {},
          "app2": {
            "test": {
              "executor": "@nx/jest:jest",
              "options": {
                "jestConfig": "apps/app2/jest.config.js",
              },
            },
          },
          "nextSteps": [
            "These targets still use removed executors: app2:test (@nx/jest:jest). Replace each one before running them.",
          ],
          "warnings": [
            "convert-to-inferred left target "test" in project "app2" on its executor because the plugin failed to infer it: apps/app2/jest.config.js: cannot load preset. Fix the error, then rerun the migration to convert it.",
          ],
        }
      `);
    });

    it('applies the executor defaults filtered to the project', async () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        targetDefaults: {
          '@nx/jest:jest': [
            {
              filter: { projects: ['app2'] },
              options: { maxWorkers: 1 },
              configurations: { ci: { ci: true } },
            },
            { filter: { projects: ['app1'] }, options: { silent: true } },
          ],
        },
      });
      createTestProject(tree);
      addApp2('jest.app.config.js');

      const { app2 } = await runUpdate();

      expect(app2.test.options).toMatchObject({ maxWorkers: 1 });
      expect(app2.test.options).not.toHaveProperty('silent');
      expect(app2.test.configurations).toEqual({ ci: { ci: true } });
    });

    it('applies the target-name defaults the executor received', async () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        targetDefaults: {
          test: {
            options: { codeCoverage: true },
            configurations: {
              ci: { jestConfig: 'apps/app2/jest.ci.config.js' },
            },
          },
        },
      });
      createTestProject(tree);
      addApp2('jest.app.config.js');

      const { app2 } = await runUpdate();

      expect(app2.test.options).toMatchObject({ coverage: true });
      expect(app2.test.configurations).toEqual({
        ci: { command: 'jest --config ./apps/app2/jest.ci.config.js' },
      });
      expect(await getJestProjectsAsync()).toEqual([
        '<rootDir>/apps/app2/jest.app.config.js',
        '<rootDir>/apps/app2/jest.ci.config.js',
      ]);
    });

    it('passes every accepted flag to Jest when nx:run-commands defaults leave the target unchanged', async () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        targetDefaults: { 'nx:run-commands': { options: { cwd: 'tools' } } },
      });
      createTestProject(tree);
      addApp2('jest.app.config.js');
      const flags = {
        bail: true,
        ci: true,
        detectOpenHandles: true,
        forceExit: true,
        logHeapUsage: true,
        passWithNoTests: true,
        runInBand: false,
        silent: true,
        maxWorkers: 2,
        testTimeout: 10000,
      };
      const project = readProjectConfiguration(tree, 'app2');
      project.targets.test.outputs = ['{workspaceRoot}/coverage/{projectRoot}'];
      Object.assign(project.targets.test.options, flags);
      updateProjectConfiguration(tree, 'app2', project);

      const { app2 } = await runUpdate();

      expect(app2.test).toEqual({
        executor: 'nx:run-commands',
        outputs: ['{workspaceRoot}/coverage/{projectRoot}'],
        options: {
          command: 'jest --config ./apps/app2/jest.app.config.js',
          cwd: '.',
          env: tsNodeEnv,
          ...flags,
        },
      });
    });

    it.each<{
      reason: string;
      targetDefaults?: NxJsonConfiguration['targetDefaults'];
      configFileName?: string;
      target?: Partial<TargetConfiguration>;
    }>([
      {
        reason: 'target defaults would add an option',
        targetDefaults: {
          '@nx/jest:jest': { options: { runInBand: true } },
          test: { options: { silent: true } },
        },
      },
      {
        reason: 'target defaults would fill a spread',
        targetDefaults: { 'nx:run-commands': { inputs: ['default'] } },
        target: { inputs: ['...', '{projectRoot}/jest.app.config.js'] },
      },
      {
        reason: 'it sets an option the rewrite does not accept',
        target: { options: { outputFile: 'results.json' } },
      },
      {
        reason: 'an accepted option has a value of another type',
        target: { options: { maxWorkers: '50%' } },
      },
      {
        reason: 'a configuration sets an option the rewrite does not accept',
        target: { configurations: { ci: { testNamePattern: 'adds' } } },
      },
      {
        reason: 'its options pass Jest runInBand with maxWorkers',
        target: { options: { runInBand: true, maxWorkers: 2 } },
      },
      {
        reason: 'a configuration adds maxWorkers to runInBand',
        target: {
          options: { runInBand: true },
          configurations: { ci: { maxWorkers: 2 } },
        },
      },
      {
        reason: 'its config path has a shell character',
        configFileName: 'jest$[1+2].config.js',
      },
      {
        reason: 'a configuration runs an absolute config path',
        target: {
          configurations: {
            e2e: { jestConfig: '/configs/jest.e2e.config.js' },
          },
        },
      },
      {
        reason: 'an output reads an option the rewrite removes',
        target: {
          outputs: ['{options.tsConfig}'],
          options: { tsConfig: 'apps/app2/tsconfig.spec.json' },
        },
      },
    ])(
      'keeps a target on its executor next to a standard config when $reason',
      async ({ targetDefaults, configFileName, target: overrides }) => {
        if (targetDefaults) {
          updateNxJson(tree, { ...readNxJson(tree), targetDefaults });
        }
        createTestProject(tree);
        // The plugin infers from this file, so the converter would switch to it
        writeJestConfig(tree, 'apps/app2', undefined);
        addApp2(configFileName ?? 'jest.app.config.js');
        const project = readProjectConfiguration(tree, 'app2');
        const { options, ...fields } = overrides ?? {};
        Object.assign(project.targets.test, fields);
        Object.assign(project.targets.test.options, options);
        updateProjectConfiguration(tree, 'app2', project);
        const target = structuredClone(project.targets.test);

        const { app2, nextSteps } = await runUpdate();

        expect(app2.test).toEqual(target);
        expect(nextSteps).toContain(
          'These targets still use removed executors: app2:test (@nx/jest:jest). Replace each one before running them.'
        );
      }
    );
  });

  it('skips the prompt when no project uses the removed executors', async () => {
    const nxJson = readNxJson(tree);

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(readNxJson(tree)).toEqual(nxJson);
  });

  it('converts targets declared in package.json', async () => {
    const targets = {
      test: {
        executor: '@nx/jest:jest',
        options: { jestConfig: 'libs/pkg/jest.config.js' },
      },
    };
    updateJson(tree, 'package.json', (json) => {
      json.workspaces = ['libs/*'];
      json.devDependencies = { jest: '^30.0.0' };
      return json;
    });
    fs.createFileSync('package.json', tree.read('package.json', 'utf-8'));
    writeJson(tree, 'libs/pkg/package.json', { name: 'pkg', nx: { targets } });
    fs.createFileSync(
      'libs/pkg/package.json',
      JSON.stringify({ name: 'pkg', nx: { targets } })
    );
    writeJestConfig(tree, 'libs/pkg', undefined);
    tree.write('libs/pkg/src/index.spec.ts', '');
    fs.createFileSync('libs/pkg/src/index.spec.ts', '');
    projectGraph.nodes.pkg = {
      name: 'pkg',
      type: 'lib',
      data: { root: 'libs/pkg', targets },
    };

    await update(tree);

    expect(readJson(tree, 'libs/pkg/package.json')).toMatchInlineSnapshot(`
      {
        "name": "pkg",
        "nx": {
          "// targets": "to see all targets run: nx show project pkg --web",
        },
      }
    `);
  });
});
