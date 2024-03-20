import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { initGenerator } from './init';

describe('@nx/gradle:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('settings.gradle', '');
  });

  it('should add the plugin', async () => {
    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: false,
    });
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toMatchInlineSnapshot(`
      [
        {
          "options": {
            "buildTargetName": "build",
            "classesTargetName": "classes",
            "testTargetName": "test",
          },
          "plugin": "@nx/gradle",
        },
      ]
    `);
  });

  it('should not overwrite existing plugins', async () => {
    updateNxJson(tree, {
      plugins: ['foo'],
    });
    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: false,
    });
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toMatchInlineSnapshot(`
      [
        "foo",
        {
          "options": {
            "buildTargetName": "build",
            "classesTargetName": "classes",
            "testTargetName": "test",
          },
          "plugin": "@nx/gradle",
        },
      ]
    `);
  });

  it('should not add plugin if already in array', async () => {
    updateNxJson(tree, {
      plugins: ['@nx/gradle'],
    });
    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: false,
    });
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toMatchInlineSnapshot(`
      [
        "@nx/gradle",
      ]
    `);
  });
});
