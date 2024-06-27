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

let fs: TempFs;

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

  const playwrightConfigContents = `import { defineConfig, devices } from '@playwright/test';
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
  });`;

  tree.write(
    `${projectOpts.appRoot}/playwright.config.ts`,
    playwrightConfigContents
  );
  fs.createFileSync(
    `${projectOpts.appRoot}/playwright.config.ts`,
    playwrightConfigContents
  );
  jest.doMock(
    join(fs.tempDir, `${projectOpts.appRoot}/playwright.config.ts`),
    () => ({
      default: {
        outputDir: '../dist/.playwright/myapp-e2e',
      },
    }),
    {
      virtual: true,
    }
  );

  addProjectConfiguration(tree, project.name, project);
  fs.createFileSync(
    `${projectOpts.appRoot}/project.json`,
    JSON.stringify(project)
  );
  return project;
}

describe('Playwright - Convert Executors To Plugin', () => {
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('playwright');
    tree = createTreeWithEmptyWorkspace();
    tree.root = fs.tempDir;

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
    it('should setup a new Playwright plugin and only migrate one specific project', async () => {
      // ARRANGE
      const existingProject = createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
        e2eTargetName: 'e2e',
      });
      const project = createTestProject(tree, {
        e2eTargetName: 'test',
      });
      const secondProject = createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        e2eTargetName: 'test',
      });
      const thirdProject = createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        e2eTargetName: 'integration',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/playwright/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { project: 'myapp-e2e', skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      const targetKeys = Object.keys(updatedProject.targets);
      ['test'].forEach((key) => expect(targetKeys).not.toContain(key));

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedTestPlaywrightPlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/playwright/plugin' &&
          plugin.include?.length === 1
        ) {
          return true;
        }
      });
      expect(addedTestPlaywrightPlugin).toBeTruthy();
      expect(
        (addedTestPlaywrightPlugin as ExpandedPluginConfiguration).include
      ).toEqual(['myapp-e2e/**/*']);
    });

    it('should add project to existing plugins includes', async () => {
      // ARRANGE
      const existingProject = createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
        e2eTargetName: 'e2e',
      });
      const project = createTestProject(tree, {
        e2eTargetName: 'e2e',
      });
      const secondProject = createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        e2eTargetName: 'e2e',
      });
      const thirdProject = createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        e2eTargetName: 'e2e',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/playwright/plugin',
        include: ['existing/**/*'],
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { project: 'myapp-e2e', skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      const targetKeys = Object.keys(updatedProject.targets);
      ['test'].forEach((key) => expect(targetKeys).not.toContain(key));

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedTestPlaywrightPlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/playwright/plugin' &&
          plugin.include?.length === 2
        ) {
          return true;
        }
      });
      expect(addedTestPlaywrightPlugin).toBeTruthy();
      expect(
        (addedTestPlaywrightPlugin as ExpandedPluginConfiguration).include
      ).toEqual(['existing/**/*', 'myapp-e2e/**/*']);
    });

    it('should remove include when all projects are included', async () => {
      // ARRANGE
      const existingProject = createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
        e2eTargetName: 'e2e',
      });
      const project = createTestProject(tree, {
        e2eTargetName: 'e2e',
      });
      const secondProject = createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        e2eTargetName: 'e2e',
      });
      const thirdProject = createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        e2eTargetName: 'e2e',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/playwright/plugin',
        include: ['existing/**/*', 'second/**/*', 'third/**/*'],
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { project: 'myapp-e2e', skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      const targetKeys = Object.keys(updatedProject.targets);
      ['test'].forEach((key) => expect(targetKeys).not.toContain(key));

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedTestPlaywrightPlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/playwright/plugin' &&
          !plugin.include
        ) {
          return true;
        }
      });
      expect(addedTestPlaywrightPlugin).toBeTruthy();
      expect(
        (addedTestPlaywrightPlugin as ExpandedPluginConfiguration).include
      ).not.toBeDefined();
    });

    it('should remove inputs when they are inferred', async () => {
      const project = createTestProject(tree);
      project.targets.e2e.options.runnerUi = true;
      updateProjectConfiguration(tree, project.name, project);
      createTestProject(tree, { appRoot: 'second', appName: 'second' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/playwright:playwright'] = {
        inputs: ['default', '^default'],
      };
      updateNxJson(tree, nxJson);

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.e2e.inputs).toBeUndefined();
    });

    it('should keep inputs when any of them are not inferred', async () => {
      const project = createTestProject(tree);
      project.targets.e2e.options.runnerUi = true;
      updateProjectConfiguration(tree, project.name, project);
      createTestProject(tree, { appRoot: 'second', appName: 'second' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/playwright:playwright'] = {
        inputs: ['default', '^default', '{workspaceRoot}/some-file.ts'],
      };
      updateNxJson(tree, nxJson);

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.e2e.inputs).toStrictEqual([
        'default',
        '^default',
        '{workspaceRoot}/some-file.ts',
        { externalDependencies: ['@playwright/test'] },
      ]);
    });
  });

  describe('--all', () => {
    it('should successfully migrate a project using Playwright executors to plugin', async () => {
      const project = createTestProject(tree);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      const targetKeys = Object.keys(updatedProject.targets);
      expect(targetKeys).not.toContain('e2e');

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
      const project = createTestProject(tree, {
        e2eTargetName: 'test',
      });

      // ACT
      await convertToInferred(tree, { skipFormat: true });

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

    it('should setup a new Playwright plugin to match only projects migrated', async () => {
      // ARRANGE
      const existingProject = createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
        e2eTargetName: 'e2e',
      });
      const project = createTestProject(tree, {
        e2eTargetName: 'test',
      });
      const secondProject = createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        e2eTargetName: 'test',
      });
      const thirdProject = createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        e2eTargetName: 'integration',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/playwright/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      const targetKeys = Object.keys(updatedProject.targets);
      ['test'].forEach((key) => expect(targetKeys).not.toContain(key));

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedTestPlaywrightPlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/playwright/plugin' &&
          plugin.include?.length === 2
        ) {
          return true;
        }
      });
      expect(addedTestPlaywrightPlugin).toBeTruthy();
      expect(
        (addedTestPlaywrightPlugin as ExpandedPluginConfiguration).include
      ).toEqual(['myapp-e2e/**/*', 'second/**/*']);

      const addedIntegrationPlaywrightPlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/playwright/plugin' &&
          plugin.include?.length === 1
        ) {
          return true;
        }
      });
      expect(addedIntegrationPlaywrightPlugin).toBeTruthy();
      expect(
        (addedIntegrationPlaywrightPlugin as ExpandedPluginConfiguration)
          .include
      ).toEqual(['third/**/*']);
    });

    it('should keep Playwright options in project.json', async () => {
      // ARRANGE
      const project = createTestProject(tree);
      project.targets.e2e.options.globalTimeout = 100000;
      updateProjectConfiguration(tree, project.name, project);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.e2e).toMatchInlineSnapshot(`
      {
        "options": {
          "global-timeout": 100000,
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
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.e2e).toMatchInlineSnapshot(`
      {
        "options": {
          "global-timeout": 100000,
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
});
