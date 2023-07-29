import {
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
  readJson,
  getProjects,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { e2eProjectGenerator } from './e2e';

describe('NxPlugin e2e-project Generator', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // add a plugin project to the workspace for validations
    addProjectConfiguration(tree, 'my-plugin', {
      root: 'libs/my-plugin',
      targets: {},
    });
    writeJson(tree, 'libs/my-plugin/package.json', {
      name: 'my-plugin',
    });
  });

  it('should validate the plugin name', async () => {
    await expect(
      e2eProjectGenerator(tree, {
        pluginName: 'my-plugin',
        pluginOutputPath: `dist/libs/my-plugin`,
        npmPackageName: '@proj/my-plugin',
      })
    ).resolves.toBeDefined();

    await expect(
      e2eProjectGenerator(tree, {
        pluginName: 'my-nonexistentplugin',
        pluginOutputPath: `dist/libs/my-nonexistentplugin`,
        npmPackageName: '@proj/my-nonexistentplugin',
      })
    ).rejects.toThrow();
  });

  it('should add files related to e2e', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
    });

    expect(tree.exists('apps/my-plugin-e2e/tsconfig.json')).toBeTruthy();
    expect(
      tree.exists('apps/my-plugin-e2e/tests/my-plugin.spec.ts')
    ).toBeTruthy();
  });

  it('should extend from root tsconfig.base.json', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
    });

    const tsConfig = readJson(tree, 'apps/my-plugin-e2e/tsconfig.json');
    expect(tsConfig.extends).toEqual('../../tsconfig.base.json');
  });

  it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');

    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
    });

    const tsConfig = readJson(tree, 'apps/my-plugin-e2e/tsconfig.json');
    expect(tsConfig.extends).toEqual('../../tsconfig.json');
  });

  it('should set project root with the directory option', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/namespace/my-plugin`,
      npmPackageName: '@proj/namespace-my-plugin',
      projectDirectory: 'namespace/my-plugin',
    });

    const project = readProjectConfiguration(tree, 'my-plugin-e2e');
    expect(project.root).toBe('apps/namespace/my-plugin-e2e');
  });

  it('should update the implicit dependencies', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
    });
    const projects = Object.fromEntries(getProjects(tree));
    expect(projects).toMatchObject({
      'my-plugin-e2e': {
        implicitDependencies: ['my-plugin'],
      },
    });
  });

  it('should update the workspace', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
    });

    const project = readProjectConfiguration(tree, 'my-plugin-e2e');

    expect(project).toBeTruthy();
    expect(project.root).toEqual('apps/my-plugin-e2e');
    expect(project.targets.e2e).toBeTruthy();
    expect(project.targets.e2e).toMatchInlineSnapshot(`
      {
        "configurations": {
          "ci": {
            "ci": true,
            "codeCoverage": true,
          },
        },
        "dependsOn": [
          "^build",
        ],
        "executor": "@nx/jest:jest",
        "options": {
          "jestConfig": "apps/my-plugin-e2e/jest.config.ts",
          "passWithNoTests": true,
          "runInBand": true,
        },
        "outputs": [
          "{workspaceRoot}/coverage/{projectRoot}",
        ],
      }
    `);
  });

  it('should add jest support', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
    });

    const project = readProjectConfiguration(tree, 'my-plugin-e2e');

    expect(project.targets.e2e).toMatchObject({
      options: expect.objectContaining({
        jestConfig: 'apps/my-plugin-e2e/jest.config.ts',
      }),
    });

    expect(tree.exists('apps/my-plugin-e2e/tsconfig.spec.json')).toBeTruthy();
    expect(tree.exists('apps/my-plugin-e2e/jest.config.ts')).toBeTruthy();
  });

  it('should setup the eslint builder', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
    });

    const projectsConfigurations = getProjects(tree);
    expect(projectsConfigurations.get('my-plugin-e2e').targets.lint).toEqual({
      executor: '@nx/linter:eslint',
      outputs: ['{options.outputFile}'],
      options: {
        lintFilePatterns: ['apps/my-plugin-e2e/**/*.ts'],
      },
    });
  });
});
