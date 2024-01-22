import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import addBabelInputs from './add-babel-inputs';

describe('15.0.0 migration (add-babel-inputs)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add babel.config.json to sharedGlobals', async () => {
    updateNxJson(tree, {
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        sharedGlobals: [],
        production: ['default'],
      },
    });
    tree.write('babel.config.json', '');

    await addBabelInputs(tree);

    const updated = readNxJson(tree);
    expect(updated).toMatchInlineSnapshot(`
      {
        "namedInputs": {
          "default": [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": [
            "default",
          ],
          "sharedGlobals": [
            "{workspaceRoot}/babel.config.json",
          ],
        },
      }
    `);
  });

  it('should add babel.config.js', async () => {
    updateNxJson(tree, {
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        sharedGlobals: [],
        production: ['default'],
      },
    });
    tree.write('babel.config.js', '');

    await addBabelInputs(tree);

    const updated = readNxJson(tree);
    expect(updated).toMatchInlineSnapshot(`
      {
        "namedInputs": {
          "default": [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": [
            "default",
          ],
          "sharedGlobals": [
            "{workspaceRoot}/babel.config.js",
          ],
        },
      }
    `);
  });
});
