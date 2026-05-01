import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateVitestToVitestPackage from './migrate-vitest-to-vitest-package';

describe('migrate-vitest-to-vitest-package', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('package installation', () => {
    it('should install @nx/vitest if not present', async () => {
      await migrateVitestToVitestPackage(tree);

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['@nx/vitest']).toBeDefined();
    });

    it('should not duplicate @nx/vitest if already present', async () => {
      const packageJson = readJson(tree, 'package.json');
      packageJson.devDependencies = packageJson.devDependencies || {};
      packageJson.devDependencies['@nx/vitest'] = '22.0.0';
      writeJson(tree, 'package.json', packageJson);

      await migrateVitestToVitestPackage(tree);

      const updatedPackageJson = readJson(tree, 'package.json');
      expect(updatedPackageJson.devDependencies['@nx/vitest']).toBe('22.0.0');
    });
  });

  describe('executor migration', () => {
    it('should convert @nx/vite:test executor to @nx/vitest:test', async () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'libs/my-lib',
        targets: {
          test: {
            executor: '@nx/vite:test',
            options: {
              configFile: 'libs/my-lib/vite.config.ts',
            },
          },
        },
      });

      await migrateVitestToVitestPackage(tree);

      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.targets.test.executor).toBe('@nx/vitest:test');
      expect(projectConfig.targets.test.options.configFile).toBe(
        'libs/my-lib/vite.config.ts'
      );
    });

    it('should preserve executor options after migration', async () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'libs/my-lib',
        targets: {
          test: {
            executor: '@nx/vite:test',
            options: {
              configFile: 'libs/my-lib/vite.config.ts',
              reportsDirectory: 'coverage/libs/my-lib',
              mode: 'test',
            },
          },
        },
      });

      await migrateVitestToVitestPackage(tree);

      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.targets.test.options).toEqual({
        configFile: 'libs/my-lib/vite.config.ts',
        reportsDirectory: 'coverage/libs/my-lib',
        mode: 'test',
      });
    });

    it('should convert multiple projects with @nx/vite:test', async () => {
      addProjectConfiguration(tree, 'lib-a', {
        root: 'libs/lib-a',
        targets: {
          test: {
            executor: '@nx/vite:test',
          },
        },
      });

      addProjectConfiguration(tree, 'lib-b', {
        root: 'libs/lib-b',
        targets: {
          test: {
            executor: '@nx/vite:test',
          },
        },
      });

      await migrateVitestToVitestPackage(tree);

      expect(
        readProjectConfiguration(tree, 'lib-a').targets.test.executor
      ).toBe('@nx/vitest:test');
      expect(
        readProjectConfiguration(tree, 'lib-b').targets.test.executor
      ).toBe('@nx/vitest:test');
    });

    it('should not modify other executors', async () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'libs/my-lib',
        targets: {
          build: {
            executor: '@nx/vite:build',
          },
          test: {
            executor: '@nx/vite:test',
          },
        },
      });

      await migrateVitestToVitestPackage(tree);

      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.targets.build.executor).toBe('@nx/vite:build');
      expect(projectConfig.targets.test.executor).toBe('@nx/vitest:test');
    });
  });

  describe('plugin configuration migration', () => {
    it('should split @nx/vite/plugin with testTargetName into separate entries', async () => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [
        {
          plugin: '@nx/vite/plugin',
          options: {
            buildTargetName: 'build',
            testTargetName: 'test',
          },
        },
      ];
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.plugins).toHaveLength(2);

      const vitePlugin = updatedNxJson.plugins.find(
        (p) => typeof p !== 'string' && p.plugin === '@nx/vite/plugin'
      );
      const vitestPlugin = updatedNxJson.plugins.find(
        (p) => typeof p !== 'string' && p.plugin === '@nx/vitest'
      );

      expect(vitePlugin).toBeDefined();
      expect((vitePlugin as any).options).toEqual({
        buildTargetName: 'build',
      });

      expect(vitestPlugin).toBeDefined();
      expect((vitestPlugin as any).options).toEqual({
        testTargetName: 'test',
      });
    });

    it('should migrate ciTargetName and ciGroupName to vitest plugin', async () => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [
        {
          plugin: '@nx/vite/plugin',
          options: {
            buildTargetName: 'build',
            testTargetName: 'test',
            ciTargetName: 'test-ci',
            ciGroupName: 'vitest',
          },
        },
      ];
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      const vitestPlugin = updatedNxJson.plugins.find(
        (p) => typeof p !== 'string' && p.plugin === '@nx/vitest'
      );

      expect((vitestPlugin as any).options).toEqual({
        testTargetName: 'test',
        ciTargetName: 'test-ci',
        ciGroupName: 'vitest',
      });
    });

    it('should preserve include/exclude in vitest plugin', async () => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [
        {
          plugin: '@nx/vite/plugin',
          include: ['packages/**'],
          exclude: ['packages/excluded/**'],
          options: {
            testTargetName: 'test',
          },
        },
      ];
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      const vitestPlugin = updatedNxJson.plugins.find(
        (p) => typeof p !== 'string' && p.plugin === '@nx/vitest'
      ) as any;

      expect(vitestPlugin.include).toEqual(['packages/**']);
      expect(vitestPlugin.exclude).toEqual(['packages/excluded/**']);
    });

    it('should not add vitest plugin if already present', async () => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [
        {
          plugin: '@nx/vite/plugin',
          options: {
            testTargetName: 'test',
          },
        },
        {
          plugin: '@nx/vitest',
          options: {
            testTargetName: 'vitest:test',
          },
        },
      ];
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      const vitestPlugins = updatedNxJson.plugins.filter(
        (p) => typeof p !== 'string' && p.plugin === '@nx/vitest'
      );

      expect(vitestPlugins).toHaveLength(1);
      expect((vitestPlugins[0] as any).options.testTargetName).toBe(
        'vitest:test'
      );
    });

    it('should handle string plugin format (no splitting needed)', async () => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = ['@nx/vite/plugin'];
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.plugins).toEqual(['@nx/vite/plugin']);
    });

    it('should not modify @nx/vite/plugin without test options', async () => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [
        {
          plugin: '@nx/vite/plugin',
          options: {
            buildTargetName: 'build',
            devTargetName: 'dev',
          },
        },
      ];
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.plugins).toHaveLength(1);
      expect((updatedNxJson.plugins[0] as any).options).toEqual({
        buildTargetName: 'build',
        devTargetName: 'dev',
      });
    });

    it('should remove options object from vite plugin if empty after migration', async () => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [
        {
          plugin: '@nx/vite/plugin',
          options: {
            testTargetName: 'test',
          },
        },
      ];
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      const vitePlugin = updatedNxJson.plugins.find(
        (p) => typeof p !== 'string' && p.plugin === '@nx/vite/plugin'
      ) as any;

      expect(vitePlugin.options).toBeUndefined();
    });

    it('should create multiple vitest plugins for multiple vite plugins with different test options', async () => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [
        {
          plugin: '@nx/vite/plugin',
          include: ['apps/**'],
          options: {
            buildTargetName: 'build',
            testTargetName: 'test',
            ciTargetName: 'test-ci',
          },
        },
        {
          plugin: '@nx/vite/plugin',
          include: ['libs/**'],
          options: {
            buildTargetName: 'build-lib',
            testTargetName: 'unit-test',
            ciTargetName: 'unit-test-ci',
          },
        },
      ];
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);

      // Should have 4 plugins: 2 vite + 2 vitest
      expect(updatedNxJson.plugins).toHaveLength(4);

      const vitestPlugins = updatedNxJson.plugins.filter(
        (p) => typeof p !== 'string' && p.plugin === '@nx/vitest'
      ) as any[];

      expect(vitestPlugins).toHaveLength(2);

      // First vitest plugin for apps
      const appsVitest = vitestPlugins.find((p) =>
        p.include?.includes('apps/**')
      );
      expect(appsVitest).toBeDefined();
      expect(appsVitest.options).toEqual({
        testTargetName: 'test',
        ciTargetName: 'test-ci',
      });

      // Second vitest plugin for libs
      const libsVitest = vitestPlugins.find((p) =>
        p.include?.includes('libs/**')
      );
      expect(libsVitest).toBeDefined();
      expect(libsVitest.options).toEqual({
        testTargetName: 'unit-test',
        ciTargetName: 'unit-test-ci',
      });
    });

    it('should handle mixed vite plugins - some with test options, some without', async () => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [
        {
          plugin: '@nx/vite/plugin',
          include: ['apps/**'],
          options: {
            buildTargetName: 'build',
            testTargetName: 'test',
          },
        },
        {
          plugin: '@nx/vite/plugin',
          include: ['libs/**'],
          options: {
            buildTargetName: 'build-lib',
            // No test options
          },
        },
      ];
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);

      const vitestPlugins = updatedNxJson.plugins.filter(
        (p) => typeof p !== 'string' && p.plugin === '@nx/vitest'
      );

      // Only one vitest plugin (for apps)
      expect(vitestPlugins).toHaveLength(1);
      expect((vitestPlugins[0] as any).include).toEqual(['apps/**']);
    });
  });

  describe('targetDefaults migration', () => {
    it('should migrate @nx/vite:test targetDefaults to @nx/vitest:test', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/vite:test': {
          cache: true,
          inputs: ['default', '^production'],
        },
      };
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.targetDefaults['@nx/vite:test']).toBeUndefined();
      expect(updatedNxJson.targetDefaults['@nx/vitest:test']).toEqual({
        cache: true,
        inputs: ['default', '^production'],
      });
    });

    it('should merge with existing @nx/vitest:test targetDefaults', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/vite:test': {
          cache: true,
        },
        '@nx/vitest:test': {
          inputs: ['default'],
        },
      };
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.targetDefaults['@nx/vite:test']).toBeUndefined();
      expect(updatedNxJson.targetDefaults['@nx/vitest:test']).toEqual({
        cache: true,
        inputs: ['default'],
      });
    });

    it('should not modify targetDefaults if @nx/vite:test is not present', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: {
          cache: true,
        },
      };
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.targetDefaults).toEqual({
        build: {
          cache: true,
        },
      });
    });

    it('should migrate target-name-keyed targetDefaults with @nx/vite:test executor', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: {
          executor: '@nx/vite:test',
          cache: true,
          inputs: ['default', '^production'],
        },
      };
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.targetDefaults.test).toEqual({
        executor: '@nx/vitest:test',
        cache: true,
        inputs: ['default', '^production'],
      });
    });

    it('should handle both executor-keyed and target-name-keyed targetDefaults', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/vite:test': {
          cache: true,
        },
        test: {
          executor: '@nx/vite:test',
          inputs: ['default'],
        },
      };
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      const updatedNxJson = readNxJson(tree);
      // Executor-keyed should be migrated to new key
      expect(updatedNxJson.targetDefaults['@nx/vite:test']).toBeUndefined();
      expect(updatedNxJson.targetDefaults['@nx/vitest:test']).toEqual({
        cache: true,
      });
      // Target-name-keyed should have executor updated in place
      expect(updatedNxJson.targetDefaults.test).toEqual({
        executor: '@nx/vitest:test',
        inputs: ['default'],
      });
    });
  });

  describe('no-op scenarios', () => {
    it('should handle empty workspace', async () => {
      // Should not throw during migration logic
      await migrateVitestToVitestPackage(tree);

      // Verify migration ran without issues
      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['@nx/vitest']).toBeDefined();
    });

    it('should handle workspace without plugins', async () => {
      const nxJson = readNxJson(tree);
      delete nxJson.plugins;
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      // Should not add plugins if none existed
      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.plugins).toBeUndefined();
    });

    it('should handle workspace without targetDefaults', async () => {
      const nxJson = readNxJson(tree);
      delete nxJson.targetDefaults;
      updateNxJson(tree, nxJson);

      await migrateVitestToVitestPackage(tree);

      // Should not fail, just skip targetDefaults migration
      const updatedNxJson = readNxJson(tree);
      expect(updatedNxJson.targetDefaults).toBeUndefined();
    });
  });
});
