import fixTargetDefaultsInputs from './fix-target-defaults-inputs';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, readNxJson, updateNxJson } from '@nx/devkit';

describe('fixTargetDefaultsInputs', () => {
  it('should add the executor and input when it does not exist', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'test', {
      root: '',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
        },
      },
    });
    tree.write('module-federation.config.ts', '');

    // ACT
    await fixTargetDefaultsInputs(tree);

    // ASSERT
    const nxJson = readNxJson(tree);
    expect(nxJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "@nx/webpack:webpack": {
          "inputs": [
            "production",
            "^production",
            {
              "env": "NX_MF_DEV_SERVER_STATIC_REMOTES",
            },
          ],
        },
        "build": {
          "cache": true,
        },
        "lint": {
          "cache": true,
        },
      }
    `);
  });

  it('should not add the executor and input when no project uses it', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'test', {
      root: '',
      targets: {
        build: {
          executor: '@nx/angular:module-federation-dev-server',
        },
      },
    });

    // ACT
    await fixTargetDefaultsInputs(tree);

    // ASSERT
    const nxJson = readNxJson(tree);
    expect(nxJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "cache": true,
        },
        "lint": {
          "cache": true,
        },
      }
    `);
  });

  it('should update the executor and input target default when it already exists', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'test', {
      root: '',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
        },
      },
    });

    tree.write('module-federation.config.ts', '');

    let nxJson = readNxJson(tree);
    nxJson = {
      ...nxJson,
      targetDefaults: {
        ...nxJson.targetDefaults,
        ['@nx/webpack:webpack']: {
          inputs: ['^build'],
        },
      },
    };

    updateNxJson(tree, nxJson);

    // ACT
    await fixTargetDefaultsInputs(tree);

    // ASSERT
    nxJson = readNxJson(tree);
    expect(nxJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "@nx/webpack:webpack": {
          "inputs": [
            "^build",
            "production",
            "^production",
            {
              "env": "NX_MF_DEV_SERVER_STATIC_REMOTES",
            },
          ],
        },
        "build": {
          "cache": true,
        },
        "lint": {
          "cache": true,
        },
      }
    `);
  });
});
