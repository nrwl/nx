import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import ensureVitestPackageMigration from './ensure-vitest-package-migration';

describe('ensure-vitest-package-migration (v23 safety net)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  // Adds a vitest config file so the migration treats the workspace as
  // actually using vitest (matches inference-only setups).
  function addVitestSignal(tree: Tree) {
    tree.write(
      'libs/has-vitest/vitest.config.ts',
      `import { defineConfig } from 'vitest/config';
export default defineConfig({});
`
    );
  }

  it('should swap remaining @nx/vite:test executor usages to @nx/vitest:test', async () => {
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

    await ensureVitestPackageMigration(tree);

    const projectConfig = readProjectConfiguration(tree, 'my-lib');
    expect(projectConfig.targets.test.executor).toBe('@nx/vitest:test');
    expect(projectConfig.targets.test.options.configFile).toBe(
      'libs/my-lib/vite.config.ts'
    );

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nx/vitest']).toBeDefined();
  });

  it('should add @nx/vitest plugin when default @nx/vite/plugin is registered as a string and vitest is in use', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = ['@nx/vite/plugin'];
    updateNxJson(tree, nxJson);
    addVitestSignal(tree);

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    expect(updated.plugins).toContainEqual({ plugin: '@nx/vitest' });
    expect(updated.plugins).toContain('@nx/vite/plugin');
  });

  it('should add @nx/vitest plugin when default @nx/vite/plugin is registered as an object with no test options and vitest is in use', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [{ plugin: '@nx/vite/plugin' }];
    updateNxJson(tree, nxJson);
    addVitestSignal(tree);

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    expect(updated.plugins).toContainEqual({ plugin: '@nx/vite/plugin' });
    expect(updated.plugins).toContainEqual({ plugin: '@nx/vitest' });
  });

  it('should mirror include/exclude from @nx/vite/plugin onto the new @nx/vitest plugin', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/vite/plugin',
        include: ['apps/**/*'],
        exclude: ['apps/legacy/*'],
      },
    ];
    updateNxJson(tree, nxJson);
    addVitestSignal(tree);

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    expect(updated.plugins).toContainEqual({
      plugin: '@nx/vitest',
      include: ['apps/**/*'],
      exclude: ['apps/legacy/*'],
    });
  });

  it('should detect inference-only usage via vite.config.ts test block and register @nx/vitest', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [{ plugin: '@nx/vite/plugin' }];
    updateNxJson(tree, nxJson);
    tree.write(
      'libs/my-lib/vite.config.ts',
      `import { defineConfig } from 'vite';
export default defineConfig({
  test: { globals: true },
});
`
    );

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    expect(updated.plugins).toContainEqual({ plugin: '@nx/vitest' });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies?.['@nx/vitest']).toBeDefined();
  });

  it('should detect inference-only usage via vitest.config.ts and register @nx/vitest', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [{ plugin: '@nx/vite/plugin' }];
    updateNxJson(tree, nxJson);
    tree.write(
      'libs/my-lib/vitest.config.ts',
      `import { defineConfig } from 'vitest/config';
export default defineConfig({});
`
    );

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    expect(updated.plugins).toContainEqual({ plugin: '@nx/vitest' });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies?.['@nx/vitest']).toBeDefined();
  });

  it('should not register @nx/vitest when @nx/vite/plugin is registered but workspace has no vitest signal', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [{ plugin: '@nx/vite/plugin' }];
    updateNxJson(tree, nxJson);

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    const vitestEntries = (updated.plugins ?? []).filter((p) =>
      typeof p === 'string' ? p === '@nx/vitest' : p.plugin === '@nx/vitest'
    );
    expect(vitestEntries).toHaveLength(0);
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies?.['@nx/vitest']).toBeUndefined();
  });

  it('should be a no-op when @nx/vitest plugin is already registered and @nx/vite/plugin has no vitest options', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [{ plugin: '@nx/vite/plugin' }, { plugin: '@nx/vitest' }];
    updateNxJson(tree, nxJson);
    addVitestSignal(tree);

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    const vitestEntries = updated.plugins.filter((p) =>
      typeof p === 'string' ? p === '@nx/vitest' : p.plugin === '@nx/vitest'
    );
    expect(vitestEntries).toHaveLength(1);
  });

  it('should be a no-op when neither @nx/vite/plugin nor @nx/vite:test is in use', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [{ plugin: '@nx/eslint/plugin' }];
    updateNxJson(tree, nxJson);

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    const vitestEntries = (updated.plugins ?? []).filter((p) =>
      typeof p === 'string' ? p === '@nx/vitest' : p.plugin === '@nx/vitest'
    );
    expect(vitestEntries).toHaveLength(0);
  });

  it('should not duplicate @nx/vitest install when already migrated', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      targets: {
        test: {
          executor: '@nx/vitest:test',
          options: {},
        },
      },
    });
    const packageJson = readJson(tree, 'package.json');
    packageJson.devDependencies = packageJson.devDependencies || {};
    packageJson.devDependencies['@nx/vitest'] = '23.0.0';
    tree.write('package.json', JSON.stringify(packageJson, null, 2));

    await ensureVitestPackageMigration(tree);

    const updatedPackageJson = readJson(tree, 'package.json');
    expect(updatedPackageJson.devDependencies['@nx/vitest']).toBe('23.0.0');
  });

  it('installs @nx/vitest when @nx/vite/plugin is registered and root package.json depends on vitest', async () => {
    const packageJson = readJson(tree, 'package.json');
    packageJson.devDependencies = packageJson.devDependencies || {};
    packageJson.devDependencies['vitest'] = '^2.0.0';
    tree.write('package.json', JSON.stringify(packageJson, null, 2));
    const nxJson = readNxJson(tree);
    nxJson.plugins = [{ plugin: '@nx/vite/plugin' }];
    updateNxJson(tree, nxJson);

    await ensureVitestPackageMigration(tree);

    const updatedPackageJson = readJson(tree, 'package.json');
    expect(updatedPackageJson.devDependencies['@nx/vitest']).toBeDefined();
  });

  it('does not install @nx/vitest when nothing in the workspace needs migrating', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      targets: {
        build: { executor: '@nx/vite:build' },
      },
    });
    const nxJson = readNxJson(tree);
    nxJson.plugins = [{ plugin: '@nx/vite/plugin' }];
    updateNxJson(tree, nxJson);

    await ensureVitestPackageMigration(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies?.['@nx/vitest']).toBeUndefined();
    const updated = readNxJson(tree);
    const vitestEntries = (updated.plugins ?? []).filter((p) =>
      typeof p === 'string' ? p === '@nx/vitest' : p.plugin === '@nx/vitest'
    );
    expect(vitestEntries).toHaveLength(0);
  });

  it('should pair @nx/vitest with each scoped @nx/vite/plugin even when one scope already had testTargetName and another was bare', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/vite/plugin',
        options: { testTargetName: 'test' },
        include: ['apps/**/*'],
      },
      {
        plugin: '@nx/vite/plugin',
        include: ['libs/**/*'],
      },
    ];
    updateNxJson(tree, nxJson);
    // Vitest signal in libs so workspaceUsesVitest returns true for the bare entry's scope.
    tree.write(
      'libs/lib1/vite.config.ts',
      `import { defineConfig } from 'vite';
export default defineConfig({ test: { globals: true } });
`
    );

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    // apps scope: vitest options moved off vite, mirrored onto a scoped @nx/vitest.
    expect(updated.plugins).toContainEqual({
      plugin: '@nx/vitest',
      options: { testTargetName: 'test' },
      include: ['apps/**/*'],
    });
    // libs scope: bare vite entry should pick up a paired bare @nx/vitest. This is
    // the gap — without it, libs/ silently loses test inference under v23.
    expect(updated.plugins).toContainEqual({
      plugin: '@nx/vitest',
      include: ['libs/**/*'],
    });
  });

  describe('migrateTargetDefaults', () => {
    it('renames executor-keyed @nx/vite:test entry to @nx/vitest:test', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/vite:test': {
          cache: true,
          inputs: ['default', '^production'],
          options: { watch: false },
        },
      };
      updateNxJson(tree, nxJson);

      await ensureVitestPackageMigration(tree);

      const updated = readNxJson(tree);
      expect(updated.targetDefaults['@nx/vite:test']).toBeUndefined();
      expect(updated.targetDefaults['@nx/vitest:test']).toEqual({
        cache: true,
        inputs: ['default', '^production'],
        options: { watch: false },
      });
    });

    it('swaps the executor field on a target-name-keyed entry', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: {
          executor: '@nx/vite:test',
          cache: true,
          options: { watch: false },
        },
      };
      updateNxJson(tree, nxJson);

      await ensureVitestPackageMigration(tree);

      const updated = readNxJson(tree);
      expect(updated.targetDefaults.test).toEqual({
        executor: '@nx/vitest:test',
        cache: true,
        options: { watch: false },
      });
    });

    it('lets legacy @nx/vite:test values overwrite an existing @nx/vitest:test entry on key collision', async () => {
      // Documents current Object.assign behavior: when both keys exist, legacy
      // values win on overlapping fields. This is the safer default for users
      // who set up the legacy entry intentionally and never touched the new
      // one. Any pre-existing @nx/vitest:test fields not overlapping are kept.
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/vite:test': {
          cache: true,
          options: { watch: false },
        },
        '@nx/vitest:test': {
          cache: false,
          inputs: ['default'],
        },
      };
      updateNxJson(tree, nxJson);

      await ensureVitestPackageMigration(tree);

      const updated = readNxJson(tree);
      expect(updated.targetDefaults['@nx/vite:test']).toBeUndefined();
      expect(updated.targetDefaults['@nx/vitest:test']).toEqual({
        cache: true,
        inputs: ['default'],
        options: { watch: false },
      });
    });
  });

  it('should split vitest options off @nx/vite/plugin into a new @nx/vitest registration', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/vite/plugin',
        options: {
          buildTargetName: 'build',
          testTargetName: 'unit-test',
          ciTargetName: 'unit-test-ci',
          ciGroupName: 'unit-tests',
        },
        include: ['apps/**/*'],
        exclude: ['apps/legacy/*'],
      },
    ];
    updateNxJson(tree, nxJson);

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    expect(updated.plugins).toContainEqual({
      plugin: '@nx/vite/plugin',
      options: { buildTargetName: 'build' },
      include: ['apps/**/*'],
      exclude: ['apps/legacy/*'],
    });
    expect(updated.plugins).toContainEqual({
      plugin: '@nx/vitest',
      options: {
        testTargetName: 'unit-test',
        ciTargetName: 'unit-test-ci',
        ciGroupName: 'unit-tests',
      },
      include: ['apps/**/*'],
      exclude: ['apps/legacy/*'],
    });
  });
});
