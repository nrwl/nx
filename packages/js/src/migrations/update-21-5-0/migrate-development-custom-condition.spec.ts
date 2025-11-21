import { type Tree, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migrate-development-custom-condition';

describe('migrate-development-custom-condition migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('when conditions are met', () => {
    beforeEach(() => {
      // Set up workspace with required conditions
      writeJson(tree, 'package.json', {
        name: '@my-org/workspace',
        version: '1.0.0',
      });

      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          customConditions: ['development'],
        },
      });

      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
      });
    });

    it('should update tsconfig.base.json custom condition', async () => {
      await migration(tree);

      const tsconfigBase = readJson(tree, 'tsconfig.base.json');
      expect(tsconfigBase.compilerOptions.customConditions).toEqual([
        '@my-org/workspace',
      ]);
    });

    it('should update package.json exports with development condition', async () => {
      // Create a library package.json with development exports
      writeJson(tree, 'libs/my-lib/package.json', {
        name: '@my-org/my-lib',
        exports: {
          '.': {
            development: './src/index.ts',
            default: './dist/index.js',
            types: './dist/index.d.ts',
          },
        },
      });

      await migration(tree);

      const packageJson = readJson(tree, 'libs/my-lib/package.json');
      expect(packageJson.exports).toEqual({
        '.': {
          '@my-org/workspace': './src/index.ts',
          default: './dist/index.js',
          types: './dist/index.d.ts',
        },
      });
    });

    it('should update nested exports with development condition', async () => {
      writeJson(tree, 'libs/my-lib/package.json', {
        name: '@my-org/my-lib',
        exports: {
          '.': {
            development: './src/index.ts',
            default: './dist/index.js',
          },
          './sub': {
            development: './src/sub/index.ts',
            default: './dist/sub/index.js',
          },
          './feature': {
            development: './src/feature/index.ts',
            import: './dist/feature/index.esm.js',
            default: './dist/feature/index.cjs',
          },
        },
      });

      await migration(tree);

      const packageJson = readJson(tree, 'libs/my-lib/package.json');
      expect(packageJson.exports).toEqual({
        '.': {
          '@my-org/workspace': './src/index.ts',
          default: './dist/index.js',
        },
        './sub': {
          '@my-org/workspace': './src/sub/index.ts',
          default: './dist/sub/index.js',
        },
        './feature': {
          '@my-org/workspace': './src/feature/index.ts',
          import: './dist/feature/index.esm.js',
          default: './dist/feature/index.cjs',
        },
      });
    });

    it('should update multiple package.json files', async () => {
      writeJson(tree, 'libs/lib-a/package.json', {
        name: '@my-org/lib-a',
        exports: {
          '.': {
            development: './src/index.ts',
            default: './dist/index.js',
          },
        },
      });

      writeJson(tree, 'libs/lib-b/package.json', {
        name: '@my-org/lib-b',
        exports: {
          '.': {
            development: './src/index.ts',
            import: './dist/index.esm.js',
            default: './dist/index.cjs',
          },
        },
      });

      await migration(tree);

      const libA = readJson(tree, 'libs/lib-a/package.json');
      const libB = readJson(tree, 'libs/lib-b/package.json');

      expect(libA.exports['.']).toHaveProperty('@my-org/workspace');
      expect(libA.exports['.']).not.toHaveProperty('development');

      expect(libB.exports['.']).toHaveProperty('@my-org/workspace');
      expect(libB.exports['.']).not.toHaveProperty('development');
    });

    it('should work with various TypeScript file extensions', async () => {
      writeJson(tree, 'libs/lib-ts/package.json', {
        name: '@my-org/lib-ts',
        exports: {
          '.': {
            development: './src/index.ts',
            default: './dist/index.js',
          },
        },
      });

      writeJson(tree, 'libs/lib-tsx/package.json', {
        name: '@my-org/lib-tsx',
        exports: {
          '.': {
            development: './src/index.tsx',
            default: './dist/index.js',
          },
        },
      });

      writeJson(tree, 'libs/lib-mts/package.json', {
        name: '@my-org/lib-mts',
        exports: {
          '.': {
            development: './src/index.mts',
            default: './dist/index.js',
          },
        },
      });

      writeJson(tree, 'libs/lib-cts/package.json', {
        name: '@my-org/lib-cts',
        exports: {
          '.': {
            development: './src/index.cts',
            default: './dist/index.js',
          },
        },
      });

      await migration(tree);

      const libTs = readJson(tree, 'libs/lib-ts/package.json');
      const libTsx = readJson(tree, 'libs/lib-tsx/package.json');
      const libMts = readJson(tree, 'libs/lib-mts/package.json');
      const libCts = readJson(tree, 'libs/lib-cts/package.json');

      expect(libTs.exports['.']).toHaveProperty('@my-org/workspace');
      expect(libTsx.exports['.']).toHaveProperty('@my-org/workspace');
      expect(libMts.exports['.']).toHaveProperty('@my-org/workspace');
      expect(libCts.exports['.']).toHaveProperty('@my-org/workspace');

      expect(libTs.exports['.']).not.toHaveProperty('development');
      expect(libTsx.exports['.']).not.toHaveProperty('development');
      expect(libMts.exports['.']).not.toHaveProperty('development');
      expect(libCts.exports['.']).not.toHaveProperty('development');
    });

    it('should not update package.json files without development exports', async () => {
      const originalExports = {
        '.': {
          import: './dist/index.esm.js',
          default: './dist/index.cjs',
        },
      };

      writeJson(tree, 'libs/my-lib/package.json', {
        name: '@my-org/my-lib',
        exports: originalExports,
      });

      await migration(tree);

      const packageJson = readJson(tree, 'libs/my-lib/package.json');
      expect(packageJson.exports).toEqual(originalExports);
    });

    it('should use @nx/source as fallback when workspace has no name', async () => {
      // Update workspace package.json to have no name
      writeJson(tree, 'package.json', {
        version: '1.0.0',
      });

      writeJson(tree, 'libs/my-lib/package.json', {
        name: '@my-org/my-lib',
        exports: {
          '.': {
            development: './src/index.ts',
            default: './dist/index.js',
          },
        },
      });

      await migration(tree);

      const tsconfigBase = readJson(tree, 'tsconfig.base.json');
      expect(tsconfigBase.compilerOptions.customConditions).toEqual([
        '@nx/source',
      ]);

      const packageJson = readJson(tree, 'libs/my-lib/package.json');
      expect(packageJson.exports['.']).toHaveProperty('@nx/source');
      expect(packageJson.exports['.']).not.toHaveProperty('development');
    });
  });

  describe('when conditions are not met', () => {
    it('should not run when tsconfig.base.json does not exist', async () => {
      writeJson(tree, 'tsconfig.json', {});

      // Remove the tsconfig.base.json that gets created by createTreeWithEmptyWorkspace
      if (tree.exists('tsconfig.base.json')) {
        tree.delete('tsconfig.base.json');
      }

      await migration(tree);

      // Should not have created tsconfig.base.json
      expect(tree.exists('tsconfig.base.json')).toBe(false);
    });

    it('should not run when tsconfig.json does not exist', async () => {
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          customConditions: ['development'],
        },
      });

      await migration(tree);

      const tsconfigBase = readJson(tree, 'tsconfig.base.json');
      expect(tsconfigBase.compilerOptions.customConditions).toEqual([
        'development',
      ]);
    });

    it('should not run when customConditions is not set', async () => {
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {},
      });
      writeJson(tree, 'tsconfig.json', {});

      await migration(tree);

      const tsconfigBase = readJson(tree, 'tsconfig.base.json');
      expect(tsconfigBase.compilerOptions.customConditions).toBeUndefined();
    });

    it('should not run when customConditions has multiple conditions', async () => {
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          customConditions: ['development', 'production'],
        },
      });
      writeJson(tree, 'tsconfig.json', {});

      await migration(tree);

      const tsconfigBase = readJson(tree, 'tsconfig.base.json');
      expect(tsconfigBase.compilerOptions.customConditions).toEqual([
        'development',
        'production',
      ]);
    });

    it('should not run when the single custom condition is not development', async () => {
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          customConditions: ['@my-org/source'],
        },
      });
      writeJson(tree, 'tsconfig.json', {});

      await migration(tree);

      const tsconfigBase = readJson(tree, 'tsconfig.base.json');
      expect(tsconfigBase.compilerOptions.customConditions).toEqual([
        '@my-org/source',
      ]);
    });

    it('should not run when customConditions is empty array', async () => {
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          customConditions: [],
        },
      });
      writeJson(tree, 'tsconfig.json', {});

      await migration(tree);

      const tsconfigBase = readJson(tree, 'tsconfig.base.json');
      expect(tsconfigBase.compilerOptions.customConditions).toEqual([]);
    });

    it('should not run when development exports point to non-TS files', async () => {
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          customConditions: ['development'],
        },
      });
      writeJson(tree, 'tsconfig.json', {});

      // Create a package with development export pointing to JS file
      writeJson(tree, 'libs/my-lib/package.json', {
        name: '@my-org/my-lib',
        exports: {
          '.': {
            development: './src/index.js', // Points to JS file, not TS
            default: './dist/index.js',
          },
        },
      });

      await migration(tree);

      // Should not have run migration
      const tsconfigBase = readJson(tree, 'tsconfig.base.json');
      expect(tsconfigBase.compilerOptions.customConditions).toEqual([
        'development',
      ]);
    });

    it('should not run when some development exports point to non-TS files', async () => {
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          customConditions: ['development'],
        },
      });
      writeJson(tree, 'tsconfig.json', {});

      // Create packages with mixed TS and JS development exports
      writeJson(tree, 'libs/lib-a/package.json', {
        name: '@my-org/lib-a',
        exports: {
          '.': {
            development: './src/index.ts', // TS file
            default: './dist/index.js',
          },
        },
      });

      writeJson(tree, 'libs/lib-b/package.json', {
        name: '@my-org/lib-b',
        exports: {
          '.': {
            development: './src/index.js', // JS file - should prevent migration
            default: './dist/index.js',
          },
        },
      });

      await migration(tree);

      // Should not have run migration
      const tsconfigBase = readJson(tree, 'tsconfig.base.json');
      expect(tsconfigBase.compilerOptions.customConditions).toEqual([
        'development',
      ]);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      // Set up valid conditions
      writeJson(tree, 'package.json', {
        name: '@test/workspace',
        version: '1.0.0',
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          customConditions: ['development'],
        },
      });
      writeJson(tree, 'tsconfig.json', {});
    });

    it('should handle package.json files with no exports', async () => {
      writeJson(tree, 'libs/my-lib/package.json', {
        name: '@my-org/my-lib',
        version: '1.0.0',
      });

      await migration(tree);

      const packageJson = readJson(tree, 'libs/my-lib/package.json');
      expect(packageJson.exports).toBeUndefined();
    });

    it('should handle package.json files with string exports', async () => {
      writeJson(tree, 'libs/my-lib/package.json', {
        name: '@my-org/my-lib',
        exports: './dist/index.js',
      });

      await migration(tree);

      const packageJson = readJson(tree, 'libs/my-lib/package.json');
      expect(packageJson.exports).toBe('./dist/index.js');
    });

    it('should handle invalid package.json files gracefully', async () => {
      tree.write('libs/invalid/package.json', 'invalid json{');

      await migration(tree);

      // Should not throw error and should continue processing other files
      const tsconfigBase = readJson(tree, 'tsconfig.base.json');
      expect(tsconfigBase.compilerOptions.customConditions).toEqual([
        '@test/workspace',
      ]);
    });

    it('should skip root package.json', async () => {
      const originalRootPackage = {
        name: '@test/workspace',
        exports: {
          '.': {
            development: './src/index.ts',
          },
        },
      };

      writeJson(tree, 'package.json', originalRootPackage);

      await migration(tree);

      const rootPackage = readJson(tree, 'package.json');
      // Should have original exports unchanged (except for name reading)
      expect(rootPackage.exports).toEqual(originalRootPackage.exports);
    });
  });
});
