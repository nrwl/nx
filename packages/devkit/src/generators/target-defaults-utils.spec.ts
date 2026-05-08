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
import { gte, valid } from 'semver';
import { NX_VERSION } from '../utils/package-json';
import {
  addBuildTargetDefaults,
  addE2eCiTargetDefaults,
  upsertTargetDefault,
} from './target-defaults-utils';

// Devkit supports `nx` at major +/- 1; the array-shape `targetDefaults`
// only exists in nx >= 23. Tests that assume promotion-to-array are
// gated behind this so they're skipped when the test runner pulls an
// older nx peer. The workspace placeholder version "0.0.1" is treated
// as modern — same exception as in target-defaults-utils.ts.
const supportsArrayTargetDefaults =
  !valid(NX_VERSION) || NX_VERSION === '0.0.1' || gte(NX_VERSION, '23.0.0');
const itArrayShape = supportsArrayTargetDefaults ? it : it.skip;
describe('target-defaults-utils', () => {
  describe('upsertTargetDefault', () => {
    let tree: Tree;
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('appends a new entry when nx.json has no targetDefaults', () => {
      const nxJson = readNxJson(tree);
      delete nxJson.targetDefaults;

      upsertTargetDefault(tree, nxJson, { target: 'test', cache: true });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'test', cache: true },
      ]);
    });

    it('merges into an existing array entry with same filter tuple', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = [{ target: 'test', cache: true }];

      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        inputs: ['default'],
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'test', cache: true, inputs: ['default'] },
      ]);
    });

    it('appends a new array entry when filter tuple differs', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = [{ target: 'test', cache: true }];

      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        source: '@nx/vite',
        inputs: ['vite'],
      });
      updateNxJson(tree, nxJson);

      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'test', cache: true },
        { target: 'test', source: '@nx/vite', inputs: ['vite'] },
      ]);
    });

    itArrayShape('upgrades a legacy record to array on any upsert', () => {
      const nxJson = readNxJson(tree);
      (nxJson as any).targetDefaults = {
        build: { cache: true },
        '@nx/vite:test': { inputs: ['default'] },
      };

      upsertTargetDefault(tree, nxJson, { target: 'test', cache: true });
      updateNxJson(tree, nxJson);

      // Record is normalized first (executor-shaped key splits to executor),
      // then the new entry is appended.
      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'build', cache: true },
        { executor: '@nx/vite:test', inputs: ['default'] },
        { target: 'test', cache: true },
      ]);
    });

    it('upgrades a legacy record to array when a filter is requested', () => {
      const nxJson = readNxJson(tree);
      (nxJson as any).targetDefaults = {
        build: { cache: true },
      };

      upsertTargetDefault(tree, nxJson, {
        target: 'test',
        projects: 'tag:dotnet',
        inputs: ['x'],
      });
      updateNxJson(tree, nxJson);

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

    function findExecutorEntry(tree: Tree, executor: string) {
      const td = readNxJson(tree).targetDefaults;
      if (!Array.isArray(td)) return undefined;
      return td.find((e: any) => e.executor === executor);
    }

    it('upgrades a legacy record to array and writes the executor entry', () => {
      const nxJson = readNxJson(tree);
      (nxJson as any).targetDefaults = {};
      updateNxJson(tree, nxJson);

      addBuildTargetDefaults(tree, '@nx/vite:build');

      const td = readNxJson(tree).targetDefaults;
      expect(Array.isArray(td)).toBe(true);
      expect(td).toContainEqual({
        executor: '@nx/vite:build',
        cache: true,
        dependsOn: ['^build'],
        inputs: ['default', '^default'],
      });
    });

    it('appends to array shape and is idempotent', () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = [{ target: 'test', cache: true }];
      updateNxJson(tree, nxJson);

      addBuildTargetDefaults(tree, '@nx/vite:build');
      addBuildTargetDefaults(tree, '@nx/vite:build');

      expect(readNxJson(tree).targetDefaults).toEqual([
        { target: 'test', cache: true },
        {
          executor: '@nx/vite:build',
          cache: true,
          dependsOn: ['^build'],
          inputs: ['default', '^default'],
        },
      ]);
    });

    it('writes an executor-keyed entry with default inputs', () => {
      addBuildTargetDefaults(tree, '@nx/example:build');

      expect(findExecutorEntry(tree, '@nx/example:build')).toEqual({
        executor: '@nx/example:build',
        cache: true,
        dependsOn: ['^build'],
        inputs: ['default', '^default'],
      });
    });

    it('uses production named inputs when available', () => {
      const nxJson = readNxJson(tree);
      nxJson.namedInputs = {
        default: ['{projectRoot}/**/*'],
        production: ['default'],
      };
      updateNxJson(tree, nxJson);

      addBuildTargetDefaults(tree, '@nx/example:build');

      expect(findExecutorEntry(tree, '@nx/example:build').inputs).toEqual([
        'production',
        '^production',
      ]);
    });

    it('honors a custom build target name in dependsOn', () => {
      addBuildTargetDefaults(tree, '@nx/example:build', 'compile');

      expect(findExecutorEntry(tree, '@nx/example:build').dependsOn).toEqual([
        '^compile',
      ]);
    });

    it('appends extra inputs after the default/production inputs', () => {
      addBuildTargetDefaults(tree, '@nx/example:build', 'build', [
        {
          json: '{workspaceRoot}/tsconfig.json',
          fields: ['extends', 'files', 'include'],
        },
      ]);

      expect(findExecutorEntry(tree, '@nx/example:build').inputs).toEqual([
        'default',
        '^default',
        {
          json: '{workspaceRoot}/tsconfig.json',
          fields: ['extends', 'files', 'include'],
        },
      ]);
    });

    it('does not overwrite an existing entry for the executor', () => {
      const nxJson = readNxJson(tree);
      (nxJson as any).targetDefaults = [
        { executor: '@nx/example:build', cache: true, inputs: ['custom'] },
      ];
      updateNxJson(tree, nxJson);

      addBuildTargetDefaults(tree, '@nx/example:build', 'build', [
        { json: '{workspaceRoot}/tsconfig.json', fields: ['extends'] },
      ]);

      expect(findExecutorEntry(tree, '@nx/example:build')).toEqual({
        executor: '@nx/example:build',
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

    function findGlobEntry(tree: Tree, target: string) {
      const td = readNxJson(tree).targetDefaults;
      if (!Array.isArray(td)) return undefined;
      return td.find(
        (e: any) =>
          e.target === target &&
          e.executor === undefined &&
          e.projects === undefined &&
          e.source === undefined
      );
    }

    it('adds an e2e-ci--**/** entry with the build target dependency', async () => {
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
      expect(findGlobEntry(tree, 'e2e-ci--**/**')).toEqual({
        target: 'e2e-ci--**/**',
        dependsOn: ['^build'],
      });
    });

    it('appends a new build target to an existing entry without duplicating', async () => {
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
      nxJson.targetDefaults = [
        { target: 'e2e-ci--**/**', dependsOn: ['^build'] },
      ];
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
      expect(findGlobEntry(tree, 'e2e-ci--**/**')).toEqual({
        target: 'e2e-ci--**/**',
        dependsOn: ['^build', '^build-base'],
      });
    });

    it('reads the ciTargetName and adds a new entry under that glob', async () => {
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
      nxJson.targetDefaults = [
        { target: 'e2e-ci--**/**', dependsOn: ['^build'] },
      ];
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
      expect(findGlobEntry(tree, 'e2e-ci--**/**')).toEqual({
        target: 'e2e-ci--**/**',
        dependsOn: ['^build'],
      });
      expect(findGlobEntry(tree, 'cypress:e2e-ci--**/**')).toEqual({
        target: 'cypress:e2e-ci--**/**',
        dependsOn: ['^build-base'],
      });
    });

    it('does not duplicate the build target when it already depends on it', async () => {
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
      nxJson.targetDefaults = [
        { target: 'e2e-ci--**/**', dependsOn: ['^build'] },
      ];
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

      // ASSERT — single entry, single build dependency
      expect(findGlobEntry(tree, 'e2e-ci--**/**')).toEqual({
        target: 'e2e-ci--**/**',
        dependsOn: ['^build'],
      });
    });

    it('does nothing when nxJson.plugins is absent', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      const before = nxJson.targetDefaults;
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

      // ASSERT — unchanged
      expect(readNxJson(tree).targetDefaults).toEqual(before);
    });

    it('does nothing when the e2e plugin is not registered', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      const before = nxJson.targetDefaults;
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

      // ASSERT — unchanged
      expect(readNxJson(tree).targetDefaults).toEqual(before);
    });

    it('chooses the matching plugin registration via include', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        include: ['libs/**'],
      });
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: { targetName: 'e2e', ciTargetName: 'cypress:e2e-ci' },
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
      expect(findGlobEntry(tree, 'cypress:e2e-ci--**/**')).toEqual({
        target: 'cypress:e2e-ci--**/**',
        dependsOn: ['^build'],
      });
    });

    it('chooses the matching plugin registration via exclude', async () => {
      // ARRANGE
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        exclude: ['apps/**'],
      });
      nxJson.plugins.push({
        plugin: '@nx/cypress/plugin',
        options: { targetName: 'e2e', ciTargetName: 'cypress:e2e-ci' },
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
      expect(findGlobEntry(tree, 'cypress:e2e-ci--**/**')).toEqual({
        target: 'cypress:e2e-ci--**/**',
        dependsOn: ['^build'],
      });
    });

    it('uses the default ciTargetName when the plugin registration is a string', async () => {
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
      expect(findGlobEntry(tree, 'e2e-ci--**/**')).toEqual({
        target: 'e2e-ci--**/**',
        dependsOn: ['^build'],
      });
    });
  });
});
