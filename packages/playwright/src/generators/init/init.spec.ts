import { Tree, readNxJson, updateNxJson } from '@nx/devkit';
import { withEnvironmentVariables } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { initGenerator } from './init';

describe('@nx/playwright:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add the plugin if PCV3 is set', async () => {
    await withEnvironmentVariables(
      {
        NX_PCV3: 'true',
      },
      async () => {
        await initGenerator(tree, {
          skipFormat: true,
          skipPackageJson: false,
        });
      }
    );
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toMatchInlineSnapshot(`
      [
        {
          "options": {
            "targetName": "e2e",
          },
          "plugin": "@nx/playwright/plugin",
        },
      ]
    `);
  });

  it('should not overwrite existing plugins', async () => {
    updateNxJson(tree, {
      plugins: ['foo'],
    });
    await withEnvironmentVariables(
      {
        NX_PCV3: 'true',
      },
      async () => {
        await initGenerator(tree, {
          skipFormat: true,
          skipPackageJson: false,
        });
      }
    );
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toMatchInlineSnapshot(`
      [
        "foo",
        {
          "options": {
            "targetName": "e2e",
          },
          "plugin": "@nx/playwright/plugin",
        },
      ]
    `);
  });

  it('should not add plugin if already in array', async () => {
    updateNxJson(tree, {
      plugins: ['@nx/playwright/plugin'],
    });
    await withEnvironmentVariables(
      {
        NX_PCV3: 'true',
      },
      async () => {
        await initGenerator(tree, {
          skipFormat: true,
          skipPackageJson: false,
        });
      }
    );
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toMatchInlineSnapshot(`
      [
        "@nx/playwright/plugin",
      ]
    `);
  });

  it('should not add plugin if environment variable is not set', async () => {
    await withEnvironmentVariables(
      {
        NX_PCV3: undefined,
      },
      async () => {
        await initGenerator(tree, {
          skipFormat: true,
          skipPackageJson: false,
        });
      }
    );
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toMatchInlineSnapshot(`undefined`);
  });
});
