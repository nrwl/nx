import {
  getRelativeProjectJsonSchemaPath,
  updateProjectConfiguration,
} from 'nx/src/generators/utils/project-configuration';

let projectGraph: ProjectGraph;
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

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateExecutorsToPlugin from './migrate-executors-to-plugin';
import {
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
  readProjectConfiguration,
  addProjectConfiguration as _addProjectConfiguration,
  readNxJson,
  joinPathFragments,
  writeJson,
  updateNxJson,
  getPackageManagerCommand,
} from '@nx/devkit';

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

interface CreatePlaywrightTestProjectOptions {
  appName: string;
  appRoot: string;
  e2eTargetName: string;
  outputPath: string;
}

const defaultCreatePlaywrightTestProjectOptions: CreatePlaywrightTestProjectOptions =
  {
    appName: 'myapp-e2e',
    appRoot: 'myapp-e2e',
    e2eTargetName: 'e2e',
    outputPath: '{workspaceRoot}/dist/.playwright/myapp-e2e',
  };

function createTestProject(
  tree: Tree,
  opts: Partial<CreatePlaywrightTestProjectOptions> = defaultCreatePlaywrightTestProjectOptions
) {
  let projectOpts = { ...defaultCreatePlaywrightTestProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.e2eTargetName]: {
        executor: '@nx/playwright:playwright',
        outputs: [projectOpts.outputPath],
        options: {
          config: `${projectOpts.appRoot}/playwright.config.ts`,
        },
      },
    },
  };

  tree.write(
    `${projectOpts.appRoot}/playwright.config.ts`,
    `import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx nx serve myapp',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});`
  );

  addProjectConfiguration(tree, project.name, project);
  return project;
}

describe('Playwright - Migrate Executors To Plugin', () => {
  beforeEach(() => {
    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  it('should successfully migrate a project using Playwright executors to plugin', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const project = createTestProject(tree);

    // ACT
    await migrateExecutorsToPlugin(tree);

    // ASSERT
    // project.json modifications
    const updatedProject = readProjectConfiguration(tree, project.name);
    const targetKeys = Object.keys(updatedProject.targets);
    ['e2e'].forEach((key) => expect(targetKeys).not.toContain(key));

    // nx.json modifications
    const nxJsonPlugins = readNxJson(tree).plugins;
    const hasPlaywrightPlugin = nxJsonPlugins.find((plugin) =>
      typeof plugin === 'string'
        ? plugin === '@nx/playwright/plugin'
        : plugin.plugin === '@nx/playwright/plugin'
    );
    expect(hasPlaywrightPlugin).toBeTruthy();
    if (typeof hasPlaywrightPlugin !== 'string') {
      [
        ['targetName', 'e2e'],
        ['ciTargetName', 'e2e-ci'],
      ].forEach(([targetOptionName, targetName]) => {
        expect(hasPlaywrightPlugin.options[targetOptionName]).toEqual(
          targetName
        );
      });
    }
  });

  it('should setup Playwright plugin to match projects', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const project = createTestProject(tree, {
      e2eTargetName: 'test',
    });

    // ACT
    await migrateExecutorsToPlugin(tree);

    // ASSERT
    // project.json modifications
    const updatedProject = readProjectConfiguration(tree, project.name);
    const targetKeys = Object.keys(updatedProject.targets);
    ['test'].forEach((key) => expect(targetKeys).not.toContain(key));

    // nx.json modifications
    const nxJsonPlugins = readNxJson(tree).plugins;
    const hasPlaywrightPlugin = nxJsonPlugins.find((plugin) =>
      typeof plugin === 'string'
        ? plugin === '@nx/playwright/plugin'
        : plugin.plugin === '@nx/playwright/plugin'
    );
    expect(hasPlaywrightPlugin).toBeTruthy();
    if (typeof hasPlaywrightPlugin !== 'string') {
      [
        ['targetName', 'test'],
        ['ciTargetName', 'e2e-ci'],
      ].forEach(([targetOptionName, targetName]) => {
        expect(hasPlaywrightPlugin.options[targetOptionName]).toEqual(
          targetName
        );
      });
    }
  });

  it('should keep Playwright options in project.json', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const project = createTestProject(tree);
    project.targets.e2e.options.globalTimeout = 100000;
    updateProjectConfiguration(tree, project.name, project);

    // ACT
    await migrateExecutorsToPlugin(tree);

    // ASSERT
    // project.json modifications
    const updatedProject = readProjectConfiguration(tree, project.name);
    expect(updatedProject.targets.e2e).toMatchInlineSnapshot(`
      {
        "options": {
          "globalTimeout": 100000,
        },
      }
    `);

    // nx.json modifications
    const nxJsonPlugins = readNxJson(tree).plugins;
    const hasPlaywrightPlugin = nxJsonPlugins.find((plugin) =>
      typeof plugin === 'string'
        ? plugin === '@nx/playwright/plugin'
        : plugin.plugin === '@nx/playwright/plugin'
    );
    expect(hasPlaywrightPlugin).toBeTruthy();
    if (typeof hasPlaywrightPlugin !== 'string') {
      [
        ['targetName', 'e2e'],
        ['ciTargetName', 'e2e-ci'],
      ].forEach(([targetOptionName, targetName]) => {
        expect(hasPlaywrightPlugin.options[targetOptionName]).toEqual(
          targetName
        );
      });
    }
  });

  it('should add Playwright options found in targetDefaults for the executor to the project.json', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['@nx/playwright:playwright'] = {
      options: {
        globalTimeout: 100000,
      },
    };
    updateNxJson(tree, nxJson);
    const project = createTestProject(tree);

    // ACT
    await migrateExecutorsToPlugin(tree);

    // ASSERT
    // project.json modifications
    const updatedProject = readProjectConfiguration(tree, project.name);
    expect(updatedProject.targets.e2e).toMatchInlineSnapshot(`
      {
        "options": {
          "globalTimeout": 100000,
        },
      }
    `);

    // nx.json modifications
    const nxJsonPlugins = readNxJson(tree).plugins;
    const hasPlaywrightPlugin = nxJsonPlugins.find((plugin) =>
      typeof plugin === 'string'
        ? plugin === '@nx/playwright/plugin'
        : plugin.plugin === '@nx/playwright/plugin'
    );
    expect(hasPlaywrightPlugin).toBeTruthy();
    if (typeof hasPlaywrightPlugin !== 'string') {
      [
        ['targetName', 'e2e'],
        ['ciTargetName', 'e2e-ci'],
      ].forEach(([targetOptionName, targetName]) => {
        expect(hasPlaywrightPlugin.options[targetOptionName]).toEqual(
          targetName
        );
      });
    }
  });
});
