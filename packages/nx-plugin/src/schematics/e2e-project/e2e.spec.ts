import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { updateWorkspace, readWorkspace, getWorkspace } from '@nrwl/workspace';
import { runSchematic } from '../../utils/testing';

describe('NxPlugin e2e-project', () => {
  let appTree: Tree;
  beforeEach(() => {
    appTree = createEmptyWorkspace(Tree.empty());
    // add a plugin project to the workspace for validations
    updateWorkspace((workspace) => {
      workspace.projects.add({ name: 'my-plugin', root: 'libs/my-plugin' });
    })(appTree, null);
  });

  it('should validate the plugin name', async () => {
    await expect(
      runSchematic(
        'e2e-project',
        {
          pluginName: 'my-plugin',
          pluginOutputPath: `dist/libs/my-plugin`,
          npmPackageName: '@proj/my-plugin',
        },
        appTree
      )
    ).resolves.not.toThrow();

    await expect(
      runSchematic(
        'e2e-project',
        {
          pluginName: 'my-nonexistentplugin',
          pluginOutputPath: `dist/libs/my-nonexistentplugin`,
          npmPackageName: '@proj/my-nonexistentplugin',
        },
        appTree
      )
    ).rejects.toThrow();
  });

  it('should add files related to e2e', async () => {
    const tree = await runSchematic(
      'e2e-project',
      {
        pluginName: 'my-plugin',
        pluginOutputPath: `dist/libs/my-plugin`,
        npmPackageName: '@proj/my-plugin',
      },
      appTree
    );
    expect(tree.exists('apps/my-plugin-e2e/tsconfig.json')).toBeTruthy();
    expect(
      tree.exists('apps/my-plugin-e2e/tests/my-plugin.test.ts')
    ).toBeTruthy();
  });

  it('should set project root with the directory option', async () => {
    const tree = await runSchematic(
      'e2e-project',
      {
        pluginName: 'my-plugin',
        pluginOutputPath: `dist/libs/namespace/my-plugin`,
        npmPackageName: '@proj/namespace-my-plugin',
        projectDirectory: 'namespace/my-plugin',
      },
      appTree
    );
    const workspace = await readWorkspace(tree);
    const project = workspace.projects['my-plugin-e2e'];
    expect(project.root).toBe('apps/namespace/my-plugin-e2e');
  });

  it('should update the nxJson', async () => {
    const tree = await runSchematic(
      'e2e-project',
      {
        pluginName: 'my-plugin',
        pluginOutputPath: `dist/libs/my-plugin`,
        npmPackageName: '@proj/my-plugin',
      },
      appTree
    );
    expect(JSON.parse(tree.readContent('nx.json'))).toMatchObject({
      projects: {
        'my-plugin-e2e': {
          tags: [],
          implicitDependencies: ['my-plugin'],
        },
      },
    });
  });

  it('should update the workspace', async () => {
    const tree = await runSchematic(
      'e2e-project',
      {
        pluginName: 'my-plugin',
        pluginOutputPath: `dist/libs/my-plugin`,
        npmPackageName: '@proj/my-plugin',
      },
      appTree
    );
    const workspace = await getWorkspace(tree);
    const project = workspace.projects.get('my-plugin-e2e');
    expect(project).toBeTruthy();
    expect(project.root).toEqual('apps/my-plugin-e2e');
    expect(project.targets.get('e2e')).toBeTruthy();
    expect(project.targets.get('e2e')).toMatchObject({
      builder: '@nrwl/nx-plugin:e2e',
      options: expect.objectContaining({
        target: 'my-plugin:build',
        npmPackageName: '@proj/my-plugin',
        pluginOutputPath: 'dist/libs/my-plugin',
      }),
    });
  });

  it('should add jest support', async () => {
    const tree = await runSchematic(
      'e2e-project',
      {
        pluginName: 'my-plugin',
        pluginOutputPath: `dist/libs/my-plugin`,
        npmPackageName: '@proj/my-plugin',
      },
      appTree
    );
    const workspace = await getWorkspace(tree);
    const project = workspace.projects.get('my-plugin-e2e');
    expect(project.targets.get('e2e')).toMatchObject({
      options: expect.objectContaining({
        tsSpecConfig: 'apps/my-plugin-e2e/tsconfig.spec.json',
        jestConfig: 'apps/my-plugin-e2e/jest.config.js',
      }),
    });

    expect(tree.exists('apps/my-plugin-e2e/tsconfig.spec.json')).toBeTruthy();
    expect(tree.exists('apps/my-plugin-e2e/jest.config.js')).toBeTruthy();
  });
});
