import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  addProjectConfiguration,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nrwl/devkit';
import addCypressInputs from './add-cypress-inputs';

describe('15.0.0 migration (add-cypress-inputs)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add inputs configuration for cypress targets', async () => {
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
        e2e: {
          executor: '@nrwl/cypress:cypress',
          options: {},
        },
        e2e2: {
          executor: '@nrwl/cypress:cypress',
          options: {},
        },
        notTest: {
          executor: 'nx:run-commands',
        },
      },
    });
    tree.write('jest.preset.js', '');

    await addCypressInputs(tree);

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
          ],
          "sharedGlobals": Array [],
        },
        "targetDefaults": Object {
          "e2e": Object {
            "inputs": Array [
              "default",
              "^production",
            ],
          },
          "e2e2": Object {
            "inputs": Array [
              "default",
              "^production",
            ],
          },
        },
      }
    `);
  });

  it('should inputs configuration for cypress component testing targets', async () => {
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
        e2e: {
          executor: '@nrwl/cypress:cypress',
          options: {
            testingType: 'component',
          },
        },
        e2e2: {
          executor: '@nrwl/cypress:cypress',
          options: {
            testingType: 'component',
          },
        },
        notTest: {
          executor: 'nx:run-commands',
        },
      },
    });
    tree.write('jest.preset.js', '');

    await addCypressInputs(tree);

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
            "!{projectRoot}/cypress/**/*",
            "!{projectRoot}/**/*.cy.[jt]s?(x)",
            "!{projectRoot}/cypress.config.[jt]s",
          ],
          "sharedGlobals": Array [],
        },
        "targetDefaults": Object {
          "e2e": Object {
            "inputs": Array [
              "default",
              "^production",
            ],
          },
          "e2e2": Object {
            "inputs": Array [
              "default",
              "^production",
            ],
          },
        },
      }
    `);
  });
});
