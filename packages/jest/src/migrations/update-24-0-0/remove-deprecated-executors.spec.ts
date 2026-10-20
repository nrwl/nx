import {
  addProjectConfiguration,
  joinPathFragments,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateJson,
  updateNxJson,
  writeJson,
  type ExpandedPluginConfiguration,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import type { JestPluginOptions } from '../../plugins/plugin';
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

    it('converts the other projects when one uses a config file name the plugin does not detect', async () => {
      createTestProject(tree);
      addApp2('jest.app.config.js');

      expect(await runUpdate()).toMatchInlineSnapshot(`
        {
          "app1": {},
          "app2": {
            "test": {
              "executor": "@nx/jest:jest",
              "options": {
                "jestConfig": "apps/app2/jest.app.config.js",
              },
            },
          },
          "nextSteps": [
            "These targets still use removed executors: app2:test (@nx/jest:jest). Replace each one before running them.",
          ],
          "warnings": [
            "convert-to-inferred left target "test" in project "app2" on its executor because the plugin found no config file it detects in apps/app2. Rename the config file to one the plugin detects, then rerun the migration to convert it.",
          ],
        }
      `);
    });

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
