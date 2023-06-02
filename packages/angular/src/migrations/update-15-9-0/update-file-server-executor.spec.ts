import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import updateFileServerExecutor from './update-file-server-executor';

describe('updateFileServerExecutor', () => {
  it('it should change the executor correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const project = {
      name: 'test',
      root: '/',
      sourceRoot: '/src',
      targets: {
        serve: {
          executor: '@nrwl/angular:file-server',
          options: {},
        },
      },
    };

    addProjectConfiguration(tree, 'test', project);

    // ACT
    await updateFileServerExecutor(tree);

    // AWAIT
    const updatedProject = readProjectConfiguration(tree, 'test');
    expect(updatedProject.targets.serve.executor).toEqual(
      '@nrwl/web:file-server'
    );
    expect(
      readJson(tree, 'package.json').devDependencies['@nrwl/web']
    ).toBeTruthy();
  });

  it('it should change the executor correctly in nx.json', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const nxJson = readNxJson(tree);
    updateNxJson(tree, {
      ...nxJson,
      targetDefaults: {
        ...(nxJson.targetDefaults ?? {}),
        serve: {
          executor: '@nrwl/angular:file-server',
        },
      },
    });

    // ACT
    await updateFileServerExecutor(tree);

    // AWAIT
    const updatedNxJson = readNxJson(tree);
    expect(updatedNxJson.targetDefaults.serve.executor).toEqual(
      '@nrwl/web:file-server'
    );
  });

  it('should handle projects with no targets', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const project = {
      name: 'test',
      root: '/',
      sourceRoot: '/src',
    };

    addProjectConfiguration(tree, 'test', project);

    // ACT
    await expect(updateFileServerExecutor(tree)).resolves.not.toThrow();
  });
});
