// Stub out @nx/cypress/plugin so the dynamic `await import('@nx/cypress/plugin')`
// in addE2eCiTargetDefaults doesn't pull real plugin code (which transitively
// imports @nx/js source and inflates sandbox inputs).
jest.mock(
  '@nx/cypress/plugin',
  () => ({
    createNodesV2: ['**/cypress.config.{js,ts,mjs,cjs}', jest.fn()],
  }),
  { virtual: true }
);

import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { readNxJson, updateNxJson, type Tree } from 'nx/src/devkit-exports';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import {
  addBuildTargetDefaults,
  addE2eCiTargetDefaults,
  upsertTargetDefault,
} from './target-defaults-utils';
describe('target-defaults-utils', () => {
  describe('upsertTargetDefault', () => {
    let tree: Tree;
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('appends a new entry when nx.json has no targetDefaults', () => {
      const nxJson = readNxJson(tree);
      delete nxJson.targetDefaults;
      updateNxJson(tree, nxJson);

      upsertTargetDefault(tree, { target: 'test', cache: true });

      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'test', cache: true },
      ]);
    });

    it('merges into an existing array entry with same filter tuple', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = [{ target: 'test', cache: true }];
      updateNxJson(tree, nxJson);

      upsertTargetDefault(tree, { target: 'test', inputs: ['default'] });

      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'test', cache: true, inputs: ['default'] },
      ]);
    });

    it('appends a new array entry when filter tuple differs', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = [{ target: 'test', cache: true }];
      updateNxJson(tree, nxJson);

      upsertTargetDefault(tree, {
        target: 'test',
        source: '@nx/vite',
        inputs: ['vite'],
      });

      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'test', cache: true },
        { target: 'test', source: '@nx/vite', inputs: ['vite'] },
      ]);
    });

    it('preserves legacy record shape when no filters are specified', () => {
      const nxJson = readNxJson(tree);
      (nxJson as any).targetDefaults = {
        build: { cache: true },
      };
      updateNxJson(tree, nxJson);

      upsertTargetDefault(tree, { target: 'test', cache: true });

      expect(readNxJson(tree).targetDefaults).toEqual({
        build: { cache: true },
        test: { cache: true },
      });
    });

    it('upgrades a legacy record to array when a filter is requested', () => {
      const nxJson = readNxJson(tree);
      (nxJson as any).targetDefaults = {
        build: { cache: true },
      };
      updateNxJson(tree, nxJson);

      upsertTargetDefault(tree, {
        target: 'test',
        projects: 'tag:dotnet',
        inputs: ['x'],
      });

      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'build', cache: true },
        { target: 'test', projects: 'tag:dotnet', inputs: ['x'] },
      ]);
    });
  });

  describe('addBuildTargetDefaults', () => {
    let tree: Tree;
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('adds entry to legacy record shape preserving record', () => {
      const nxJson = readNxJson(tree);
      (nxJson as any).targetDefaults = {};
      updateNxJson(tree, nxJson);

      addBuildTargetDefaults(tree, '@nx/vite:build');

      expect(readNxJson(tree).targetDefaults).toEqual({
        '@nx/vite:build': {
          cache: true,
          dependsOn: ['^build'],
          inputs: ['default', '^default'],
        },
      });
    });

    it('appends to array shape and is idempotent', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = [{ target: 'test', cache: true }];
      updateNxJson(tree, nxJson);

      addBuildTargetDefaults(tree, '@nx/vite:build');
      addBuildTargetDefaults(tree, '@nx/vite:build');

      const td = readNxJson(tree).targetDefaults;
      expect(Array.isArray(td)).toBe(true);
      expect(td as any).toEqual([
        { target: 'test', cache: true },
        {
          target: '@nx/vite:build',
          cache: true,
          dependsOn: ['^build'],
          inputs: ['default', '^default'],
        },
      ]);
    });

    it('should set executor-keyed target defaults with default inputs', () => {
      addBuildTargetDefaults(tree, '@nx/example:build');

      const nxJson = readNxJson(tree);
      expect((nxJson.targetDefaults as any)['@nx/example:build']).toEqual({
        cache: true,
        dependsOn: ['^build'],
        inputs: ['default', '^default'],
      });
    });

    it('should use production named inputs when available', () => {
      const nxJson = readNxJson(tree);
      nxJson.namedInputs = {
        default: ['{projectRoot}/**/*'],
        production: ['default'],
      };
      updateNxJson(tree, nxJson);

      addBuildTargetDefaults(tree, '@nx/example:build');

      expect(
        (readNxJson(tree).targetDefaults as any)['@nx/example:build'].inputs
      ).toEqual(['production', '^production']);
    });

    it('should honor a custom build target name in dependsOn', () => {
      addBuildTargetDefaults(tree, '@nx/example:build', 'compile');

      expect(
        (readNxJson(tree).targetDefaults as any)['@nx/example:build'].dependsOn
      ).toEqual(['^compile']);
    });

    it('should append extra inputs after the default/production inputs', () => {
      addBuildTargetDefaults(tree, '@nx/example:build', 'build', [
        {
          json: '{workspaceRoot}/tsconfig.json',
          fields: ['extends', 'files', 'include'],
        },
      ]);

      expect(
        (readNxJson(tree).targetDefaults as any)['@nx/example:build'].inputs
      ).toEqual([
        'default',
        '^default',
        {
          json: '{workspaceRoot}/tsconfig.json',
          fields: ['extends', 'files', 'include'],
        },
      ]);
    });

    it('should not overwrite existing target defaults for the executor', () => {
      const nxJson = readNxJson(tree);
      (nxJson as any).targetDefaults = {
        '@nx/example:build': { cache: true, inputs: ['custom'] },
      };
      updateNxJson(tree, nxJson);

      addBuildTargetDefaults(tree, '@nx/example:build', 'build', [
        { json: '{workspaceRoot}/tsconfig.json', fields: ['extends'] },
      ]);

      expect(
        (readNxJson(tree).targetDefaults as any)['@nx/example:build']
      ).toEqual({
        cache: true,
        inputs: ['custom'],
      });
    });
  });

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

    it('should add e2e-ci--**/** target default for e2e plugin for specified build target when it does not exist', async () => {
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
      expect(newNxJson.targetDefaults['e2e-ci--**/**']).toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^build",
          ],
        }
      `);
    });

    it('should update existing e2e-ci--**/** target default for e2e plugin for specified build target when it does not exist in dependsOn', async () => {
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
      nxJson.targetDefaults['e2e-ci--**/**'] = {
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
      expect(newNxJson.targetDefaults['e2e-ci--**/**']).toMatchInlineSnapshot(`
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
      nxJson.targetDefaults['e2e-ci--**/**'] = {
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
      expect(newNxJson.targetDefaults['e2e-ci--**/**']).toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^build",
          ],
        }
      `);
      expect(newNxJson.targetDefaults['cypress:e2e-ci--**/**'])
        .toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^build-base",
          ],
        }
      `);
    });

    it('should not add additional e2e-ci--**/** target default for e2e plugin when it already exists with build target', async () => {
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
      nxJson.targetDefaults['e2e-ci--**/**'] = {
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
          "e2e-ci--**/**": {
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
      expect(newNxJson.targetDefaults['cypress:e2e-ci--**/**'])
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
      expect(newNxJson.targetDefaults['cypress:e2e-ci--**/**'])
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
      expect(newNxJson.targetDefaults['e2e-ci--**/**']).toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^build",
          ],
        }
      `);
    });
  });
});
