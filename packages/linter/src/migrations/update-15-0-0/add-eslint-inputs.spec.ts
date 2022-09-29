import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  Tree,
  addProjectConfiguration,
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import addEslintInputs from './add-eslint-inputs';

describe('15.0.0 migration (add-eslint-inputs)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add inputs configuration for lint targets', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        sharedGlobals: [],
        production: ['default'],
      },
    });
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        lint: {
          executor: '@nrwl/linter:eslint',
          options: {},
        },
        lint2: {
          executor: '@nrwl/linter:eslint',
          options: {},
        },
        notTest: {
          executor: 'nx:run-commands',
        },
      },
    });
    tree.write('.eslintrc.json', '');

    await addEslintInputs(tree);

    const updated = readWorkspaceConfiguration(tree);
    expect(updated).toMatchInlineSnapshot(`
      Object {
        "namedInputs": Object {
          "default": Array [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": Array [
            "default",
            "!{projectRoot}/.eslintrc.json",
          ],
          "sharedGlobals": Array [],
        },
        "targetDefaults": Object {
          "lint": Object {
            "inputs": Array [
              "default",
              "{workspaceRoot}/.eslintrc.json",
            ],
          },
          "lint2": Object {
            "inputs": Array [
              "default",
              "{workspaceRoot}/.eslintrc.json",
            ],
          },
        },
        "version": 2,
      }
    `);
  });

  it('should add inputs configuration for .eslintrc.js', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        sharedGlobals: [],
        production: ['default'],
      },
    });
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        lint: {
          executor: '@nrwl/linter:eslint',
          options: {},
        },
        lint2: {
          executor: '@nrwl/linter:eslint',
          options: {},
        },
        notTest: {
          executor: 'nx:run-commands',
        },
      },
    });
    tree.write('.eslintrc.js', '');

    await addEslintInputs(tree);

    const updated = readWorkspaceConfiguration(tree);
    expect(updated).toMatchInlineSnapshot(`
      Object {
        "namedInputs": Object {
          "default": Array [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": Array [
            "default",
            "!{projectRoot}/.eslintrc.json",
          ],
          "sharedGlobals": Array [],
        },
        "targetDefaults": Object {
          "lint": Object {
            "inputs": Array [
              "default",
              "{workspaceRoot}/.eslintrc.js",
            ],
          },
          "lint2": Object {
            "inputs": Array [
              "default",
              "{workspaceRoot}/.eslintrc.js",
            ],
          },
        },
        "version": 2,
      }
    `);
  });
});
