import { ProjectGraph, readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { initGenerator } from './init';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('@nx/playwright:init', () => {
  let tree: Tree;

  beforeEach(() => {
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add the plugin', async () => {
    await initGenerator(tree, {
      skipFormat: true,
      addPlugin: true,
      skipPackageJson: false,
    });
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
    await initGenerator(tree, {
      skipFormat: true,
      addPlugin: true,
      skipPackageJson: false,
    });
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
    await initGenerator(tree, {
      skipFormat: true,
      addPlugin: true,
      skipPackageJson: false,
    });
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toMatchInlineSnapshot(`
      [
        "@nx/playwright/plugin",
      ]
    `);
  });

  it('should not add plugin if NX_ADD_PLUGINS variable is set', async () => {
    await initGenerator(tree, {
      skipFormat: true,
      addPlugin: false,
      skipPackageJson: false,
    });
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toMatchInlineSnapshot(`undefined`);
  });
});
