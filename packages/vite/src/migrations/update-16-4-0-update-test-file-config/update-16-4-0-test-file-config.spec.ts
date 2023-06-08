import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nx/devkit';

import update from './update-16-4-0-test-file-config';

describe('update-16-4-0-vite-test-file-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'vitest', {
      root: 'vitest',
      targets: {
        test: {
          executor: '@nx/vite:test',
          options: {
            testFile: 'test-file.ts',
          },
          configurations: {
            one: {
              testFile: 'test-file-one.ts',
            },
            two: {
              testFile: 'test-file-two.ts',
            },
          },
        },
      },
    });
  });

  it('should run successfully', async () => {
    await update(tree);
    expect(readProjectConfiguration(tree, 'vitest')).toMatchInlineSnapshot(`
      {
        "$schema": "../node_modules/nx/schemas/project-schema.json",
        "name": "vitest",
        "root": "vitest",
        "targets": {
          "test": {
            "configurations": {
              "one": {
                "testFile": [
                  "test-file-one.ts",
                ],
              },
              "two": {
                "testFile": [
                  "test-file-two.ts",
                ],
              },
            },
            "executor": "@nx/vite:test",
            "options": {
              "testFile": [
                "test-file.ts",
              ],
            },
          },
        },
      }
    `);
  });
});
