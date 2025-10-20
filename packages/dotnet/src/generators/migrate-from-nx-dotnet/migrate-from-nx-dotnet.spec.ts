import { readNxJson, Tree, updateNxJson, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { migrateFromNxDotnetGenerator } from './migrate-from-nx-dotnet';
import { MigrateFromNxDotnetSchema } from './schema';

// Mock child_process execSync for git checks
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    execSync: jest.fn(() => ''),
  };
});

describe('@nx/dotnet:migrate-from-nx-dotnet', () => {
  let tree: Tree;
  let execSyncMock: jest.Mock;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // Add a basic package.json with @nx-dotnet/core installed
    tree.write(
      'package.json',
      JSON.stringify({
        name: 'test-workspace',
        dependencies: {
          '@nx-dotnet/core': '^2.0.0',
        },
      })
    );

    // Mock git status to return empty (clean state)
    const childProcess = require('child_process');
    execSyncMock = childProcess.execSync as jest.Mock;
    execSyncMock.mockReturnValue('');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('git state validation', () => {
    it('should throw error when git working directory is not clean', async () => {
      execSyncMock.mockReturnValue('M package.json\n');

      const options: MigrateFromNxDotnetSchema = {};

      await expect(migrateFromNxDotnetGenerator(tree, options)).rejects.toThrow(
        'Git working directory is not clean'
      );
    });

    it('should continue when git is not available', async () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('git not found');
      });

      const options: MigrateFromNxDotnetSchema = {};

      // Should not throw - continues with warning
      await migrateFromNxDotnetGenerator(tree, options);
      expect(tree.exists('NX_DOTNET_NEXT_STEPS.md')).toBe(true);
    });

    it('should skip git check when skipGitCheck is true', async () => {
      execSyncMock.mockReturnValue('M package.json\n');

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);
      expect(tree.exists('NX_DOTNET_NEXT_STEPS.md')).toBe(true);
    });
  });

  describe('prerequisites', () => {
    it('should exit early when @nx-dotnet/core is not installed', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          name: 'test-workspace',
          dependencies: {},
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      // Should not create migration summary
      expect(tree.exists('NX_DOTNET_NEXT_STEPS.md')).toBe(false);
    });

    it('should detect @nx-dotnet/core in dependencies', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          name: 'test-workspace',
          dependencies: {
            '@nx-dotnet/core': '^2.0.0',
          },
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);
      expect(tree.exists('NX_DOTNET_NEXT_STEPS.md')).toBe(true);
    });

    it('should detect @nx-dotnet/utils in devDependencies', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          name: 'test-workspace',
          devDependencies: {
            '@nx-dotnet/utils': '^2.0.0',
          },
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);
      expect(tree.exists('NX_DOTNET_NEXT_STEPS.md')).toBe(true);
    });

    it('should detect @nx-dotnet/dotnet package', async () => {
      tree.write(
        'package.json',
        JSON.stringify({
          name: 'test-workspace',
          dependencies: {
            '@nx-dotnet/dotnet': '^2.0.0',
          },
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);
      expect(tree.exists('NX_DOTNET_NEXT_STEPS.md')).toBe(true);
    });
  });

  describe('plugin configuration', () => {
    it('should throw error when multiple @nx-dotnet/core plugins are found', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core', '@nx-dotnet/core'],
      });

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await expect(migrateFromNxDotnetGenerator(tree, options)).rejects.toThrow(
        'Multiple instances of @nx-dotnet/core plugin detected'
      );
    });

    it('should disable @nx-dotnet/core plugin (string format)', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const nxJson = readNxJson(tree);
      const oldPlugin = nxJson?.plugins?.find((p) => {
        if (typeof p === 'string') return false;
        return p.plugin === '@nx-dotnet/core';
      });

      expect(oldPlugin).toMatchObject({
        plugin: '@nx-dotnet/core',
        exclude: ['*'],
      });
    });

    it('should disable @nx-dotnet/core plugin (object format)', async () => {
      updateNxJson(tree, {
        plugins: [
          {
            plugin: '@nx-dotnet/core',
            options: { solutionFile: 'MySolution.sln' },
          },
        ],
      });

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const nxJson = readNxJson(tree);
      const oldPlugin = nxJson?.plugins?.find((p) => {
        if (typeof p === 'string') return false;
        return p.plugin === '@nx-dotnet/core';
      });

      expect(oldPlugin).toMatchObject({
        plugin: '@nx-dotnet/core',
        exclude: ['*'],
        options: { solutionFile: 'MySolution.sln' },
      });
    });

    it('should ensure @nx/dotnet plugin exists', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const nxJson = readNxJson(tree);
      const dotnetPlugin = nxJson?.plugins?.find((p) => {
        if (typeof p === 'string') return p === '@nx/dotnet';
        return p.plugin === '@nx/dotnet';
      });

      expect(dotnetPlugin).toBeDefined();
    });

    it('should convert string @nx/dotnet plugin to object', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core', '@nx/dotnet'],
      });

      tree.write(
        '.nx-dotnet.rc.json',
        JSON.stringify({
          inferredTargets: {
            build: { cache: false },
          },
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const nxJson = readNxJson(tree);
      const dotnetPlugin = nxJson?.plugins?.find((p) => {
        if (typeof p === 'string') return p === '@nx/dotnet';
        return p.plugin === '@nx/dotnet';
      });

      expect(typeof dotnetPlugin).toBe('object');
      expect(dotnetPlugin).toHaveProperty('options');
    });
  });

  describe('configuration migration', () => {
    it('should migrate from RC file only', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      tree.write(
        '.nx-dotnet.rc.json',
        JSON.stringify({
          inferredTargets: {
            build: { cache: false },
          },
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const nxJson = readNxJson(tree);
      const dotnetPlugin = nxJson?.plugins?.find((p) => {
        if (typeof p === 'string') return false;
        return p.plugin === '@nx/dotnet';
      });

      expect(dotnetPlugin).toMatchObject({
        plugin: '@nx/dotnet',
        options: {
          build: { cache: false },
        },
      });
    });

    it('should migrate from plugin options only', async () => {
      updateNxJson(tree, {
        plugins: [
          {
            plugin: '@nx-dotnet/core',
            options: {
              inferredTargets: {
                test: { cache: true },
              },
            },
          },
        ],
      });

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const nxJson = readNxJson(tree);
      const dotnetPlugin = nxJson?.plugins?.find((p) => {
        if (typeof p === 'string') return false;
        return p.plugin === '@nx/dotnet';
      });

      expect(dotnetPlugin).toMatchObject({
        plugin: '@nx/dotnet',
        options: {
          test: { cache: true },
        },
      });
    });

    it('should merge RC file and plugin options (plugin takes precedence)', async () => {
      updateNxJson(tree, {
        plugins: [
          {
            plugin: '@nx-dotnet/core',
            options: {
              inferredTargets: {
                build: { cache: false },
              },
            },
          },
        ],
      });

      tree.write(
        '.nx-dotnet.rc.json',
        JSON.stringify({
          inferredTargets: {
            build: { cache: true },
            test: { cache: true },
          },
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const nxJson = readNxJson(tree);
      const dotnetPlugin = nxJson?.plugins?.find((p) => {
        if (typeof p === 'string') return false;
        return p.plugin === '@nx/dotnet';
      });

      // Plugin option should take precedence
      expect((dotnetPlugin as any)?.options?.build).toMatchObject({
        cache: false,
      });
      expect((dotnetPlugin as any)?.options?.test).toMatchObject({
        cache: true,
      });
    });

    it('should handle case with no configuration to migrate', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      // Should complete successfully without errors
      expect(tree.exists('NX_DOTNET_NEXT_STEPS.md')).toBe(true);
    });
  });

  describe('package cleanup', () => {
    it('should remove @nx-dotnet packages when removeNxDotnetCore is true', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      tree.write(
        'package.json',
        JSON.stringify({
          name: 'test-workspace',
          dependencies: {
            '@nx-dotnet/core': '^2.0.0',
            '@nx-dotnet/utils': '^2.0.0',
          },
          devDependencies: {
            '@nx-dotnet/dotnet': '^2.0.0',
          },
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
        removeNxDotnetCore: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.dependencies['@nx-dotnet/core']).toBeUndefined();
      expect(packageJson.dependencies['@nx-dotnet/utils']).toBeUndefined();
      expect(packageJson.devDependencies['@nx-dotnet/dotnet']).toBeUndefined();
    });

    it('should keep packages when removeNxDotnetCore is false', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      tree.write(
        'package.json',
        JSON.stringify({
          name: 'test-workspace',
          dependencies: {
            '@nx-dotnet/core': '^2.0.0',
          },
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
        removeNxDotnetCore: false,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.dependencies['@nx-dotnet/core']).toBe('^2.0.0');
    });

    it('should respect skipPackageJson option', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      tree.write(
        'package.json',
        JSON.stringify({
          name: 'test-workspace',
          dependencies: {
            '@nx-dotnet/core': '^2.0.0',
          },
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
        removeNxDotnetCore: true,
        skipPackageJson: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.dependencies['@nx-dotnet/core']).toBe('^2.0.0');
    });
  });

  describe('RC file cleanup', () => {
    it('should remove .nx-dotnet.rc.json when removeRcFile is true', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      tree.write('.nx-dotnet.rc.json', JSON.stringify({}));

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
        removeRcFile: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      expect(tree.exists('.nx-dotnet.rc.json')).toBe(false);
    });

    it('should keep .nx-dotnet.rc.json when removeRcFile is false', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      tree.write('.nx-dotnet.rc.json', JSON.stringify({}));

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
        removeRcFile: false,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      expect(tree.exists('.nx-dotnet.rc.json')).toBe(true);
    });
  });

  describe('summary generation', () => {
    it('should create NX_DOTNET_NEXT_STEPS.md with completed steps', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      expect(tree.exists('NX_DOTNET_NEXT_STEPS.md')).toBe(true);

      const summary = tree.read('NX_DOTNET_NEXT_STEPS.md', 'utf-8');
      expect(summary).toContain(
        'Disabled @nx-dotnet/core plugin by adding `exclude: ["*"]`'
      );
      expect(summary).toContain('✅ Completed');
      expect(summary).toContain('Next Steps');
    });

    it('should include manual steps in summary', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      tree.write(
        '.nx-dotnet.rc.json',
        JSON.stringify({
          nugetPackages: {
            'Newtonsoft.Json': '13.0.1',
          },
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const summary = tree.read('NX_DOTNET_NEXT_STEPS.md', 'utf-8');
      expect(summary).toContain('⚠️  Manual Migration Required');
      expect(summary).toContain('Central Package Management');
    });

    it('should respect skipFormat option', async () => {
      updateNxJson(tree, {
        plugins: ['@nx-dotnet/core'],
      });

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
        skipFormat: true,
      };

      // Should not throw
      await migrateFromNxDotnetGenerator(tree, options);
      expect(tree.exists('NX_DOTNET_NEXT_STEPS.md')).toBe(true);
    });
  });

  describe('integration tests', () => {
    it('should handle full migration with all features enabled', async () => {
      updateNxJson(tree, {
        plugins: [
          {
            plugin: '@nx-dotnet/core',
            options: {
              inferredTargets: {
                build: { cache: true },
              },
            },
          },
        ],
        targetDefaults: {
          '@nx-dotnet/core:test': {
            cache: true,
          },
        },
      });

      tree.write(
        '.nx-dotnet.rc.json',
        JSON.stringify({
          inferredTargets: {
            test: false,
          },
          nugetPackages: {
            'Newtonsoft.Json': '13.0.1',
          },
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
        removeNxDotnetCore: true,
        removeRcFile: true,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const nxJson = readNxJson(tree);
      const dotnetPlugin = nxJson?.plugins?.find((p) => {
        if (typeof p === 'string') return false;
        return p.plugin === '@nx/dotnet';
      });

      // Check plugin configuration
      expect((dotnetPlugin as any)?.options?.build).toMatchObject({
        cache: true,
      });
      expect((dotnetPlugin as any)?.options?.test).toMatchObject({
        cache: true,
      });

      // Check old plugin is disabled
      const oldPlugin = nxJson?.plugins?.find((p) => {
        if (typeof p === 'string') return false;
        return p.plugin === '@nx-dotnet/core';
      });
      expect((oldPlugin as any)?.exclude).toEqual(['*']);

      // Check targetDefaults migrated
      expect(nxJson?.targetDefaults?.['@nx-dotnet/core:test']).toBeUndefined();

      // Check RC file removed
      expect(tree.exists('.nx-dotnet.rc.json')).toBe(false);

      // Check package.json updated
      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.dependencies['@nx-dotnet/core']).toBeUndefined();

      // Check summary generated
      expect(tree.exists('NX_DOTNET_NEXT_STEPS.md')).toBe(true);
    });

    it('should handle real-world configuration example', async () => {
      updateNxJson(tree, {
        plugins: [
          {
            plugin: '@nx-dotnet/core',
            options: {
              solutionFile: 'MySolution.sln',
              inferProjects: true,
              ignorePaths: ['**/obj/**', '**/bin/**'],
            },
          },
        ],
        targetDefaults: {
          '@nx-dotnet/core:build': {
            dependsOn: ['^build'],
            inputs: ['production', '^production'],
            cache: true,
          },
          '@nx-dotnet/core:test': {
            inputs: ['default', '^production'],
            cache: true,
          },
        },
      });

      tree.write(
        '.nx-dotnet.rc.json',
        JSON.stringify({
          inferredTargets: {
            build: { targetName: 'compile' },
            test: false,
            serve: { cache: false },
          },
          nugetPackages: {
            'Newtonsoft.Json': '13.0.1',
            AutoMapper: '12.0.0',
          },
          moduleBoundaries: [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:lib'],
            },
          ],
        })
      );

      const options: MigrateFromNxDotnetSchema = {
        skipGitCheck: true,
        removeNxDotnetCore: false,
        removeRcFile: false,
      };

      await migrateFromNxDotnetGenerator(tree, options);

      const nxJson = readNxJson(tree);
      const dotnetPlugin = nxJson?.plugins?.find((p) => {
        if (typeof p === 'string') return false;
        return p.plugin === '@nx/dotnet';
      });

      // Check complex configuration was migrated
      expect((dotnetPlugin as any)?.options?.build).toMatchObject({
        dependsOn: ['^build'],
        inputs: ['production', '^production'],
        cache: true,
      });

      // Check disabled target
      expect((dotnetPlugin as any)?.options?.test).toMatchObject({
        inputs: ['default', '^production'],
        cache: true,
      });

      // Check renamed target
      expect((dotnetPlugin as any)?.options?.serve).toMatchObject({
        cache: false,
      });

      // Check old files kept
      expect(tree.exists('.nx-dotnet.rc.json')).toBe(true);
      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.dependencies['@nx-dotnet/core']).toBeDefined();
    });
  });
});
