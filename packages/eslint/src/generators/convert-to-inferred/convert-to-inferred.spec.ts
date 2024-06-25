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
  readJson,
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

interface CreateEslintLintProjectOptions {
  appName: string;
  appRoot: string;
  targetName: string;
  legacyExecutor?: boolean;
}

const defaultCreateEslintLintProjectOptions: CreateEslintLintProjectOptions = {
  appName: 'myapp',
  appRoot: 'myapp',
  targetName: 'lint',
  legacyExecutor: false,
};

function createTestProject(
  tree: Tree,
  opts: Partial<CreateEslintLintProjectOptions> = defaultCreateEslintLintProjectOptions
) {
  let projectOpts = { ...defaultCreateEslintLintProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.targetName]: {
        executor: projectOpts.legacyExecutor
          ? '@nrwl/linter:eslint'
          : '@nx/eslint:lint',
        options: {
          eslintConfig: `${projectOpts.appRoot}/.eslintrc.json`,
        },
      },
    },
  };

  const eslintConfigContents = {
    rules: {},
    overrides: [
      {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        rules: {},
      },
      {
        files: ['./project.json'],
        parser: 'jsonc-eslint-parser',
        rules: {
          '@nx/nx-plugin-checks': 'error',
        },
      },
      {
        files: ['./package.json'],
        parser: 'jsonc-eslint-parser',
        rules: {
          '@nx/dependency-checks': [
            'error',
            {
              buildTargets: ['build-base'],
              ignoredDependencies: [
                'nx',
                '@nx/jest',
                'typescript',
                'eslint',
                '@angular-devkit/core',
                '@typescript-eslint/eslint-plugin',
              ],
            },
          ],
        },
      },
    ],
    ignorePatterns: ['!**/*'],
  };
  const eslintConfigContentsAsString = JSON.stringify(eslintConfigContents);

  tree.write(
    `${projectOpts.appRoot}/.eslintrc.json`,
    eslintConfigContentsAsString
  );
  fs.createFileSync(
    `${projectOpts.appRoot}/.eslintrc.json`,
    eslintConfigContentsAsString
  );

  tree.write(`${projectOpts.appRoot}/src/foo.ts`, `export const myValue = 2;`);
  fs.createFileSync(
    `${projectOpts.appRoot}/src/foo.ts`,
    `export const myValue = 2;`
  );
  jest.doMock(
    join(fs.tempDir, `${projectOpts.appRoot}/.eslintrc.json`),
    () => ({
      default: {
        extends: '../../.eslintrc',
        rules: {},
        overrides: [
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            rules: {},
          },
          {
            files: ['**/*.ts'],
            excludedFiles: ['./src/migrations/**'],
            rules: {
              'no-restricted-imports': ['error', '@nx/workspace'],
            },
          },
          {
            files: [
              './package.json',
              './generators.json',
              './executors.json',
              './migrations.json',
            ],
            parser: 'jsonc-eslint-parser',
            rules: {
              '@nx/nx-plugin-checks': 'error',
            },
          },
          {
            files: ['./package.json'],
            parser: 'jsonc-eslint-parser',
            rules: {
              '@nx/dependency-checks': [
                'error',
                {
                  buildTargets: ['build-base'],
                  ignoredDependencies: [
                    'nx',
                    '@nx/jest',
                    'typescript',
                    'eslint',
                    '@angular-devkit/core',
                    '@typescript-eslint/eslint-plugin',
                  ],
                },
              ],
            },
          },
        ],
        ignorePatterns: ['!**/*'],
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

describe('Eslint - Convert Executors To Plugin', () => {
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('eslint');
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
    it('should setup a new Eslint plugin and only migrate one specific project', async () => {
      // ARRANGE
      const existingProject = createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
        targetName: 'lint',
      });
      const project = createTestProject(tree, {
        targetName: 'eslint',
      });
      const secondProject = createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        targetName: 'eslint',
      });
      const thirdProject = createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        targetName: 'linter',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/eslint/plugin',
        options: {
          targetName: 'lint',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { project: 'myapp', skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      const targetKeys = Object.keys(updatedProject.targets);
      ['lint'].forEach((key) => expect(targetKeys).not.toContain(key));

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedTestEslintPlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/eslint/plugin' &&
          plugin.include?.length === 1
        ) {
          return true;
        }
      });
      expect(addedTestEslintPlugin).toBeTruthy();
      expect(
        (addedTestEslintPlugin as ExpandedPluginConfiguration).include
      ).toEqual(['myapp/**/*']);
    });

    it('should add project to existing plugins includes', async () => {
      // ARRANGE
      const existingProject = createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
        targetName: 'lint',
      });
      const project = createTestProject(tree, {
        targetName: 'lint',
      });
      const secondProject = createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        targetName: 'lint',
      });
      const thirdProject = createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        targetName: 'lint',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/eslint/plugin',
        include: ['existing/**/*'],
        options: {
          targetName: 'lint',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { project: 'myapp', skipFormat: true });

      // ASSERT

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedTestEslintPlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/eslint/plugin' &&
          plugin.include?.length === 2
        ) {
          return true;
        }
      });
      expect(addedTestEslintPlugin).toBeTruthy();
      expect(
        (addedTestEslintPlugin as ExpandedPluginConfiguration).include
      ).toEqual(['existing/**/*', 'myapp/**/*']);
    });

    it('should remove include when all projects are included', async () => {
      jest.doMock(
        '.eslintrc.base.json',
        () => ({
          ignorePatterns: ['**/*'],
        }),
        { virtual: true }
      );
      fs.createFileSync(
        '.eslintrc.base.json',
        JSON.stringify({ ignorePatterns: ['**/*'] })
      );
      tree.write(
        '.eslintrc.base.json',
        JSON.stringify({ ignorePatterns: ['**/*'] })
      );
      // ARRANGE
      const existingProject = createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
        targetName: 'lint',
      });
      const project = createTestProject(tree, {
        targetName: 'lint',
      });
      const secondProject = createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        targetName: 'lint',
      });
      const thirdProject = createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        targetName: 'lint',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/eslint/plugin',
        include: ['existing/**/*', 'second/**/*', 'third/**/*'],
        options: {
          targetName: 'lint',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { project: 'myapp', skipFormat: true });

      // ASSERT
      const projectJsonForProject = readJson(
        tree,
        `${project.root}/project.json`
      );
      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedTestEslintPlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/eslint/plugin' &&
          !plugin.include
        ) {
          return true;
        }
      });
      expect(addedTestEslintPlugin).toBeTruthy();
      expect(
        (addedTestEslintPlugin as ExpandedPluginConfiguration).include
      ).not.toBeDefined();
    });

    it('should remove inputs when they are inferred', async () => {
      const project = createTestProject(tree);
      project.targets.lint.options.cacheLocation = 'cache-dir';
      updateProjectConfiguration(tree, project.name, project);
      createTestProject(tree, { appRoot: 'second', appName: 'second' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/eslint:lint'] = {
        inputs: ['default', '^default', '{projectRoot}/.eslintrc.json'],
      };
      updateNxJson(tree, nxJson);

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.lint.inputs).toBeUndefined();
    });

    it('should add external dependencies input from inferred task', async () => {
      const project = createTestProject(tree);
      createTestProject(tree, { appRoot: 'second', appName: 'second' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/eslint:lint'] = {
        inputs: [
          'default',
          '{projectRoot}/.eslintrc.json',
          '{projectRoot}/.eslintignore',
          '{projectRoot}/eslint.config.js',
        ],
      };
      updateNxJson(tree, nxJson);

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.lint.inputs).toStrictEqual([
        'default',
        '{projectRoot}/.eslintrc.json',
        '{projectRoot}/.eslintignore',
        '{projectRoot}/eslint.config.js',
        { externalDependencies: ['eslint'] },
      ]);
    });

    it('should merge external dependencies input from inferred task', async () => {
      const project = createTestProject(tree);
      createTestProject(tree, { appRoot: 'second', appName: 'second' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/eslint:lint'] = {
        inputs: [
          'default',
          '{projectRoot}/.eslintrc.json',
          '{projectRoot}/.eslintignore',
          '{projectRoot}/eslint.config.js',
          { externalDependencies: ['eslint-plugin-react'] },
        ],
      };
      updateNxJson(tree, nxJson);

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.lint.inputs).toStrictEqual([
        'default',
        '{projectRoot}/.eslintrc.json',
        '{projectRoot}/.eslintignore',
        '{projectRoot}/eslint.config.js',
        { externalDependencies: ['eslint-plugin-react', 'eslint'] },
      ]);
    });

    it('should not duplicate already existing external dependencies input', async () => {
      const project = createTestProject(tree);
      createTestProject(tree, { appRoot: 'second', appName: 'second' });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/eslint:lint'] = {
        inputs: [
          'default',
          '{projectRoot}/.eslintrc.json',
          '{projectRoot}/.eslintignore',
          '{projectRoot}/eslint.config.js',
          { externalDependencies: ['eslint', 'eslint-plugin-react'] },
        ],
      };
      updateNxJson(tree, nxJson);

      await convertToInferred(tree, {
        project: project.name,
        skipFormat: true,
      });

      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.lint.inputs).toStrictEqual([
        'default',
        '{projectRoot}/.eslintrc.json',
        '{projectRoot}/.eslintignore',
        '{projectRoot}/eslint.config.js',
        { externalDependencies: ['eslint', 'eslint-plugin-react'] },
      ]);
    });
  });

  describe('--all', () => {
    it('should successfully migrate a project using Eslint executors to plugin', async () => {
      const project = createTestProject(tree);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const hasEslintPlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/eslint/plugin'
          : plugin.plugin === '@nx/eslint/plugin'
      );
      expect(hasEslintPlugin).toBeTruthy();
      if (typeof hasEslintPlugin !== 'string') {
        [['targetName', 'lint']].forEach(([targetOptionName, targetName]) => {
          expect(hasEslintPlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    });

    it('should setup Eslint plugin to match projects', async () => {
      // ARRANGE
      const project = createTestProject(tree, {
        targetName: 'eslint',
      });

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const hasEslintPlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/eslint/plugin'
          : plugin.plugin === '@nx/eslint/plugin'
      );
      expect(hasEslintPlugin).toBeTruthy();
      if (typeof hasEslintPlugin !== 'string') {
        [['targetName', 'eslint']].forEach(([targetOptionName, targetName]) => {
          expect(hasEslintPlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    });

    it('should handle targets using legacy executor', async () => {
      // ARRANGE
      const project = createTestProject(tree, {
        targetName: 'eslint',
        legacyExecutor: true,
      });

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const hasEslintPlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/eslint/plugin'
          : plugin.plugin === '@nx/eslint/plugin'
      );
      expect(hasEslintPlugin).toBeTruthy();
      if (typeof hasEslintPlugin !== 'string') {
        [['targetName', 'eslint']].forEach(([targetOptionName, targetName]) => {
          expect(hasEslintPlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    });

    it('should setup a new Eslint plugin to match only projects migrated', async () => {
      // ARRANGE
      const existingProject = createTestProject(tree, {
        appRoot: 'existing',
        appName: 'existing',
        targetName: 'lint',
      });
      const project = createTestProject(tree, {
        targetName: 'eslint',
      });
      const secondProject = createTestProject(tree, {
        appRoot: 'second',
        appName: 'second',
        targetName: 'eslint',
      });
      const thirdProject = createTestProject(tree, {
        appRoot: 'third',
        appName: 'third',
        targetName: 'linter',
      });
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/eslint/plugin',
        options: {
          targetName: 'lint',
        },
      });
      updateNxJson(tree, nxJson);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const addedLintEslintPlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/eslint/plugin' &&
          plugin.include?.length === 2
        ) {
          return true;
        }
      });
      expect(addedLintEslintPlugin).toBeTruthy();
      expect(
        (addedLintEslintPlugin as ExpandedPluginConfiguration).include
      ).toEqual(['myapp/**/*', 'second/**/*']);

      const addedLinterEslintPlugin = nxJsonPlugins.find((plugin) => {
        if (
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/eslint/plugin' &&
          plugin.include?.length === 1
        ) {
          return true;
        }
      });
      expect(addedLinterEslintPlugin).toBeTruthy();
      expect(
        (addedLinterEslintPlugin as ExpandedPluginConfiguration).include
      ).toEqual(['third/**/*']);
    });

    it('should keep Eslint options in project.json', async () => {
      // ARRANGE
      const project = createTestProject(tree);
      project.targets.lint.options.cacheLocation = 'cache-dir';
      updateProjectConfiguration(tree, project.name, project);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.lint).toMatchInlineSnapshot(`
        {
          "options": {
            "cache-location": "cache-dir",
            "config": ".eslintrc.json",
          },
        }
      `);

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const hasEslintPlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/eslint/plugin'
          : plugin.plugin === '@nx/eslint/plugin'
      );
      expect(hasEslintPlugin).toBeTruthy();
      if (typeof hasEslintPlugin !== 'string') {
        [['targetName', 'lint']].forEach(([targetOptionName, targetName]) => {
          expect(hasEslintPlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    });

    it('should add Eslint options found in targetDefaults for the executor to the project.json', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['@nx/eslint:lint'] = {
        options: {
          maxWarnings: 10,
        },
      };
      updateNxJson(tree, nxJson);
      const project = createTestProject(tree);

      // ACT
      await convertToInferred(tree, { skipFormat: true });

      // ASSERT
      // project.json modifications
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.lint).toMatchInlineSnapshot(`
        {
          "options": {
            "config": ".eslintrc.json",
            "max-warnings": 10,
          },
        }
      `);

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const hasEslintPlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/eslint/plugin'
          : plugin.plugin === '@nx/eslint/plugin'
      );
      expect(hasEslintPlugin).toBeTruthy();
      if (typeof hasEslintPlugin !== 'string') {
        [['targetName', 'lint']].forEach(([targetOptionName, targetName]) => {
          expect(hasEslintPlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    });
  });
});
