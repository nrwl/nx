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
  });

  it('should run successfully when testFile does not exist in the config', async () => {
    addProjectConfiguration(tree, 'vitest', {
      root: 'vitest',
      targets: {
        test: {
          executor: '@nx/vite:test',
          options: {
            ci: true,
            watch: true,
          },
        },
      },
    });
    await update(tree);
    expect(readProjectConfiguration(tree, 'vitest')).toMatchInlineSnapshot(`
      {
        "$schema": "../node_modules/nx/schemas/project-schema.json",
        "name": "vitest",
        "root": "vitest",
        "targets": {
          "test": {
            "executor": "@nx/vite:test",
            "options": {
              "ci": true,
              "watch": true,
            },
          },
        },
      }
    `);
  });

  it('should run successfully when testFile exists in options and configurations', async () => {
    addProjectConfiguration(tree, 'vitest', {
      root: 'vitest',
      targets: {
        test: {
          executor: '@nx/vite:test',
          options: {
            testFile: 'test-file.ts',
            config: 'vite.config.ts',
          },
          configurations: {
            one: {
              testFile: 'test-file-one.ts',
              ci: true,
            },
            two: {
              testFile: 'test-file-two.ts',
              watch: true,
            },
          },
        },
      },
    });
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
                "ci": true,
                "testFile": [
                  "test-file-one.ts",
                ],
              },
              "two": {
                "testFile": [
                  "test-file-two.ts",
                ],
                "watch": true,
              },
            },
            "executor": "@nx/vite:test",
            "options": {
              "config": "vite.config.ts",
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
