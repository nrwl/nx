import {
  addPluginWithPreferredTargetNames,
  deleteMatchingProperties,
  getProjectsToMigrate,
} from './plugin-migration-utils';
import { type Tree } from 'nx/src/generators/tree';
import { beforeEach } from 'vitest';
import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import { addProjectConfiguration } from 'nx/src/generators/utils/project-configuration';

describe('Plugin Migration Utils', () => {
  describe('addPluginWithPreferredTargetNames', () => {
    it('should not add the plugin if it already exists as a string and the preferred target names match the default', () => {
      // ARRANGE
      let nxJson = {
        plugins: ['@nx/playwright/plugin'],
      };

      const preferredTargetNames = {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      };
      const defaultTargetNames = {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      };

      // ACT
      let updatedNxJson = addPluginWithPreferredTargetNames(
        '@nx/playwright/plugin',
        preferredTargetNames,
        defaultTargetNames,
        nxJson
      );

      // ASSERT
      expect(updatedNxJson).toEqual(nxJson);
    });

    it('should not add the plugin if it already exists as an object and the preferred target names match the default', () => {
      // ARRANGE
      let nxJson = {
        plugins: [
          {
            plugin: '@nx/playwright/plugin',
            options: {
              targetName: 'e2e',
              ciTargetName: 'e2e-ci',
            },
          },
        ],
      };

      const preferredTargetNames = {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      };
      const defaultTargetNames = {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      };

      // ACT
      let updatedNxJson = addPluginWithPreferredTargetNames(
        '@nx/playwright/plugin',
        preferredTargetNames,
        defaultTargetNames,
        nxJson
      );

      // ASSERT
      expect(updatedNxJson).toEqual(nxJson);
    });

    it('should not add the plugin if it already exists as an object and the preferred target names do not match the default but do match what is present in nxJson', () => {
      // ARRANGE
      let nxJson = {
        plugins: [
          {
            plugin: '@nx/playwright/plugin',
            options: {
              targetName: 'test',
              ciTargetName: 'test-ci',
            },
          },
        ],
      };

      const preferredTargetNames = {
        targetName: 'test',
        ciTargetName: 'test-ci',
      };
      const defaultTargetNames = {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      };

      // ACT
      let updatedNxJson = addPluginWithPreferredTargetNames(
        '@nx/playwright/plugin',
        preferredTargetNames,
        defaultTargetNames,
        nxJson
      );

      // ASSERT
      expect(updatedNxJson).toEqual(nxJson);
    });

    it('should add the plugin if it does not exist', () => {
      // ARRANGE
      let nxJson = {
        plugins: [],
      };

      const preferredTargetNames = {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      };
      const defaultTargetNames = {
        targetName: 'e2e',
        ciTargetName: 'e2e-ci',
      };

      // ACT
      let updatedNxJson = addPluginWithPreferredTargetNames(
        '@nx/playwright/plugin',
        preferredTargetNames,
        defaultTargetNames,
        nxJson
      );

      // ASSERT
      expect(updatedNxJson.plugins).toMatchInlineSnapshot(`
        [
          {
            "options": {
              "ciTargetName": "e2e-ci",
              "targetName": "e2e",
            },
            "plugin": "@nx/playwright/plugin",
          },
        ]
      `);
    });
  });

  describe('deleteMatchingProperties', () => {
    it('should delete properties that are identical between two different objects, leaving an empty object', () => {
      // ARRANGE
      const activeObject = {
        foo: 1,
        bar: 'myval',
        baz: {
          nested: {
            key: 'val',
          },
        },
        arr: ['string', 1],
      };

      const comparableObject = {
        foo: 1,
        bar: 'myval',
        baz: {
          nested: {
            key: 'val',
          },
        },
        arr: ['string', 1],
      };

      // ACT
      deleteMatchingProperties(activeObject, comparableObject);

      // ASSERT
      expect(activeObject).toMatchInlineSnapshot(`{}`);
    });

    it('should delete properties that are identical between two different objects, leaving an object containing only the differences', () => {
      // ARRANGE
      const activeObject = {
        foo: 1,
        bar: 'myval',
        baz: {
          nested: {
            key: 'differentValue',
          },
        },
        arr: ['string', 2],
      };

      const comparableObject = {
        foo: 1,
        bar: 'myval',
        baz: {
          nested: {
            key: 'val',
          },
        },
        arr: ['string', 1],
      };

      // ACT
      deleteMatchingProperties(activeObject, comparableObject);

      // ASSERT
      expect(activeObject).toMatchInlineSnapshot(`
        {
          "arr": [
            "string",
            2,
          ],
          "baz": {
            "nested": {
              "key": "differentValue",
            },
          },
        }
      `);
    });
  });

  describe('getProjectsToMigrate', () => {
    it('should return the projects using the executor and the most popular target name', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();

      addProjectConfiguration(tree, 'app1', {
        name: 'app1',
        root: 'app1',
        targets: {
          test: {
            executor: '@nx/playwright:playwright',
            options: {
              config: 'app1/playwright.config.ts',
            },
          },
        },
      });
      addProjectConfiguration(tree, 'app2', {
        name: 'app2',
        root: 'app2',
        targets: {
          test: {
            executor: '@nx/playwright:playwright',
            options: {
              config: 'app2/playwright.config.ts',
            },
          },
        },
      });
      addProjectConfiguration(tree, 'app3', {
        name: 'app3',
        root: 'app3',
        targets: {
          test: {
            executor: '@nx/jest:jest',
          },
        },
      });
      addProjectConfiguration(tree, 'app5', {
        name: 'app4',
        root: 'app4',
        targets: {
          e2e: {
            executor: '@nx/playwright:playwright',
            options: {
              config: 'app4/playwright.config.ts',
            },
          },
        },
      });

      // ACT
      const { projects, targetName } = getProjectsToMigrate(
        tree,
        '@nx/playwright:playwright'
      );

      // ASSERT
      expect(projects).toEqual(['app1', 'app2']);
      expect(targetName).toEqual('test');
    });
  });
});
