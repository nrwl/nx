import {
  type ProjectGraph,
  type Tree,
  type ProjectConfiguration,
  joinPathFragments,
  writeJson,
  addProjectConfiguration,
  readProjectConfiguration,
  readNxJson,
  type ExpandedPluginConfiguration,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { getRelativeProjectJsonSchemaPath } from 'nx/src/generators/utils/project-configuration';
import { join } from 'path';
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
    name,
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
  outputPath: string;
  buildTargetName: string;
  serveTargetName: string;
}

const defaultTestProjectOptions: TestProjectOptions = {
  appName: 'app1',
  appRoot: 'apps/app1',
  outputPath: 'dist/apps/app1',
  buildTargetName: 'build',
  serveTargetName: 'serve',
};

function writeRemixConfig(tree: Tree, projectRoot: string) {
  const remixConfig = {
    ignoredRouteFiles: ['**/.*'],
  };
  const remixConfigContents = `const config = ${JSON.stringify(remixConfig)};
export default config;`;

  tree.write(`${projectRoot}/remix.config.js`, remixConfigContents);
  fs.createFileSync(`${projectRoot}/remix.config.js`, remixConfigContents);
  tree.write(`${projectRoot}/package.json`, `{"type":"module"}`);
  fs.createFileSync(`${projectRoot}/package.json`, `{"type":"module"}`);
  jest.doMock(
    join(fs.tempDir, projectRoot, 'remix.config.js'),
    () => remixConfig,
    { virtual: true }
  );
}

function createTestProject(
  tree: Tree,
  opts: Partial<TestProjectOptions> = defaultTestProjectOptions,
  extraTargetOptions: any = {},
  extraConfigurations: any = {}
) {
  let projectOpts = { ...defaultTestProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.buildTargetName]: {
        executor: '@nx/remix:build',
        options: {
          outputPath: projectOpts.outputPath,
          ...extraTargetOptions,
        },
        configurations: {
          ...extraConfigurations,
        },
      },
      [projectOpts.serveTargetName]: {
        executor: '@nx/remix:serve',
        options: {
          port: 4200,
          ...extraTargetOptions,
        },
        configurations: {
          ...extraConfigurations,
        },
      },
    },
  };

  writeRemixConfig(tree, project.root);

  addProject(tree, project.name, project);
  fs.createFileSync(
    `${projectOpts.appRoot}/project.json`,
    JSON.stringify(project)
  );
  return project;
}

describe('Remix - Convert To Inferred', () => {
  let tree: Tree;
  beforeEach(() => {
    fs = new TempFs('remix');
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
    it('should correctly migrate a single project', async () => {
      // ARRANGE
      const project = createTestProject(tree);
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });

      const project2Targets = project2.targets;

      // ACT
      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // ASSERT
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets).toMatchInlineSnapshot(`
        {
          "serve": {
            "options": {
              "env": {
                "PORT": "4200",
              },
            },
          },
        }
      `);

      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets).toStrictEqual(project2Targets);

      const nxJsonPlugins = readNxJson(tree).plugins;
      const remixPlugin = nxJsonPlugins.find(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/remix/plugin' &&
          plugin.include?.length === 1
      );
      expect(remixPlugin).toBeTruthy();
      expect(remixPlugin.include).toEqual([`${project.root}/**/*`]);
    });

    it('should add a new plugin registration when the target name differs', async () => {
      // ARRANGE
      const project = createTestProject(tree);
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });

      const project2Targets = project2.targets;

      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/remix/plugin',
        options: {
          buildTargetName: 'build',
          devTargetName: 'custom-dev',
          startTargetName: 'start',
          typecheckTargetName: 'typecheck',
          staticServeTargetName: 'static-serve',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // ASSERT
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets).toMatchInlineSnapshot(`
        {
          "serve": {
            "options": {
              "env": {
                "PORT": "4200",
              },
            },
          },
        }
      `);

      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets).toStrictEqual(project2Targets);

      const nxJsonPlugins = readNxJson(tree).plugins;
      const remixPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/remix/plugin'
      );
      expect(remixPluginRegistrations.length).toBe(2);
      expect(remixPluginRegistrations[1].include).toMatchInlineSnapshot(`
        [
          "apps/app1/**/*",
        ]
      `);
    });

    it('should merge target defaults', async () => {
      // ARRANGE
      const project = createTestProject(tree);
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });

      const project2Targets = project2.targets;

      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/remix:build'] = {
        options: {
          sourcemap: true,
        },
      };
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // ASSERT
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets).toMatchInlineSnapshot(`
        {
          "build": {
            "options": {
              "sourcemap": true,
            },
          },
          "serve": {
            "options": {
              "env": {
                "PORT": "4200",
              },
            },
          },
        }
      `);

      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets).toStrictEqual(project2Targets);
    });

    it('should manage configurations correctly', async () => {
      // ARRANGE
      const project = createTestProject(tree, undefined, undefined, {
        dev: {
          outputPath: 'apps/dev/app1',
        },
      });
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });

      const project2Targets = project2.targets;
      // ACT
      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // ASSERT
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets).toMatchInlineSnapshot(`
        {
          "build": {
            "configurations": {
              "dev": {},
            },
          },
          "serve": {
            "configurations": {
              "dev": {
                "outputPath": "apps/dev/app1",
              },
            },
            "options": {
              "env": {
                "PORT": "4200",
              },
            },
          },
        }
      `);

      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets).toStrictEqual(project2Targets);

      const remixConfigContents = tree.read(
        `${project.root}/remix.config.js`,
        'utf-8'
      );
      expect(remixConfigContents).toMatchInlineSnapshot(`
        "const config = {"ignoredRouteFiles":["**/.*"]};
        export default config;"
      `);
    });
  });

  describe('all projects', () => {
    it('should correctly migrate all projects', async () => {
      // ARRANGE
      const project = createTestProject(tree);
      const project2 = createTestProject(tree, {
        appRoot: 'apps/project2',
        appName: 'project2',
      });
      // ACT
      await convertToInferred(tree, {
        skipFormat: true,
      });

      // ASSERT
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets).toMatchInlineSnapshot(`
        {
          "serve": {
            "options": {
              "env": {
                "PORT": "4200",
              },
            },
          },
        }
      `);

      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets).toMatchInlineSnapshot(`
        {
          "serve": {
            "options": {
              "env": {
                "PORT": "4200",
              },
            },
          },
        }
      `);

      const nxJsonPlugins = readNxJson(tree).plugins;
      const remixPlugin = nxJsonPlugins.find(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/remix/plugin'
      );
      expect(remixPlugin).toBeTruthy();
      expect(remixPlugin.include).toBeUndefined();
    });
  });
});
