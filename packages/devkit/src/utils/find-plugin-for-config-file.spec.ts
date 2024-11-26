import { type Tree, readNxJson, updateNxJson } from 'nx/src/devkit-exports';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { findPluginForConfigFile } from './find-plugin-for-config-file';

describe('find-plugin-for-config-file', () => {
  let tree: Tree;
  let tempFs: TempFs;
  beforeEach(() => {
    tempFs = new TempFs('target-defaults-utils');
    tree = createTreeWithEmptyWorkspace();
    tree.root = tempFs.tempDir;
  });

  afterEach(() => {
    tempFs.cleanup();
    jest.resetModules();
  });

  it('should return the plugin when its registered as just a string', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push('@nx/cypress/plugin');
    updateNxJson(tree, nxJson);

    tree.write('apps/myapp-e2e/cypress.config.ts', '');
    await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

    // ACT
    const plugin = await findPluginForConfigFile(
      tree,
      '@nx/cypress/plugin',
      'apps/myapp-e2e/cypress.config.ts'
    );

    // ASSERT
    expect(plugin).toBeTruthy();
    expect(plugin).toEqual('@nx/cypress/plugin');
  });

  it('should return the plugin when it does not have an include or exclude', async () => {
    // ARRANGE
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

    tree.write('apps/myapp-e2e/cypress.config.ts', '');
    await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

    // ACT
    const plugin = await findPluginForConfigFile(
      tree,
      '@nx/cypress/plugin',
      'apps/myapp-e2e/cypress.config.ts'
    );

    // ASSERT
    expect(plugin).toBeTruthy();
    expect(plugin).toMatchInlineSnapshot(`
      {
        "options": {
          "ciTargetName": "e2e-ci",
          "targetName": "e2e",
        },
        "plugin": "@nx/cypress/plugin",
      }
    `);
  });

  it('should return the plugin when it the includes finds the config file', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/cypress/plugin',
      options: {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      include: ['libs/**'],
    });
    nxJson.plugins.push({
      plugin: '@nx/cypress/plugin',
      options: {
        targetName: 'e2e',
        ciTargetName: 'cypress:e2e-ci',
      },
      include: ['apps/**'],
    });
    updateNxJson(tree, nxJson);

    tree.write('apps/myapp-e2e/cypress.config.ts', '');
    await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

    // ACT
    const plugin = await findPluginForConfigFile(
      tree,
      '@nx/cypress/plugin',
      'apps/myapp-e2e/cypress.config.ts'
    );

    // ASSERT
    expect(plugin).toBeTruthy();
    expect(plugin).toMatchInlineSnapshot(`
      {
        "include": [
          "apps/**",
        ],
        "options": {
          "ciTargetName": "cypress:e2e-ci",
          "targetName": "e2e",
        },
        "plugin": "@nx/cypress/plugin",
      }
    `);
  });

  it('should return a valid plugin when it the excludes does not include the config file', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/cypress/plugin',
      options: {
        targetName: 'e2e',
        ciTargetName: 'cypress:e2e-ci',
      },
      exclude: ['apps/**'],
    });
    nxJson.plugins.push({
      plugin: '@nx/cypress/plugin',
      options: {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
      exclude: ['libs/**'],
    });
    updateNxJson(tree, nxJson);

    tree.write('apps/myapp-e2e/cypress.config.ts', '');
    await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

    // ACT
    const plugin = await findPluginForConfigFile(
      tree,
      '@nx/cypress/plugin',
      'apps/myapp-e2e/cypress.config.ts'
    );

    // ASSERT
    expect(plugin).toBeTruthy();
    expect(plugin).toMatchInlineSnapshot(`
      {
        "exclude": [
          "libs/**",
        ],
        "options": {
          "ciTargetName": "e2e-ci",
          "targetName": "e2e",
        },
        "plugin": "@nx/cypress/plugin",
      }
    `);
  });
});
