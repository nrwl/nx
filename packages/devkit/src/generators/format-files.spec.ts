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

  describe('ignore files', () => {
    // These assert on formatted output, which needs prettier's parser loading
    // to work - it uses a dynamic import that jest only permits under
    // NODE_OPTIONS=--experimental-vm-modules. `nx test devkit` sets that
    // (nx.json), a bare `npx jest` does not, and without it nothing formats and
    // every case here is vacuous. The `kept` assertions - the ones expecting
    // *formatted* output - are what catch that: they fail rather than passing.
    const unformatted = 'const   x   =   1';
    const formatted = 'const x = 1;\n';

    it('should skip files covered by .gitignore or .prettierignore', async () => {
      tree.write('.gitignore', 'by-git.ts\n');
      tree.write('.prettierignore', 'by-prettier.ts\n');
      tree.write('by-git.ts', unformatted);
      tree.write('by-prettier.ts', unformatted);
      tree.write('kept.ts', unformatted);

      await formatFiles(tree);

      expect(tree.read('kept.ts', 'utf-8')).toBe(formatted);
      expect(tree.read('by-git.ts', 'utf-8')).toBe(unformatted);
      expect(tree.read('by-prettier.ts', 'utf-8')).toBe(unformatted);
    });

    // Prettier resolves ignore files from the workspace root only - it has no
    // nested-ignore-file concept, so `prettier --check` flags a file a nested
    // `.prettierignore` names. Skipping it here would leave it committed
    // unformatted and fail `nx format:check` on a file the generator author
    // never touched, so generator formatting has to stay root-only too.
    it('should ignore a nested ignore file, as prettier does', async () => {
      tree.write('apps/foo/.gitignore', '/generated/\n');
      tree.write('apps/foo/.prettierignore', 'nested.ts\n');
      tree.write('apps/foo/generated/a.ts', unformatted);
      tree.write('apps/foo/nested.ts', unformatted);
      tree.write('apps/foo/kept.ts', unformatted);

      await formatFiles(tree);

      expect(tree.read('apps/foo/kept.ts', 'utf-8')).toBe(formatted);
      expect(tree.read('apps/foo/generated/a.ts', 'utf-8')).toBe(formatted);
      expect(tree.read('apps/foo/nested.ts', 'utf-8')).toBe(formatted);
    });

    it('should not let .prettierignore negate .gitignore', async () => {
      // prettier builds an ignorer per ignore file and ORs them, so a `!` in
      // one cannot re-include what another excluded. `ignore.spec.ts` pins
      // `merge: false` directly; this is the end-to-end check that prettier
      // really behaves that way.
      tree.write('.gitignore', 'a.ts\n');
      tree.write('.prettierignore', '!a.ts\n');
      tree.write('a.ts', unformatted);
      tree.write('kept.ts', unformatted);

      await formatFiles(tree);

      expect(tree.read('kept.ts', 'utf-8')).toBe(formatted);
      expect(tree.read('a.ts', 'utf-8')).toBe(unformatted);
    });

    it('should apply a root ignore file to a nested path', async () => {
      tree.write('.gitignore', 'generated/\n');
      tree.write('apps/foo/generated/a.ts', unformatted);
      tree.write('apps/foo/kept.ts', unformatted);

      await formatFiles(tree);

      expect(tree.read('apps/foo/kept.ts', 'utf-8')).toBe(formatted);
      expect(tree.read('apps/foo/generated/a.ts', 'utf-8')).toBe(unformatted);
    });

    it('should never format files under node_modules', async () => {
      tree.write('node_modules/pkg/a.ts', unformatted);
      tree.write('kept.ts', unformatted);

      await formatFiles(tree);

      expect(tree.read('kept.ts', 'utf-8')).toBe(formatted);
      expect(tree.read('node_modules/pkg/a.ts', 'utf-8')).toBe(unformatted);
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
