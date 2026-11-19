import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertToInferred } from './convert-to-inferred';
import {
  addProjectConfiguration as _addProjectConfiguration,
  type ExpandedPluginConfiguration,
  joinPathFragments,
  logger,
  type ProjectConfiguration,
  type ProjectGraph,
  readNxJson,
  readProjectConfiguration,
  type TargetConfiguration,
  type Tree,
  updateNxJson,
  writeJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import {
  mockCjsModule,
  resetCjsMocks,
  TempFs,
} from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';
import { getRelativeProjectJsonSchemaPath } from '@nx/devkit/internal';

let fs: TempFs;

let projectGraph: ProjectGraph;
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

interface CreateCypressTestProjectOptions {
  appName: string;
  appRoot: string;
  e2eTargetName: string;
  legacyExecutor?: boolean;
}

const defaultCreateCypressTestProjectOptions: CreateCypressTestProjectOptions =
  {
    appName: 'myapp-e2e',
    appRoot: 'myapp-e2e',
    e2eTargetName: 'e2e',
    legacyExecutor: false,
  };

function createTestProject(
  tree: Tree,
  opts: Partial<CreateCypressTestProjectOptions> = defaultCreateCypressTestProjectOptions
) {
  let projectOpts = { ...defaultCreateCypressTestProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.e2eTargetName]: {
        executor: projectOpts.legacyExecutor
          ? '@nrwl/cypress:cypress'
          : '@nx/cypress:cypress',
        options: {
          cypressConfig: `${projectOpts.appRoot}/cypress.config.ts`,
          testingType: `e2e`,
          devServerTarget: 'myapp:serve',
        },
        configurations: {
          ci: {
            devServerTarget: 'myapp:static-serve',
          },
        },
      },
    },
  };

  const cypressConfigContents = `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, { cypressDir: 'src' }),
    baseUrl: 'http://localhost:4200',
  },
});`;

  tree.write(`${projectOpts.appRoot}/cypress.config.ts`, cypressConfigContents);
  fs.createFileSync(
    `${projectOpts.appRoot}/cypress.config.ts`,
    cypressConfigContents
  );
  // loadConfigFile `require`s the config, which `vi.doMock` cannot reach.
  mockCjsModule(
    import.meta.url,
    join(fs.tempDir, `${projectOpts.appRoot}/cypress.config.ts`),
    {
      default: {
        e2e: {
          baseUrl: 'http://localhost:4200',
        },
      },
    }
  );

  addProjectConfiguration(tree, project.name, project);
  fs.createFileSync(
    `${projectOpts.appRoot}/project.json`,
    JSON.stringify(project)
  );
  return project;
}

function createComponentTestingProject(
  tree: Tree,
  component: string,
  target: Partial<TargetConfiguration> = {}
) {
  const cypressConfigContents = `import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';
import { defineConfig } from 'cypress';

export default defineConfig({
  component: ${component},
});`;
  tree.write('mylib/cypress.config.ts', cypressConfigContents);
  fs.createFileSync('mylib/cypress.config.ts', cypressConfigContents);
  mockCjsModule(import.meta.url, join(fs.tempDir, 'mylib/cypress.config.ts'), {
    default: { component: {} },
  });

  const project: ProjectConfiguration = {
    name: 'mylib',
    root: 'mylib',
    projectType: 'library',
    targets: {
      'component-test': {
        executor: '@nx/cypress:cypress',
        ...target,
        options: {
          cypressConfig: 'mylib/cypress.config.ts',
          testingType: 'component',
          skipServe: true,
          devServerTarget: 'myapp:build',
          ...target.options,
        },
      },
    },
  };
  addProjectConfiguration(tree, project.name, project);
  fs.createFileSync('mylib/project.json', JSON.stringify(project));
}

describe('Cypress - Convert Executors To Plugin', () => {
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('cypress');
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
    resetCjsMocks();
    vi.restoreAllMocks();
  });

  describe('--project', () => {
    it('should setup a new Cypress plugin and only migrate one specific project', async () => {
      // ARRANGE
      createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
        e2eTargetName: 'e2e',
      });
      createTestProject(tree, {
        e2eTargetName: 'test',
      });
      createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        e2eTargetName: 'test',
      });
      createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        e2eTargetName: 'integration',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { project: 'myapp-e2e', skipFormat: true });

      // ASSERT

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedTestCypressPlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/cypress/plugin' &&
          plugin.include?.length === 1
        ) {
          return true;
        }
      });
      expect(addedTestCypressPlugin).toBeTruthy();
      expect(
        (addedTestCypressPlugin as ExpandedPluginConfiguration).include
      ).toEqual(['myapp-e2e/**/*']);
    });

    it('should remove inputs when they are inferred', async () => {
      const project = createTestProject(tree);
      project.targets.e2e.options.exit = false;
      updateProjectConfiguration(tree, project.name, project);
      createTestProject(tree, { appRoot: 'second', appName: 'second' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/cypress:cypress'] = {
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

    it('should add external dependencies input from inferred task', async () => {
      const project = createTestProject(tree);
      createTestProject(tree, { appRoot: 'second', appName: 'second' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/cypress:cypress'] = {
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
        { externalDependencies: ['cypress'] },
      ]);
    });

    it('should merge external dependencies input from inferred task', async () => {
      const project = createTestProject(tree);
      createTestProject(tree, { appRoot: 'second', appName: 'second' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/cypress:cypress'] = {
        inputs: [
          'default',
          '^default',
          '{workspaceRoot}/some-file.ts',
          { externalDependencies: ['some-external-dep'] },
        ],
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
        { externalDependencies: ['some-external-dep', 'cypress'] },
      ]);
    });

    it('should not duplicate already existing external dependencies input', async () => {
      const project = createTestProject(tree);
      createTestProject(tree, { appRoot: 'second', appName: 'second' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/cypress:cypress'] = {
        inputs: [
          'default',
          '^default',
          '{workspaceRoot}/some-file.ts',
          { externalDependencies: ['cypress', 'some-external-dep'] },
        ],
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
        { externalDependencies: ['cypress', 'some-external-dep'] },
      ]);
    });
  });

  describe('--all', () => {
    it('should successfully migrate a project using Cypress executors to plugin', async () => {
      const project = createTestProject(tree);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const hasCypressPlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/cypress/plugin'
          : plugin.plugin === '@nx/cypress/plugin'
      );
      expect(hasCypressPlugin).toBeTruthy();
      if (typeof hasCypressPlugin !== 'string') {
        expect(hasCypressPlugin.include).not.toBeDefined();
        [
          ['targetName', 'e2e'],
          ['ciTargetName', 'e2e-ci'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasCypressPlugin.options[targetOptionName]).toEqual(
            targetName
          );
        });
      }

      // cypress.config.ts modifications
      expect(tree.read(`${project.root}/cypress.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

        import { defineConfig } from 'cypress';

        export default defineConfig({
          e2e: {
            ...nxE2EPreset(__filename, {ciWebServerCommand: "npx nx run myapp:static-serve",webServerCommands: {"default":"npx nx run myapp:serve","ci":"npx nx run myapp:static-serve"}, cypressDir: 'src' }),
            baseUrl: 'http://localhost:4200',
          },
        });"
      `);
    });

    it('should setup Cypress plugin to match projects', async () => {
      // ARRANGE
      createTestProject(tree, {
        e2eTargetName: 'test',
      });

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const hasCypressPlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/cypress/plugin'
          : plugin.plugin === '@nx/cypress/plugin'
      );
      expect(hasCypressPlugin).toBeTruthy();
      if (typeof hasCypressPlugin !== 'string') {
        [
          ['targetName', 'test'],
          ['ciTargetName', 'e2e-ci'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasCypressPlugin.options[targetOptionName]).toEqual(
            targetName
          );
        });
      }
    });

    it('should setup handle legacy executor', async () => {
      // ARRANGE
      createTestProject(tree, {
        e2eTargetName: 'test',
        legacyExecutor: true,
      });

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const hasCypressPlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/cypress/plugin'
          : plugin.plugin === '@nx/cypress/plugin'
      );
      expect(hasCypressPlugin).toBeTruthy();
      if (typeof hasCypressPlugin !== 'string') {
        [
          ['targetName', 'test'],
          ['ciTargetName', 'e2e-ci'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasCypressPlugin.options[targetOptionName]).toEqual(
            targetName
          );
        });
      }
    });

    it('should setup a new Cypress plugin to match only projects migrated', async () => {
      // ARRANGE
      createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
        e2eTargetName: 'e2e',
      });
      createTestProject(tree, {
        e2eTargetName: 'test',
      });
      createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        e2eTargetName: 'test',
      });
      createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        e2eTargetName: 'integration',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedCypressPlugins = nxJsonPlugins.filter(
        (plugin) =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/cypress/plugin'
      );
      expect(addedCypressPlugins).toMatchInlineSnapshot(`
        [
          {
            "options": {
              "ciTargetName": "e2e-ci",
              "targetName": "e2e",
            },
            "plugin": "@nx/cypress/plugin",
          },
          {
            "include": [
              "myapp-e2e/**/*",
              "second/**/*",
            ],
            "options": {
              "ciTargetName": "e2e-ci",
              "componentTestingTargetName": "component-test",
              "openTargetName": "open-cypress",
              "targetName": "test",
            },
            "plugin": "@nx/cypress/plugin",
          },
          {
            "include": [
              "third/**/*",
            ],
            "options": {
              "ciTargetName": "e2e-ci",
              "componentTestingTargetName": "component-test",
              "openTargetName": "open-cypress",
              "targetName": "integration",
            },
            "plugin": "@nx/cypress/plugin",
          },
        ]
      `);
    });

    it('should keep Cypress options in project.json', async () => {
      // ARRANGE
      const project = createTestProject(tree);
      project.targets.e2e.options.runnerUi = true;
      updateProjectConfiguration(tree, project.name, project);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.e2e).toMatchInlineSnapshot(`
        {
          "options": {
            "config-file": "./cypress.config.ts",
            "runner-ui": true,
          },
        }
      `);

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const hasCypressPlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/cypress/plugin'
          : plugin.plugin === '@nx/cypress/plugin'
      );
      expect(hasCypressPlugin).toBeTruthy();
      if (typeof hasCypressPlugin !== 'string') {
        [
          ['targetName', 'e2e'],
          ['ciTargetName', 'e2e-ci'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasCypressPlugin.options[targetOptionName]).toEqual(
            targetName
          );
        });
      }
    });

    it.each([
      [
        'nxComponentTestingPreset(__filename)',
        'nxComponentTestingPreset(__filename, { buildTarget: "myapp:build" })',
        false,
      ],
      [
        `nxComponentTestingPreset(__filename, { bundler: 'webpack' })`,
        `nxComponentTestingPreset(__filename, { buildTarget: "myapp:build", bundler: 'webpack' })`,
        false,
      ],
      [
        `nxComponentTestingPreset(__filename, { buildTarget: 'other:build' })`,
        `nxComponentTestingPreset(__filename, { buildTarget: 'other:build' })`,
        false,
      ],
      [
        'nxComponentTestingPreset(__filename, { buildTarget: process.env.CT_BUILD_TARGET })',
        'nxComponentTestingPreset(__filename, { buildTarget: process.env.CT_BUILD_TARGET || "myapp:build" })',
        false,
      ],
      [
        `nxComponentTestingPreset(__filename, { buildTarget: <string>'other:build' })`,
        `nxComponentTestingPreset(__filename, { buildTarget: <string>'other:build' || "myapp:build" })`,
        false,
      ],
      [
        'nxComponentTestingPreset(__filename, { buildTarget })',
        'nxComponentTestingPreset(__filename, { buildTarget: buildTarget || "myapp:build" })',
        false,
      ],
      [
        'nxComponentTestingPreset(__filename, { buildTarget: process.env.A ?? process.env.B })',
        'nxComponentTestingPreset(__filename, { buildTarget: (process.env.A ?? process.env.B) || "myapp:build" })',
        false,
      ],
      [
        `nxComponentTestingPreset(__filename, { buildTarget: process.env.CI ? 'myapp:build:ci' : process.env.B })`,
        `nxComponentTestingPreset(__filename, { buildTarget: (process.env.CI ? 'myapp:build:ci' : process.env.B) || "myapp:build" })`,
        false,
      ],
      [
        'nxComponentTestingPreset(__filename, { ...shared })',
        'nxComponentTestingPreset(__filename, { ...shared })',
        true,
      ],
      [
        `nxComponentTestingPreset(__filename, { buildTarget: 'other:build', ...shared })`,
        `nxComponentTestingPreset(__filename, { buildTarget: 'other:build', ...shared })`,
        true,
      ],
      [
        `nxComponentTestingPreset(__filename, { ...shared, buildTarget: 'other:build' })`,
        `nxComponentTestingPreset(__filename, { ...shared, buildTarget: 'other:build' })`,
        false,
      ],
      [
        'nxComponentTestingPreset(__filename, { [optionName]: process.env.CT_BUILD_TARGET })',
        'nxComponentTestingPreset(__filename, { [optionName]: process.env.CT_BUILD_TARGET })',
        true,
      ],
      [
        'nxComponentTestingPreset(__filename, { __proto__: shared })',
        'nxComponentTestingPreset(__filename, { __proto__: shared })',
        true,
      ],
      [
        `nxComponentTestingPreset(__filename, { ['__proto__']: shared })`,
        `nxComponentTestingPreset(__filename, { buildTarget: "myapp:build", ['__proto__']: shared })`,
        false,
      ],
      [
        `nxComponentTestingPreset(__filename, { buildTarget: 'other:build', __proto__: shared })`,
        `nxComponentTestingPreset(__filename, { buildTarget: 'other:build', __proto__: shared })`,
        false,
      ],
    ])(
      'should convert the component testing devServerTarget for %s',
      async (component, expected, warns) => {
        createComponentTestingProject(tree, component);
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        await convertToInferred(tree, { skipFormat: true });

        expect(tree.read('mylib/cypress.config.ts', 'utf-8')).toContain(
          `component: ${expected},`
        );
        expect(
          readProjectConfiguration(tree, 'mylib').targets['component-test']
        ).toStrictEqual({ options: { 'config-file': './cypress.config.ts' } });
        expect(warn.mock.calls.map(([message]) => message)).toEqual(
          warns
            ? [
                expect.stringContaining(
                  'Pass it to nxComponentTestingPreset as buildTarget: "myapp:build".'
                ),
              ]
            : []
        );
      }
    );

    it.each([
      [
        'only the default configuration',
        { devServerTarget: undefined },
        [] as string[],
      ],
      [
        'both the options and the default configuration',
        {},
        [
          'Removed devServerTarget "myapp:build" from the options of project "mylib".',
        ],
      ],
    ])(
      'should move the default configuration devServerTarget when it is set in %s',
      async (_, options, warnings) => {
        createComponentTestingProject(
          tree,
          'nxComponentTestingPreset(__filename)',
          {
            options,
            defaultConfiguration: 'ci',
            configurations: { ci: { devServerTarget: 'myapp:build:ci' } },
          }
        );
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        await convertToInferred(tree, { skipFormat: true });

        expect(tree.read('mylib/cypress.config.ts', 'utf-8')).toContain(
          'component: nxComponentTestingPreset(__filename, { buildTarget: "myapp:build:ci" }),'
        );
        expect(
          readProjectConfiguration(tree, 'mylib').targets['component-test']
        ).toStrictEqual({
          defaultConfiguration: 'ci',
          options: { 'config-file': './cypress.config.ts' },
        });
        expect(warn.mock.calls.map(([message]) => message)).toEqual(
          warnings.map((warning) => expect.stringContaining(warning))
        );
      }
    );

    it('should warn about component testing build targets it cannot move', async () => {
      createComponentTestingProject(tree, '{}', {
        configurations: {
          production: { devServerTarget: 'myapp:build:production' },
        },
      });
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      await convertToInferred(tree, { skipFormat: true });

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Pass it to nxComponentTestingPreset as buildTarget: "myapp:build".'
        )
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Removed devServerTarget "myapp:build:production" from the "production" configuration of project "mylib".'
        )
      );
      expect(
        readProjectConfiguration(tree, 'mylib').targets['component-test']
      ).toStrictEqual({ options: { 'config-file': './cypress.config.ts' } });
    });

    it('should add Cypress options found in targetDefaults for the executor to the project.json', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/cypress:cypress'] = {
        options: {
          exit: false,
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
            "config-file": "./cypress.config.ts",
            "no-exit": true,
          },
        }
      `);

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const hasCypressPlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/cypress/plugin'
          : plugin.plugin === '@nx/cypress/plugin'
      );
      expect(hasCypressPlugin).toBeTruthy();
      if (typeof hasCypressPlugin !== 'string') {
        [
          ['targetName', 'e2e'],
          ['ciTargetName', 'e2e-ci'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasCypressPlugin.options[targetOptionName]).toEqual(
            targetName
          );
        });
      }
    });
  });
});
