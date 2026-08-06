import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import { FsTree, type Tree } from 'nx/src/generators/tree';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
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
    it('should skip formatting when NX_SKIP_FORMAT is true', async () => {
      process.env.NX_SKIP_FORMAT = 'true';
      // The fixture already configures oxfmt, so this write is belt-and-braces:
      // what the test needs is a workspace that really would format, or it
      // would pass whether or not NX_SKIP_FORMAT were honoured.
      tree.write('.oxfmtrc.json', '{}');

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
    // The tree from `beforeEach` is oxfmt, which is what a new workspace gets;
    // the one prettier-specific case builds its own.
    //
    // Only that prettier case needs NODE_OPTIONS=--experimental-vm-modules:
    // prettier is reached through a dynamic import jest refuses without it,
    // and `nx test devkit` sets it via nx.json where a bare `npx jest` does
    // not. Its `kept` assertion is what catches the flag going missing. The
    // oxfmt cases are unaffected - `loadOxfmtModule` tries bare `require`
    // first, which jest.preset.js maps to a CommonJS mock (measured: without
    // the flag they still format).
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

    // The one axis the two formatters disagree on, so it gets a test each.
    // Skipping a file the formatter's own CLI would still check leaves it
    // committed unformatted and fails `nx format:check` on a file the generator
    // author never touched - so each branch has to match its own CLI, not the
    // other's. Both measured: prettier 3.6.2 root-only, oxfmt 0.60.0 cascading.
    function writeNestedFixture(target: Tree) {
      target.write('apps/foo/.gitignore', '/generated/\n');
      target.write('apps/foo/.prettierignore', 'nested.ts\n');
      target.write('apps/foo/generated/a.ts', unformatted);
      target.write('apps/foo/nested.ts', unformatted);
      target.write('apps/foo/kept.ts', unformatted);
    }

    it('should ignore a nested ignore file under prettier', async () => {
      const prettierTree = createTreeWithEmptyWorkspace({
        formatter: 'prettier',
      });
      writeNestedFixture(prettierTree);

      await formatFiles(prettierTree);

      expect(prettierTree.read('apps/foo/kept.ts', 'utf-8')).toBe(formatted);
      expect(prettierTree.read('apps/foo/generated/a.ts', 'utf-8')).toBe(
        formatted
      );
      expect(prettierTree.read('apps/foo/nested.ts', 'utf-8')).toBe(formatted);
    });

    it('should honour a nested ignore file under oxfmt', async () => {
      writeNestedFixture(tree);

      await formatFiles(tree);

      expect(tree.read('apps/foo/kept.ts', 'utf-8')).toBe(formatted);
      expect(tree.read('apps/foo/generated/a.ts', 'utf-8')).toBe(unformatted);
      expect(tree.read('apps/foo/nested.ts', 'utf-8')).toBe(unformatted);
    });

    it('should not let .prettierignore negate .gitignore', async () => {
      // Both formatters build an ignorer per ignore file and OR them, so a `!`
      // in one cannot re-include what another excluded. `ignore.spec.ts` pins
      // `merge: false` for each; this is the end-to-end check that the
      // formatter really behaves that way.
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

  describe('oxfmt', () => {
    it('should format with oxfmt when the workspace is configured for it', async () => {
      tree.write('.oxfmtrc.json', JSON.stringify({ singleQuote: true }));
      tree.write('test.ts', 'const   x   =   "hi"');

      await formatFiles(tree);

      expect(tree.read('test.ts', 'utf-8')).toBe("const x = 'hi';\n");
    });

    it('should use a config the generator just created rather than the defaults', async () => {
      // The config exists only in the tree, so oxfmt cannot discover it on
      // disk - it has to be handed over, or the files a generator ships come
      // out formatted differently from the config it ships with them.
      // `useTabs` rather than `singleQuote: false`, which is oxfmt's default
      // and so cannot tell "config applied" apart from "config ignored".
      tree.write('.oxfmtrc.json', JSON.stringify({ useTabs: true }));
      tree.write('test.ts', 'function f() {\nif (a) {\nb();\n}\n}');

      await formatFiles(tree);

      expect(tree.read('test.ts', 'utf-8')).toContain('\tif (a) {');
    });

    it('should still format when the generator deleted an oxfmt config', async () => {
      // `listChanges` reports a DELETE only when the file exists on disk, so in
      // a tree rooted at `/virtual` a write and a delete leave no change at all
      // and this branch is unreachable. Hence a root that really exists.
      const fs = new TempFs('format-files-oxfmt');
      try {
        fs.createFileSync(
          '.oxfmtrc.json',
          JSON.stringify({ singleQuote: true })
        );
        fs.createFileSync('.oxfmtrc.jsonc', '{}');
        const fsTree = new FsTree(fs.tempDir, false);

        // Deleting a JSON config is what exposes the filter: unfiltered it is
        // picked up as the "generated" seed, read back as null, and parsed -
        // which reports an unreadable config and skips the batch. The workspace
        // still has `.oxfmtrc.json`, so a formatter is configured either way.
        fsTree.delete('.oxfmtrc.jsonc');
        fsTree.write('test.ts', 'const   x   =   "hi"');
        expect(fsTree.listChanges().some((c) => c.type === 'DELETE')).toBe(
          true
        );

        await formatFiles(fsTree);

        // A deleted config reads back as null; treating it as the generated
        // seed would report an unreadable config and skip the whole batch.
        expect(fsTree.read('test.ts', 'utf-8')).toBe("const x = 'hi';\n");
      } finally {
        fs.cleanup();
      }
    });
  });
});
