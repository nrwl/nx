import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { readNxJson, updateNxJson, type Tree } from 'nx/src/devkit-exports';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { addE2eCiTargetDefaults } from './target-defaults-utils';
describe('target-defaults-utils', () => {
  describe('addE2eCiTargetDefaults', () => {
    let tree: Tree;
    let tempFs: TempFs;
    beforeEach(() => {
      tempFs = new TempFs('target-defaults-utils');
      tree = createTreeWithEmptyWorkspace();
      tree.root = tempFs.tempDir;
    });

    afterEach(() => {
      tempFs.cleanup();
      jest.resetModules();
    });

    it('should add e2e-ci--**/* target default for e2e plugin for specified build target when it does not exist', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      updateNxJson(tree, nxJson);

      tree.write('apps/myapp-e2e/cypress.config.ts', '');
      await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

      // ACT
      await addE2eCiTargetDefaults(
        tree,
        '@nx/cypress/plugin',
        '^build',
        'apps/myapp-e2e/cypress.config.ts'
      );

      // ASSERT
      const newNxJson = readNxJson(tree);
      expect(newNxJson.targetDefaults['e2e-ci--**/*']).toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^build",
          ],
        }
      `);
    });

    it('should update existing e2e-ci--**/* target default for e2e plugin for specified build target when it does not exist in dependsOn', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['e2e-ci--**/*'] = {
        dependsOn: ['^build'],
      };
      updateNxJson(tree, nxJson);

      tree.write('apps/myapp-e2e/cypress.config.ts', '');
      await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

      // ACT
      await addE2eCiTargetDefaults(
        tree,
        '@nx/cypress/plugin',
        '^build-base',
        'apps/myapp-e2e/cypress.config.ts'
      );

      // ASSERT
      const newNxJson = readNxJson(tree);
      expect(newNxJson.targetDefaults['e2e-ci--**/*']).toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^build",
            "^build-base",
          ],
        }
      `);
    });

    it('should read the ciTargetName and add a new entry when it does not exist', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'cypress:e2e-ci',
        },
      });
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['e2e-ci--**/*'] = {
        dependsOn: ['^build'],
      };
      updateNxJson(tree, nxJson);

      tree.write('apps/myapp-e2e/cypress.config.ts', '');
      await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

      // ACT
      await addE2eCiTargetDefaults(
        tree,
        '@nx/cypress/plugin',
        '^build-base',
        'apps/myapp-e2e/cypress.config.ts'
      );

      // ASSERT
      const newNxJson = readNxJson(tree);
      expect(newNxJson.targetDefaults['e2e-ci--**/*']).toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^build",
          ],
        }
      `);
      expect(newNxJson.targetDefaults['cypress:e2e-ci--**/*'])
        .toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^build-base",
          ],
        }
      `);
    });

    it('should not add additional e2e-ci--**/* target default for e2e plugin when it already exists with build target', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults['e2e-ci--**/*'] = {
        dependsOn: ['^build'],
      };
      updateNxJson(tree, nxJson);

      tree.write('apps/myapp-e2e/cypress.config.ts', '');
      await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

      // ACT
      await addE2eCiTargetDefaults(
        tree,
        '@nx/cypress/plugin',
        '^build',
        'apps/myapp-e2e/cypress.config.ts'
      );

      // ASSERT
      const newNxJson = readNxJson(tree);
      expect(newNxJson.targetDefaults).toMatchInlineSnapshot(`
        {
          "build": {
            "cache": true,
          },
          "e2e-ci--**/*": {
            "dependsOn": [
              "^build",
            ],
          },
          "lint": {
            "cache": true,
          },
        }
      `);
    });

    it('should do nothing when there are no nxJson.plugins does not exist', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.plugins = undefined;
      updateNxJson(tree, nxJson);

      tree.write('apps/myapp-e2e/cypress.config.ts', '');
      await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

      // ACT
      await addE2eCiTargetDefaults(
        tree,
        '@nx/cypress/plugin',
        '^build',
        'apps/myapp-e2e/cypress.config.ts'
      );

      // ASSERT
      const newNxJson = readNxJson(tree);
      expect(newNxJson.targetDefaults).toMatchInlineSnapshot(`
        {
          "build": {
            "cache": true,
          },
          "lint": {
            "cache": true,
          },
        }
      `);
    });

    it('should do nothing when there are nxJson.plugins but e2e plugin is not registered', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/playwright/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      });
      updateNxJson(tree, nxJson);

      tree.write('apps/myapp-e2e/cypress.config.ts', '');
      await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

      // ACT
      await addE2eCiTargetDefaults(
        tree,
        '@nx/cypress/plugin',
        '^build',
        'apps/myapp-e2e/cypress.config.ts'
      );

      // ASSERT
      const newNxJson = readNxJson(tree);
      expect(newNxJson.targetDefaults).toMatchInlineSnapshot(`
        {
          "build": {
            "cache": true,
          },
          "lint": {
            "cache": true,
          },
        }
      `);
    });

    it('should choose the correct plugin when there are includes', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        include: ['libs/**'],
      });
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'cypress:e2e-ci',
        },
        include: ['apps/**'],
      });
      updateNxJson(tree, nxJson);

      tree.write('apps/myapp-e2e/cypress.config.ts', '');
      await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

      // ACT
      await addE2eCiTargetDefaults(
        tree,
        '@nx/cypress/plugin',
        '^build',
        'apps/myapp-e2e/cypress.config.ts'
      );

      // ASSERT
      const newNxJson = readNxJson(tree);
      expect(newNxJson.targetDefaults['cypress:e2e-ci--**/*'])
        .toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^build",
          ],
        }
      `);
    });

    it('should choose the correct plugin when there are excludes', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        exclude: ['apps/**'],
      });
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'cypress:e2e-ci',
        },
        exclude: ['libs/**'],
      });
      updateNxJson(tree, nxJson);

      tree.write('apps/myapp-e2e/cypress.config.ts', '');
      await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

      // ACT
      await addE2eCiTargetDefaults(
        tree,
        '@nx/cypress/plugin',
        '^build',
        'apps/myapp-e2e/cypress.config.ts'
      );

      // ASSERT
      const newNxJson = readNxJson(tree);
      expect(newNxJson.targetDefaults['cypress:e2e-ci--**/*'])
        .toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^build",
          ],
        }
      `);
    });

    it('should use the default name when the plugin registration is a string', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push('@nx/cypress/plugin');
      updateNxJson(tree, nxJson);

      tree.write('apps/myapp-e2e/cypress.config.ts', '');
      await tempFs.createFile('apps/myapp-e2e/cypress.config.ts', '');

      // ACT
      await addE2eCiTargetDefaults(
        tree,
        '@nx/cypress/plugin',
        '^build',
        'apps/myapp-e2e/cypress.config.ts'
      );

      // ASSERT
      const newNxJson = readNxJson(tree);
      expect(newNxJson.targetDefaults['e2e-ci--**/*']).toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^build",
          ],
        }
      `);
    });
  });
});
