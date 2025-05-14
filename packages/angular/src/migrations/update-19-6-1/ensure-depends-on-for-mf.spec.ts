import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readNxJson,
  updateNxJson,
  type Tree,
} from '@nx/devkit';
import ensureDependsOnForMf from './ensure-depends-on-for-mf';

describe('ensure-depends-on-for-mf', () => {
  it('should ensure targetDefault is added correctly if not exists', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['@nx/angular:webpack-browser'] = {
      inputs: ['production', '^production'],
    };
    updateNxJson(tree, nxJson);
    addProject(tree);

    // ACT
    await ensureDependsOnForMf(tree);

    // ASSERT
    expect(readNxJson(tree).targetDefaults['@nx/angular:webpack-browser'])
      .toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "^build",
        ],
        "inputs": [
          "production",
          "^production",
          {
            "env": "NX_MF_DEV_REMOTES",
          },
        ],
      }
    `);
  });

  it('should ensure targetDefault is added correctly if there are no targetDefaults', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults = {};
    updateNxJson(tree, nxJson);
    addProject(tree);

    // ACT
    await ensureDependsOnForMf(tree);

    // ASSERT
    expect(readNxJson(tree).targetDefaults['@nx/angular:webpack-browser'])
      .toMatchInlineSnapshot(`
      {
        "cache": true,
        "dependsOn": [
          "^build",
        ],
        "inputs": [
          "default",
          "^default",
          {
            "env": "NX_MF_DEV_REMOTES",
          },
        ],
      }
    `);
  });

  it('should ensure targetDefault is updated correctly if missing ^build', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['@nx/angular:webpack-browser'] = {
      inputs: ['production', '^production'],
      dependsOn: ['some-task'],
    };
    updateNxJson(tree, nxJson);
    addProject(tree);

    // ACT
    await ensureDependsOnForMf(tree);

    // ASSERT
    expect(readNxJson(tree).targetDefaults['@nx/angular:webpack-browser'])
      .toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "some-task",
          "^build",
        ],
        "inputs": [
          "production",
          "^production",
          {
            "env": "NX_MF_DEV_REMOTES",
          },
        ],
      }
    `);
  });

  it('should do nothing if targetDefault is set up correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['@nx/angular:webpack-browser'] = {
      inputs: ['production', '^production', { env: 'NX_MF_DEV_REMOTES' }],
      dependsOn: ['^build'],
    };
    updateNxJson(tree, nxJson);
    addProject(tree);

    // ACT
    await ensureDependsOnForMf(tree);

    // ASSERT
    expect(readNxJson(tree).targetDefaults['@nx/angular:webpack-browser'])
      .toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "^build",
        ],
        "inputs": [
          "production",
          "^production",
          {
            "env": "NX_MF_DEV_REMOTES",
          },
        ],
      }
    `);
  });
});

function addProject(tree: Tree) {
  tree.write('app/webpack.config.ts', `withModuleFederation`);
  addProjectConfiguration(tree, 'app', {
    name: 'app',
    root: 'app',
    projectType: 'application',
    targets: {
      build: {
        executor: '@nx/angular:webpack-browser',
        options: { webpackConfig: 'app/webpack.config.ts' },
      },
    },
  });
}
