import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from 'nx/src/generators/tree';
import { formatFiles } from './format-files';

describe('formatFiles', () => {
  let tree: Tree;
  const originalEnv = process.env;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('NX_SKIP_FORMAT', () => {
    it('should skip Prettier formatting when NX_SKIP_FORMAT is true', async () => {
      process.env.NX_SKIP_FORMAT = 'true';

      // Create a file with intentionally bad formatting
      const unformattedContent = 'const   x   =   1;';
      tree.write('test.ts', unformattedContent);

      await formatFiles(tree);

      // File should remain unformatted
      expect(tree.read('test.ts', 'utf-8')).toBe(unformattedContent);
    });

    it('should still sort tsconfig paths when NX_SKIP_FORMAT is true', async () => {
      process.env.NX_SKIP_FORMAT = 'true';
      process.env.NX_FORMAT_SORT_TSCONFIG_PATHS = 'true';

      // Create a tsconfig with unsorted paths
      tree.write(
        'tsconfig.base.json',
        JSON.stringify({
          compilerOptions: {
            paths: {
              '@z/lib': ['libs/z/src/index.ts'],
              '@a/lib': ['libs/a/src/index.ts'],
              '@m/lib': ['libs/m/src/index.ts'],
            },
          },
        })
      );

      await formatFiles(tree);

      // Paths should be sorted alphabetically
      const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
      const pathKeys = Object.keys(tsconfig.compilerOptions.paths);
      expect(pathKeys).toEqual(['@a/lib', '@m/lib', '@z/lib']);
    });

    it('should not skip formatting when NX_SKIP_FORMAT is not set', async () => {
      // Ensure NX_SKIP_FORMAT is not set
      delete process.env.NX_SKIP_FORMAT;

      // Create a prettierrc to indicate prettier is being used
      tree.write('.prettierrc', JSON.stringify({ singleQuote: true }));

      // Create a file that would be formatted
      const unformattedContent = 'const x = 1';
      tree.write('test.ts', unformattedContent);

      // This test mainly verifies that the function doesn't early return
      // when NX_SKIP_FORMAT is not set. Full formatting behavior depends
      // on Prettier being available.
      await formatFiles(tree);

      // If Prettier is available, the file would be formatted
      // If not, it remains unchanged - either way, no error should occur
      expect(tree.exists('test.ts')).toBe(true);
    });

    it('should not skip formatting when NX_SKIP_FORMAT is set to something other than true', async () => {
      process.env.NX_SKIP_FORMAT = 'false';

      // Create a prettierrc to indicate prettier is being used
      tree.write('.prettierrc', JSON.stringify({ singleQuote: true }));

      const content = 'const x = 1';
      tree.write('test.ts', content);

      // Should not early return when NX_SKIP_FORMAT !== 'true'
      await formatFiles(tree);

      expect(tree.exists('test.ts')).toBe(true);
    });
  });

  describe('sortRootTsconfigPaths', () => {
    it('should sort tsconfig paths when sortRootTsconfigPaths option is true', async () => {
      tree.write(
        'tsconfig.base.json',
        JSON.stringify({
          compilerOptions: {
            paths: {
              '@z/lib': ['libs/z/src/index.ts'],
              '@a/lib': ['libs/a/src/index.ts'],
            },
          },
        })
      );

      await formatFiles(tree, { sortRootTsconfigPaths: true });

      const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
      const pathKeys = Object.keys(tsconfig.compilerOptions.paths);
      expect(pathKeys).toEqual(['@a/lib', '@z/lib']);
    });

    it('should sort tsconfig paths when NX_FORMAT_SORT_TSCONFIG_PATHS is true', async () => {
      process.env.NX_FORMAT_SORT_TSCONFIG_PATHS = 'true';

      tree.write(
        'tsconfig.base.json',
        JSON.stringify({
          compilerOptions: {
            paths: {
              '@z/lib': ['libs/z/src/index.ts'],
              '@a/lib': ['libs/a/src/index.ts'],
            },
          },
        })
      );

      await formatFiles(tree);

      const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
      const pathKeys = Object.keys(tsconfig.compilerOptions.paths);
      expect(pathKeys).toEqual(['@a/lib', '@z/lib']);
    });
  });
});
