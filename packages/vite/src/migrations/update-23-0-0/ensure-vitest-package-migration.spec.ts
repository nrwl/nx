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

  it('should add @nx/vitest plugin when default @nx/vite/plugin is registered as a string', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = ['@nx/vite/plugin'];
    updateNxJson(tree, nxJson);

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    expect(updated.plugins).toContainEqual({ plugin: '@nx/vitest' });
    expect(updated.plugins).toContain('@nx/vite/plugin');
  });

  it('should add @nx/vitest plugin when default @nx/vite/plugin is registered as an object with no test options', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [{ plugin: '@nx/vite/plugin' }];
    updateNxJson(tree, nxJson);

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

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    expect(updated.plugins).toContainEqual({
      plugin: '@nx/vitest',
      include: ['apps/**/*'],
      exclude: ['apps/legacy/*'],
    });
  });

  it('should be a no-op when @nx/vitest plugin is already registered and @nx/vite/plugin has no vitest options', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [{ plugin: '@nx/vite/plugin' }, { plugin: '@nx/vitest' }];
    updateNxJson(tree, nxJson);

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

  it('installs @nx/vitest when root package.json depends on vitest', async () => {
    const packageJson = readJson(tree, 'package.json');
    packageJson.devDependencies = packageJson.devDependencies || {};
    packageJson.devDependencies['vitest'] = '^2.0.0';
    tree.write('package.json', JSON.stringify(packageJson, null, 2));

    await ensureVitestPackageMigration(tree);

    const updatedPackageJson = readJson(tree, 'package.json');
    expect(updatedPackageJson.devDependencies['@nx/vitest']).toBeDefined();
  });

  it('does not install @nx/vitest when no vitest dependency and no @nx/vite:test executor are present', async () => {
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
  });

  it('should merge vitest options into existing @nx/vitest when both plugins are registered', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/vite/plugin',
        options: { testTargetName: 'unit-test', buildTargetName: 'build' },
      },
      { plugin: '@nx/vitest' },
    ];
    updateNxJson(tree, nxJson);

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    expect(updated.plugins).toContainEqual({
      plugin: '@nx/vite/plugin',
      options: { buildTargetName: 'build' },
    });
    const vitestEntry = updated.plugins.find(
      (p) => typeof p !== 'string' && p.plugin === '@nx/vitest'
    );
    expect(vitestEntry).toMatchObject({
      plugin: '@nx/vitest',
      options: { testTargetName: 'unit-test' },
    });
    const vitestEntries = updated.plugins.filter(
      (p) => typeof p !== 'string' && p.plugin === '@nx/vitest'
    );
    expect(vitestEntries).toHaveLength(1);
  });

  it('should not overwrite existing @nx/vitest options when merging from @nx/vite/plugin', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/vite/plugin',
        options: { testTargetName: 'vite-test' },
      },
      { plugin: '@nx/vitest', options: { testTargetName: 'vitest-run' } },
    ];
    updateNxJson(tree, nxJson);

    await ensureVitestPackageMigration(tree);

    const updated = readNxJson(tree);
    const vitestEntry = updated.plugins.find(
      (p) => typeof p !== 'string' && p.plugin === '@nx/vitest'
    ) as { plugin: string; options: Record<string, unknown> };
    expect(vitestEntry.options.testTargetName).toBe('vitest-run');
  });
});
