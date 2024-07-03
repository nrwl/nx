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
  configDir: string;
  buildTargetName: string;
  serveTargetName: string;
}

const defaultTestProjectOptions: TestProjectOptions = {
  appName: 'app1',
  appRoot: 'apps/app1',
  configDir: '.storybook',
  buildTargetName: 'build-storybook',
  serveTargetName: 'storybook',
};

function writeStorybookConfig(
  tree: Tree,
  projectRoot: string,
  useVite: boolean = false
) {
  const storybookConfig = {
    stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
    addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
    framework: {
      name: useVite ? '@storybook/react-vite' : '@storybook/react-webpack5',
      options: useVite
        ? {
            builder: {
              viteConfigPath: `${projectRoot}/vite.config.ts`,
            },
          }
        : {},
    },
  };
  const storybookConfigContents = `const config = ${JSON.stringify(
    storybookConfig
  )};
export default config;`;

  if (useVite) {
    tree.write(`${projectRoot}/vite.config.ts`, `module.exports = {}`);
    fs.createFileSync(`${projectRoot}/vite.config.ts`, `module.exports = {}`);
  }

  tree.write(`${projectRoot}/.storybook/main.ts`, storybookConfigContents);
  fs.createFileSync(
    `${projectRoot}/.storybook/main.ts`,
    storybookConfigContents
  );
  jest.doMock(
    join(fs.tempDir, projectRoot, '.storybook', 'main.ts'),
    () => storybookConfig,
    { virtual: true }
  );
}

function createTestProject(
  tree: Tree,
  opts: Partial<TestProjectOptions> = defaultTestProjectOptions,
  extraTargetOptions: any = {},
  extraConfigurations: any = {},
  useVite = false
) {
  let projectOpts = { ...defaultTestProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.buildTargetName]: {
        executor: '@nx/storybook:build',
        outputs: ['{options.outputDir}'],
        options: {
          configDir: `${projectOpts.appRoot}/${projectOpts.configDir}`,
          outputDir: `dist/storybook/${projectOpts.appRoot}`,
          ...extraTargetOptions,
        },
        configurations: {
          ...extraConfigurations,
        },
      },
      [projectOpts.serveTargetName]: {
        executor: '@nx/storybook:storybook',
        options: {
          port: 4400,
          configDir: `${projectOpts.appRoot}/${projectOpts.configDir}`,
          ...extraTargetOptions,
        },
        configurations: {
          ci: {
            quiet: true,
          },
          ...extraConfigurations,
        },
      },
    },
  };

  writeStorybookConfig(tree, project.root, useVite);

  addProject(tree, project.name, project);
  fs.createFileSync(
    `${projectOpts.appRoot}/project.json`,
    JSON.stringify(project)
  );
  return project;
}

describe('Storybook - Convert To Inferred', () => {
  let tree: Tree;
  beforeEach(() => {
    fs = new TempFs('storybook');
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
          "build-storybook": {
            "options": {
              "config-dir": ".storybook",
              "output-dir": "../../dist/storybook/apps/app1",
            },
            "outputs": [
              "{projectRoot}/{options.output-dir}",
              "{workspaceRoot}/{projectRoot}/storybook-static",
              "{options.output-dir}",
              "{options.outputDir}",
              "{options.o}",
            ],
          },
          "storybook": {
            "configurations": {
              "ci": {
                "args": [
                  "--quiet",
                ],
              },
            },
            "options": {
              "config-dir": ".storybook",
              "port": 4400,
            },
          },
        }
      `);

      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets).toStrictEqual(project2Targets);

      const nxJsonPlugins = readNxJson(tree).plugins;
      const storybookPlugin = nxJsonPlugins.find(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/storybook/plugin' &&
          plugin.include?.length === 1
      );
      expect(storybookPlugin).toBeTruthy();
      expect(storybookPlugin.include).toEqual([`${project.root}/**/*`]);
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
        plugin: '@nx/storybook/plugin',
        options: {
          buildStorybookTargetName: 'storybook-build',
          serveStorybookTargetName: 'custom-storybook',
          staticStorybookTargetName: 'static-storybook',
          testStorybookTargetName: 'test-storybook',
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
          "build-storybook": {
            "options": {
              "config-dir": ".storybook",
              "output-dir": "../../dist/storybook/apps/app1",
            },
            "outputs": [
              "{projectRoot}/{options.output-dir}",
              "{workspaceRoot}/{projectRoot}/storybook-static",
              "{options.output-dir}",
              "{options.outputDir}",
              "{options.o}",
            ],
          },
          "storybook": {
            "configurations": {
              "ci": {
                "args": [
                  "--quiet",
                ],
              },
            },
            "options": {
              "config-dir": ".storybook",
              "port": 4400,
            },
          },
        }
      `);

      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets).toStrictEqual(project2Targets);

      const nxJsonPlugins = readNxJson(tree).plugins;
      const storybookPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/storybook/plugin'
      );
      expect(storybookPluginRegistrations.length).toBe(2);
      expect(storybookPluginRegistrations[1].include).toMatchInlineSnapshot(`
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
      nxJson.targetDefaults['@nx/storybook:build'] = {
        options: {
          webpackStatsJson: true,
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
          "build-storybook": {
            "options": {
              "config-dir": ".storybook",
              "output-dir": "../../dist/storybook/apps/app1",
              "webpack-stats-json": true,
            },
            "outputs": [
              "{projectRoot}/{options.output-dir}",
              "{workspaceRoot}/{projectRoot}/storybook-static",
              "{options.output-dir}",
              "{options.outputDir}",
              "{options.o}",
            ],
          },
          "storybook": {
            "configurations": {
              "ci": {
                "args": [
                  "--quiet",
                ],
              },
            },
            "options": {
              "config-dir": ".storybook",
              "port": 4400,
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
          docsMode: true,
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
          "build-storybook": {
            "configurations": {
              "dev": {},
            },
            "options": {
              "config-dir": ".storybook",
              "output-dir": "../../dist/storybook/apps/app1",
            },
            "outputs": [
              "{projectRoot}/{options.output-dir}",
              "{workspaceRoot}/{projectRoot}/storybook-static",
              "{options.output-dir}",
              "{options.outputDir}",
              "{options.o}",
            ],
          },
          "storybook": {
            "configurations": {
              "ci": {
                "args": [
                  "--quiet",
                ],
              },
              "dev": {
                "docs": true,
              },
            },
            "options": {
              "config-dir": ".storybook",
              "port": 4400,
            },
          },
        }
      `);

      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets).toStrictEqual(project2Targets);

      const storybookConfigContents = tree.read(
        `${project.root}/.storybook/main.ts`,
        'utf-8'
      );
      expect(storybookConfigContents).toMatchInlineSnapshot(`
        "
          
          // These options were migrated by @nx/storybook:convert-to-inferred from the project.json file.
          const configValues = {"default":{},"dev":{"docsMode":true}};
          
          // Determine the correct configValue to use based on the configuration
          const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';
          
          const options = {
            ...configValues.default,
            ...(configValues[nxConfiguration] ?? {})
          }
          const config = {docs: { docsMode: options.docsMode },"stories":["../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)"],"addons":["@storybook/addon-essentials","@storybook/addon-interactions"],"framework":{"name":"@storybook/react-webpack5","options":{}}};
        export default config;"
      `);
    });

    it('should update vite config file', async () => {
      // ARRANGE
      const project = createTestProject(
        tree,
        undefined,
        undefined,
        undefined,
        true
      );
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
      const storybookConfigContents = tree.read(
        `${project.root}/.storybook/main.ts`,
        'utf-8'
      );
      expect(storybookConfigContents).toMatchInlineSnapshot(`
        "
          
          // These options were migrated by @nx/storybook:convert-to-inferred from the project.json file.
          const configValues = {"default":{}};
          
          // Determine the correct configValue to use based on the configuration
          const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';
          
          const options = {
            ...configValues.default,
            ...(configValues[nxConfiguration] ?? {})
          }
          const config = {"stories":["../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)"],"addons":["@storybook/addon-essentials","@storybook/addon-interactions"],"framework":{"name":"@storybook/react-vite","options":{"builder":{"viteConfigPath":"./vite.config.ts"}}}};
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
          "build-storybook": {
            "options": {
              "config-dir": ".storybook",
              "output-dir": "../../dist/storybook/apps/app1",
            },
            "outputs": [
              "{projectRoot}/{options.output-dir}",
              "{workspaceRoot}/{projectRoot}/storybook-static",
              "{options.output-dir}",
              "{options.outputDir}",
              "{options.o}",
            ],
          },
          "storybook": {
            "configurations": {
              "ci": {
                "args": [
                  "--quiet",
                ],
              },
            },
            "options": {
              "config-dir": ".storybook",
              "port": 4400,
            },
          },
        }
      `);

      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets).toMatchInlineSnapshot(`
        {
          "build-storybook": {
            "options": {
              "config-dir": ".storybook",
              "output-dir": "../../dist/storybook/apps/project2",
            },
            "outputs": [
              "{projectRoot}/{options.output-dir}",
              "{workspaceRoot}/{projectRoot}/storybook-static",
              "{options.output-dir}",
              "{options.outputDir}",
              "{options.o}",
            ],
          },
          "storybook": {
            "configurations": {
              "ci": {
                "args": [
                  "--quiet",
                ],
              },
            },
            "options": {
              "config-dir": ".storybook",
              "port": 4400,
            },
          },
        }
      `);

      const nxJsonPlugins = readNxJson(tree).plugins;
      const storybookPlugin = nxJsonPlugins.find(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/storybook/plugin'
      );
      expect(storybookPlugin).toBeTruthy();
      expect(storybookPlugin.include).toBeUndefined();
    });
  });
});
