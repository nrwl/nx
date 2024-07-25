import addCiTargetNameTargetDefault from './add-ci-target-name-target-default';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { readNxJson, updateNxJson } from 'nx/src/devkit-exports';

describe('addCiTargetNameTargetDefault', () => {
  it('should find and add the ciTargetName to targetDefaults with dependsOn: ["^build"]', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const oldNxJson = readNxJson(tree);
    oldNxJson.targetDefaults ??= {};
    oldNxJson.plugins ??= [];
    oldNxJson.plugins.push({
      plugin: '@nx/playwright/plugin',
      options: {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      },
    });
    updateNxJson(tree, oldNxJson);

    // ACT
    addCiTargetNameTargetDefault(tree);

    // ASSERT
    const nxJson = readNxJson(tree);
    expect(nxJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "cache": true,
        },
        "e2e-ci--**/*": {
          "dependsOn": [
            "^build",
          ],
        },
        "lint": {
          "cache": true,
        },
      }
    `);
  });

  it('should find and add the ciTargetName to targetDefaults with dependsOn: ["^build"]', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const oldNxJson = readNxJson(tree);
    oldNxJson.targetDefaults ??= {};
    oldNxJson.plugins ??= [];
    oldNxJson.plugins.push({
      plugin: '@nx/playwright/plugin',
      options: {
        targetName: 'e2e',
        ciTargetName: 'playwright:e2e-ci',
      },
    });
    updateNxJson(tree, oldNxJson);

    // ACT
    addCiTargetNameTargetDefault(tree);

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
        "playwright:e2e-ci--**/*": {
          "dependsOn": [
            "^build",
          ],
        },
      }
    `);
  });

  it('should find and not add the ciTargetName to targetDefaults when it already exists', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const oldNxJson = readNxJson(tree);
    oldNxJson.targetDefaults ??= {};
    oldNxJson.targetDefaults['playwright:e2e-ci--**/*'] = {
      inputs: ['somefile.ts'],
    };
    oldNxJson.plugins ??= [];
    oldNxJson.plugins.push({
      plugin: '@nx/playwright/plugin',
      options: {
        targetName: 'e2e',
        ciTargetName: 'playwright:e2e-ci',
      },
    });
    updateNxJson(tree, oldNxJson);

    // ACT
    addCiTargetNameTargetDefault(tree);

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
        "playwright:e2e-ci--**/*": {
          "inputs": [
            "somefile.ts",
          ],
        },
      }
    `);
  });
});
