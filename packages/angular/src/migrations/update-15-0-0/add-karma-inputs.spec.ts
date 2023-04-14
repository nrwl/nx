import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import addKarmaInputs from './add-karma-inputs';

describe('15.0.0 migration (add-karma-inputs)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add inputs configuration for karma targets', async () => {
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
          executor: '@angular-devkit/build-angular:karma',
          options: {},
        },
        test2: {
          executor: '@angular-devkit/build-angular:karma',
          options: {},
        },
        notTest: {
          executor: 'nx:run-commands',
        },
      },
    });
    tree.write('karma.conf.js', '');

    await addKarmaInputs(tree);

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
            "!{projectRoot}/**/*.spec.[jt]s",
            "!{projectRoot}/tsconfig.spec.json",
            "!{projectRoot}/karma.conf.js",
          ],
          "sharedGlobals": [],
        },
        "targetDefaults": {
          "test": {
            "inputs": [
              "default",
              "^production",
              "{workspaceRoot}/karma.conf.js",
            ],
          },
          "test2": {
            "inputs": [
              "default",
              "^production",
              "{workspaceRoot}/karma.conf.js",
            ],
          },
        },
      }
    `);
  });
});
