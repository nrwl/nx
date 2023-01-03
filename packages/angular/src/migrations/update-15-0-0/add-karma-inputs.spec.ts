import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  addProjectConfiguration,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nrwl/devkit';
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
      Object {
        "namedInputs": Object {
          "default": Array [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": Array [
            "default",
            "!{projectRoot}/**/*.spec.[jt]s",
            "!{projectRoot}/tsconfig.spec.json",
            "!{projectRoot}/karma.conf.js",
          ],
          "sharedGlobals": Array [],
        },
        "targetDefaults": Object {
          "test": Object {
            "inputs": Array [
              "default",
              "^production",
              "{workspaceRoot}/karma.conf.js",
            ],
          },
          "test2": Object {
            "inputs": Array [
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
