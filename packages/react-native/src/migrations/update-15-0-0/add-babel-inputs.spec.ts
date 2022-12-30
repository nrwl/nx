import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  Tree,
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import addBabelInputs from './add-babel-inputs';

describe('15.0.0 migration (add-babel-inputs)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add babel.config.json to sharedGlobals', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        sharedGlobals: [],
        production: ['default'],
      },
    });
    tree.write('babel.config.json', '');

    await addBabelInputs(tree);

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
          ],
          "sharedGlobals": Array [
            "{workspaceRoot}/babel.config.json",
          ],
        },
        "version": 2,
      }
    `);
  });

  it('should add babel.config.js', async () => {
    updateWorkspaceConfiguration(tree, {
      version: 2,
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        sharedGlobals: [],
        production: ['default'],
      },
    });
    tree.write('babel.config.js', '');

    await addBabelInputs(tree);

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
          ],
          "sharedGlobals": Array [
            "{workspaceRoot}/babel.config.js",
          ],
        },
        "version": 2,
      }
    `);
  });
});
