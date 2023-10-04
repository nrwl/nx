import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nx/devkit';

import updateTestFileOption from './update-16-4-1-test-file-config';

describe('update-16-5-0-vite-test-file-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should run successfully when testFile does not exist in the config', () => {
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
    updateTestFileOption(tree);
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

  it('should run successfully when testFile exists in options and configurations', () => {
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
    updateTestFileOption(tree);
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
                "testFiles": [
                  "test-file-one.ts",
                ],
              },
              "two": {
                "testFiles": [
                  "test-file-two.ts",
                ],
                "watch": true,
              },
            },
            "executor": "@nx/vite:test",
            "options": {
              "config": "vite.config.ts",
              "testFiles": [
                "test-file.ts",
              ],
            },
          },
        },
      }
    `);
  });
});
