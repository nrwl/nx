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
import type { VitePluginOptions } from '../../plugins/plugin';

let fs: TempFs;

let projectGraph: ProjectGraph;

let mockedConfigs = {};
const getMockedConfig = (
  opts: { configFile: string; mode: 'development' },
  target: string
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

jest.mock('vite', () => ({
  resolveConfig: jest.fn().mockImplementation(getMockedConfig),
}));

jest.mock('../../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn().mockImplementation(() => ({
    resolveConfig: jest.fn().mockImplementation(getMockedConfig),
  })),
}));

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
          configFile: `${projectOpts.appRoot}/vite.config.ts`,
        },
      },
      [projectOpts.serveTargetName]: {
        executor: '@nx/vite:dev-server',
        options: {
          buildTarget: `${projectOpts.appName}:${projectOpts.buildTargetName}`,
        },
      },
      [projectOpts.previewTargetName]: {
        executor: '@nx/vite:preview-server',
        options: {
          buildTarget: `${projectOpts.appName}:${projectOpts.buildTargetName}`,
        },
      },
      [projectOpts.testTargetName]: {
        executor: '@nx/vite:test',
        options: {
          configFile: `${projectOpts.appRoot}/vite.config.ts`,
        },
      },
    },
  };

  const viteConfigContents = `/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/myapp',

  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [react(), nxViteTsPaths()],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    outDir: '../../dist/apps/myapp',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/myapp',
      provider: 'v8',
    },
  },
});`;

  tree.write(`${projectOpts.appRoot}/vite.config.ts`, viteConfigContents);
  fs.createFileSync(
    `${projectOpts.appRoot}/vite.config.ts`,
    viteConfigContents
  );
  tree.write(`${projectOpts.appRoot}/index.html`, `<html></html>`);
  fs.createFileSync(`${projectOpts.appRoot}/index.html`, `<html></html>`);

  mockedConfigs[`${projectOpts.appRoot}/vite.config.ts`] = {
    root: `${projectOpts.appRoot}`,
    cacheDir: `../../node_modules/.vite/${projectOpts.appName}`,

    server: {
      port: 4200,
      host: 'localhost',
    },

    preview: {
      port: 4300,
      host: 'localhost',
    },

    build: {
      outDir: `../../dist/${projectOpts.appRoot}`,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },

    test: {
      globals: true,
      cache: {
        dir: '../../node_modules/.vitest',
      },
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

      reporters: ['default'],
      coverage: {
        reportsDirectory: `../../coverage/${projectOpts.appRoot}`,
        provider: 'v8',
      },
    },
  };

  jest.doMock(
    join(fs.tempDir, `${projectOpts.appRoot}/vite.config.ts`),
    () => ({
      default: mockedConfigs[`${projectOpts.appRoot}/vite.config.ts`],
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
    it('should setup a new Vite plugin and only migrate one specific project', async () => {
      // ARRANGE
      const existingProject = createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
        buildTargetName: 'build',
      });
      const project = createTestProject(tree, {
        buildTargetName: 'build-base',
      });
      const secondProject = createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        buildTargetName: 'build-base',
      });
      const thirdProject = createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        buildTargetName: 'package',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/vite/plugin',
        options: {
          buildTargetName: 'build',
          testTargetName: 'test',
          previewTargetName: 'preview',
          serveTargetName: 'serve',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { project: 'myapp', skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets).toMatchInlineSnapshot(`
        {
          "build-base": {
            "options": {
              "config": "./vite.config.ts",
            },
          },
          "test": {
            "options": {
              "config": "./vite.config.ts",
            },
          },
        }
      `);

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
          ['buildTargetName', 'build'],
          ['serveTargetName', 'serve'],
          ['previewTargetName', 'preview'],
          ['testTargetName', 'test'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasVitePlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    });

    it('should setup Vite plugin to match projects', async () => {
      // ARRANGE
      const project = createTestProject(tree, {
        buildTargetName: 'bundle',
      });

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets).toMatchInlineSnapshot(`
        {
          "bundle": {
            "options": {
              "config": "./vite.config.ts",
            },
          },
          "test": {
            "options": {
              "config": "./vite.config.ts",
            },
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
          ['buildTargetName', 'bundle'],
          ['serveTargetName', 'serve'],
          ['previewTargetName', 'preview'],
          ['testTargetName', 'test'],
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
        buildTargetName: 'build',
      });
      const project = createTestProject(tree, {
        buildTargetName: 'bundle',
      });
      const secondProject = createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        buildTargetName: 'bundle',
      });
      const thirdProject = createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        buildTargetName: 'build-base',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/vite/plugin',
        options: {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets).toMatchInlineSnapshot(`
        {
          "bundle": {
            "options": {
              "config": "./vite.config.ts",
            },
          },
          "test": {
            "options": {
              "config": "./vite.config.ts",
            },
          },
        }
      `);

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedVitePlugins = nxJsonPlugins.filter((plugin) => {
        if (typeof plugin !== 'string' && plugin.plugin === '@nx/vite/plugin') {
          return true;
        }
      });
      expect(addedVitePlugins).toMatchInlineSnapshot(`
        [
          {
            "options": {
              "buildTargetName": "build",
              "previewTargetName": "preview",
              "serveTargetName": "serve",
              "testTargetName": "test",
            },
            "plugin": "@nx/vite/plugin",
          },
          {
            "include": [
              "myapp/**/*",
              "second/**/*",
            ],
            "options": {
              "buildTargetName": "bundle",
              "previewTargetName": "preview",
              "serveStaticTargetName": "serve-static",
              "serveTargetName": "serve",
              "testTargetName": "test",
            },
            "plugin": "@nx/vite/plugin",
          },
          {
            "include": [
              "third/**/*",
            ],
            "options": {
              "buildTargetName": "build-base",
              "previewTargetName": "preview",
              "serveStaticTargetName": "serve-static",
              "serveTargetName": "serve",
              "testTargetName": "test",
            },
            "plugin": "@nx/vite/plugin",
          },
        ]
      `);
    });

    it('should handle multiple different target names for the same project', async () => {
      const project1 = createTestProject(tree);
      const project2 = createTestProject(tree, {
        appRoot: 'project2',
        appName: 'project2',
      });
      const project3 = createTestProject(tree, {
        appRoot: 'project3',
        appName: 'project3',
        buildTargetName: 'vite-build',
        serveTargetName: 'vite-serve',
      });
      const project4 = createTestProject(tree, {
        appRoot: 'project4',
        appName: 'project4',
        buildTargetName: 'build',
        serveTargetName: 'vite-serve',
      });
      const project5 = createTestProject(tree, {
        appRoot: 'project5',
        appName: 'project5',
        buildTargetName: 'vite-build',
        serveTargetName: 'serve',
      });

      await convertToInferred(tree, { skipFormat: true });

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const vitePluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration<VitePluginOptions> =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/vite/plugin'
      );
      expect(vitePluginRegistrations.length).toBe(4);
      expect(vitePluginRegistrations[0].options.buildTargetName).toBe('build');
      expect(vitePluginRegistrations[0].options.serveTargetName).toBe('serve');
      expect(vitePluginRegistrations[0].include).toEqual([
        `${project1.root}/**/*`,
        `${project2.root}/**/*`,
      ]);
      expect(vitePluginRegistrations[1].options.buildTargetName).toBe('build');
      expect(vitePluginRegistrations[1].options.serveTargetName).toBe(
        'vite-serve'
      );
      expect(vitePluginRegistrations[1].include).toEqual([
        `${project4.root}/**/*`,
      ]);
      expect(vitePluginRegistrations[2].options.buildTargetName).toBe(
        'vite-build'
      );
      expect(vitePluginRegistrations[2].options.serveTargetName).toBe(
        'vite-serve'
      );
      expect(vitePluginRegistrations[2].include).toEqual([
        `${project3.root}/**/*`,
      ]);
      expect(vitePluginRegistrations[3].options.buildTargetName).toBe(
        'vite-build'
      );
      expect(vitePluginRegistrations[3].options.serveTargetName).toBe('serve');
      expect(vitePluginRegistrations[3].include).toEqual([
        `${project5.root}/**/*`,
      ]);
    });

    it('should keep Vite options in project.json', async () => {
      // ARRANGE
      const project = createTestProject(tree);
      project.targets.build.options.mode = 'development';
      updateProjectConfiguration(tree, project.name, project);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.build).toMatchInlineSnapshot(`
        {
          "options": {
            "config": "./vite.config.ts",
            "mode": "development",
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
          ['buildTargetName', 'build'],
          ['serveTargetName', 'serve'],
          ['previewTargetName', 'preview'],
          ['testTargetName', 'test'],
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
          mode: 'production',
        },
      };
      updateNxJson(tree, nxJson);
      const project = createTestProject(tree);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.build).toMatchInlineSnapshot(`
        {
          "options": {
            "config": "./vite.config.ts",
            "mode": "production",
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
          ['buildTargetName', 'build'],
          ['serveTargetName', 'serve'],
          ['previewTargetName', 'preview'],
          ['testTargetName', 'test'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasVitePlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    });
  });
});
