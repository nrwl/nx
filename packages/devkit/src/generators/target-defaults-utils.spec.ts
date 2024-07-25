import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { readNxJson, updateNxJson } from 'nx/src/devkit-exports';
import { addTargetDefault } from './target-defaults-utils';

describe('target-defaults-utils', () => {
  it('should not add a new target default entry when one exists already', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const oldNxJson = readNxJson(tree);
    oldNxJson.targetDefaults ??= {};
    oldNxJson.targetDefaults['build'] = {
      dependsOn: ['^build'],
    };
    updateNxJson(tree, oldNxJson);

    // ACT
    addTargetDefault(tree, 'build', { inputs: [] });

    // ASSERT
    const newNxJson = readNxJson(tree);
    expect(newNxJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
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

  it('should add a new target default entry when it does not already', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    addTargetDefault(tree, 'build-base', { inputs: [] });

    // ASSERT
    const newNxJson = readNxJson(tree);
    expect(newNxJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "cache": true,
        },
        "build-base": {
          "inputs": [],
        },
        "lint": {
          "cache": true,
        },
      }
    `);
  });
});
