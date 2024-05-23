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

interface CreateViteTestProjectOptions {
  appName: string;
  appRoot: string;
  buildTargetName: string;
  serveTargetName: string;
  previewTargetName: string;
  testTargetName: string;
  outputPath: string;
}

const defaultCreateViteTestProjectOptions: CreateViteTestProjectOptions = {
  appName: 'myapp',
  appRoot: 'myapp',
  buildTargetName: 'build',
  serveTargetName: 'serve',
  previewTargetName: 'preview',
  testTargetName: 'test',
  outputPath: '{workspaceRoot}/dist/myapp',
};

function createTestProject(
  tree: Tree,
  opts: Partial<CreateViteTestProjectOptions> = defaultCreateViteTestProjectOptions
) {
  let projectOpts = { ...defaultCreateViteTestProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.buildTargetName]: {
        executor: '@nx/vite:build',
        outputs: [projectOpts.outputPath],
        options: {
          config: `${projectOpts.appRoot}/vite.config.ts`,
        },
      },
      [projectOpts.serveTargetName]: {
        executor: '@nx/vite:dev-server',
        outputs: [projectOpts.outputPath],
        options: {
          config: `${projectOpts.appRoot}/vite.config.ts`,
        },
      },
      [projectOpts.previewTargetName]: {
        executor: '@nx/vite:preview-server',
        outputs: [projectOpts.outputPath],
        options: {
          config: `${projectOpts.appRoot}/vite.config.ts`,
        },
      },
      [projectOpts.testTargetName]: {
        executor: '@nx/vite:test',
        outputs: [projectOpts.outputPath],
        options: {
          config: `${projectOpts.appRoot}/vite.config.ts`,
        },
      },
    },
  };

  const viteConfigContents = ``;

  tree.write(`${projectOpts.appRoot}/vite.config.ts`, viteConfigContents);
  fs.createFileSync(
    `${projectOpts.appRoot}/vite.config.ts`,
    viteConfigContents
  );
  jest.doMock(
    join(fs.tempDir, `${projectOpts.appRoot}/vite.config.ts`),
    () => ({
      default: {},
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

describe('Vite - Convert Executors To Plugin', () => {
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('vite');
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
    it('should setup a new Vite plugin and only migrate one specific project', async () => {
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
        plugin: '@nx/vite/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { project: 'myapp', skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      const targetKeys = Object.keys(updatedProject.targets);
      ['test'].forEach((key) => expect(targetKeys).not.toContain(key));

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedTestVitePlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/vite/plugin' &&
          plugin.include?.length === 1
        ) {
          return true;
        }
      });
      expect(addedTestVitePlugin).toBeTruthy();
      expect(
        (addedTestVitePlugin as ExpandedPluginConfiguration).include
      ).toEqual(['myapp/**/*']);
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
        plugin: '@nx/vite/plugin',
        include: ['existing/**/*'],
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { project: 'myapp', skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      const targetKeys = Object.keys(updatedProject.targets);
      ['test'].forEach((key) => expect(targetKeys).not.toContain(key));

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedTestVitePlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/vite/plugin' &&
          plugin.include?.length === 2
        ) {
          return true;
        }
      });
      expect(addedTestVitePlugin).toBeTruthy();
      expect(
        (addedTestVitePlugin as ExpandedPluginConfiguration).include
      ).toEqual(['existing/**/*', 'myapp/**/*']);
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
        plugin: '@nx/vite/plugin',
        include: ['existing/**/*', 'second/**/*', 'third/**/*'],
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { project: 'myapp', skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      const targetKeys = Object.keys(updatedProject.targets);
      ['test'].forEach((key) => expect(targetKeys).not.toContain(key));

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedTestVitePlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/vite/plugin' &&
          !plugin.include
        ) {
          return true;
        }
      });
      expect(addedTestVitePlugin).toBeTruthy();
      expect(
        (addedTestVitePlugin as ExpandedPluginConfiguration).include
      ).not.toBeDefined();
    });
  });

  describe('--all', () => {
    it('should successfully migrate a project using Vite executors to plugin', async () => {
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
      const hasVitePlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/vite/plugin'
          : plugin.plugin === '@nx/vite/plugin'
      );
      expect(hasVitePlugin).toBeTruthy();
      if (typeof hasVitePlugin !== 'string') {
        [
          ['targetName', 'e2e'],
          ['ciTargetName', 'e2e-ci'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasVitePlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    });

    it('should setup Vite plugin to match projects', async () => {
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
      const hasVitePlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/vite/plugin'
          : plugin.plugin === '@nx/vite/plugin'
      );
      expect(hasVitePlugin).toBeTruthy();
      if (typeof hasVitePlugin !== 'string') {
        [
          ['targetName', 'test'],
          ['ciTargetName', 'e2e-ci'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasVitePlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    });

    it('should setup a new Vite plugin to match only projects migrated', async () => {
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
        plugin: '@nx/vite/plugin',
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
      const addedTestVitePlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/vite/plugin' &&
          plugin.include?.length === 2
        ) {
          return true;
        }
      });
      expect(addedTestVitePlugin).toBeTruthy();
      expect(
        (addedTestVitePlugin as ExpandedPluginConfiguration).include
      ).toEqual(['myapp/**/*', 'second/**/*']);

      const addedIntegrationVitePlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/vite/plugin' &&
          plugin.include?.length === 1
        ) {
          return true;
        }
      });
      expect(addedIntegrationVitePlugin).toBeTruthy();
      expect(
        (addedIntegrationVitePlugin as ExpandedPluginConfiguration).include
      ).toEqual(['third/**/*']);
    });

    it('should keep Vite options in project.json', async () => {
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
      const hasVitePlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/vite/plugin'
          : plugin.plugin === '@nx/vite/plugin'
      );
      expect(hasVitePlugin).toBeTruthy();
      if (typeof hasVitePlugin !== 'string') {
        [
          ['targetName', 'e2e'],
          ['ciTargetName', 'e2e-ci'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasVitePlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    });

    it('should add Vite options found in targetDefaults for the executor to the project.json', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/vite:build'] = {
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
      const hasVitePlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/vite/plugin'
          : plugin.plugin === '@nx/vite/plugin'
      );
      expect(hasVitePlugin).toBeTruthy();
      if (typeof hasVitePlugin !== 'string') {
        [
          ['targetName', 'e2e'],
          ['ciTargetName', 'e2e-ci'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasVitePlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    });
  });
});
