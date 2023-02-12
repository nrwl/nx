import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  addProjectConfiguration,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nrwl/devkit';
import addStorybookInputs from './add-storybook-inputs';

describe('15.0.0 migration (add-storybook-inputs)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add inputs configuration for storybook targets', async () => {
    updateNxJson(tree, {
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        sharedGlobals: [],
        production: ['default'],
      },
    });
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        'build-storybook': {
          executor: '@nrwl/storybook:build',
          options: {},
        },
        'build-storybook2': {
          executor: '@nrwl/storybook:build',
          options: {},
        },
        notStorybook: {
          executor: 'nx:run-commands',
        },
      },
    });
    tree.write('.storybook/main.js', '');

    await addStorybookInputs(tree);

    const updated = readNxJson(tree);
    expect(updated).toMatchInlineSnapshot(`
      Object {
        "namedInputs": Object {
          "default": Array [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": Array [
            "default",
            "!{projectRoot}/.storybook/**/*",
            "!{projectRoot}/**/*.stories.@(js|jsx|ts|tsx|mdx)",
          ],
          "sharedGlobals": Array [],
        },
        "targetDefaults": Object {
          "build-storybook": Object {
            "inputs": Array [
              "default",
              "^production",
              "{workspaceRoot}/.storybook/**/*",
            ],
          },
          "build-storybook2": Object {
            "inputs": Array [
              "default",
              "^production",
              "{workspaceRoot}/.storybook/**/*",
            ],
          },
        },
      }
    `);
  });

  it('should add inputs configuration for angular storybook targets', async () => {
    updateNxJson(tree, {
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        sharedGlobals: [],
        production: ['default'],
      },
    });
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        'build-storybook': {
          executor: '@storybook/angular:build-storybook',
          options: {},
        },
        'build-storybook2': {
          executor: '@storybook/angular:build-storybook',
          options: {},
        },
        notStorybook: {
          executor: 'nx:run-commands',
        },
      },
    });
    tree.write('.storybook/main.js', '');

    await addStorybookInputs(tree);

    const updated = readNxJson(tree);
    expect(updated).toMatchInlineSnapshot(`
      Object {
        "namedInputs": Object {
          "default": Array [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": Array [
            "default",
            "!{projectRoot}/.storybook/**/*",
            "!{projectRoot}/**/*.stories.@(js|jsx|ts|tsx|mdx)",
          ],
          "sharedGlobals": Array [],
        },
        "targetDefaults": Object {
          "build-storybook": Object {
            "inputs": Array [
              "default",
              "^production",
              "{workspaceRoot}/.storybook/**/*",
            ],
          },
          "build-storybook2": Object {
            "inputs": Array [
              "default",
              "^production",
              "{workspaceRoot}/.storybook/**/*",
            ],
          },
        },
      }
    `);
  });
});
