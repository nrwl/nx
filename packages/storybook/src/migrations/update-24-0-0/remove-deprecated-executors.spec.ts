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
import {
  mockCjsModule,
  resetCjsMocks,
  TempFs,
} from '@nx/devkit/internal-testing-utils';
import { join } from 'path';
import { getRelativeProjectJsonSchemaPath } from '@nx/devkit/internal';

let fs: TempFs;
let projectGraph: ProjectGraph;

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: vi
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
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
  // loadConfigFile `require`s the config, which `vi.doMock` cannot reach.
  mockCjsModule(
    import.meta.url,
    join(fs.tempDir, projectRoot, '.storybook', 'main.ts'),
    storybookConfig
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

import * as converter from '../../generators/convert-to-inferred/convert-to-inferred';
import update from './remove-deprecated-executors';

describe('remove-deprecated-executors', () => {
  // The migration loads its converter through `require`, which vi.mock cannot
  // reach, so hand it the module that sees the mocked project graph.
  beforeEach(() => {
    mockCjsModule(
      import.meta.url,
      '../../generators/convert-to-inferred/convert-to-inferred',
      converter
    );
  });
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
    vi.resetModules();
    resetCjsMocks();
  });

  it('converts targets using the removed executors to the inference plugin', async () => {
    const project = createTestProject(tree);

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/storybook/plugin'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "buildStorybookTargetName": "build-storybook",
          "serveStorybookTargetName": "storybook",
          "staticStorybookTargetName": "static-storybook",
          "testStorybookTargetName": "test-storybook",
        },
        "plugin": "@nx/storybook/plugin",
      }
    `);
    expect(readProjectConfiguration(tree, project.name).targets)
      .toMatchInlineSnapshot(`
      {
        "build-storybook": {
          "options": {
            "config-dir": ".storybook",
            "output-dir": "../../dist/storybook/apps/app1",
          },
          "outputs": [
            "{projectRoot}/{options.output-dir}",
            "{projectRoot}/storybook-static",
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
  });

  it('skips the prompt when no project uses the removed executors', async () => {
    const nxJson = readNxJson(tree);

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(readNxJson(tree)).toEqual(nxJson);
  });
});
