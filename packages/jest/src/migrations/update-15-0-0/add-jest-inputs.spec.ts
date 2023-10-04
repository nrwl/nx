import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import addJestInputs from './add-jest-inputs';

describe('15.0.0 migration (add-jest-inputs)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add inputs configuration for jest targets', async () => {
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
        test: {
          executor: '@nrwl/jest:jest',
          options: {},
        },
        test2: {
          executor: '@nrwl/jest:jest',
          options: {},
        },
        notTest: {
          executor: 'nx:run-commands',
        },
      },
    });
    tree.write('jest.preset.js', '');

    await addJestInputs(tree);

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
            "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
            "!{projectRoot}/tsconfig.spec.json",
            "!{projectRoot}/jest.config.[jt]s",
          ],
          "sharedGlobals": [],
        },
        "targetDefaults": {
          "test": {
            "inputs": [
              "default",
              "^production",
              "{workspaceRoot}/jest.preset.js",
            ],
          },
          "test2": {
            "inputs": [
              "default",
              "^production",
              "{workspaceRoot}/jest.preset.js",
            ],
          },
        },
      }
    `);
  });
});
