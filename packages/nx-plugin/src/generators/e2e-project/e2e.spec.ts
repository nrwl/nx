import {
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
  readJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { e2eProjectGenerator } from './e2e';

describe('NxPlugin e2e-project Generator', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    // add a plugin project to the workspace for validations
    addProjectConfiguration(tree, 'my-plugin', {
      root: 'libs/my-plugin',
      targets: {},
    });
  });

  it('should validate the plugin name', async () => {
    await expect(
      e2eProjectGenerator(tree, {
        pluginName: 'my-plugin',
        pluginOutputPath: `dist/libs/my-plugin`,
        npmPackageName: '@proj/my-plugin',
      })
    ).resolves.not.toThrow();

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

  it('should update the nxJson', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
    });

    expect(readJson(tree, 'nx.json')).toMatchObject({
      projects: {
        'my-plugin-e2e': {
          tags: [],
          implicitDependencies: ['my-plugin'],
        },
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
    expect(project.targets.e2e).toMatchObject({
      executor: '@nrwl/nx-plugin:e2e',
      options: expect.objectContaining({
        target: 'my-plugin:build',
        npmPackageName: '@proj/my-plugin',
        pluginOutputPath: 'dist/libs/my-plugin',
      }),
    });
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
        jestConfig: 'apps/my-plugin-e2e/jest.config.js',
      }),
    });

    expect(tree.exists('apps/my-plugin-e2e/tsconfig.spec.json')).toBeTruthy();
    expect(tree.exists('apps/my-plugin-e2e/jest.config.js')).toBeTruthy();
  });
});
