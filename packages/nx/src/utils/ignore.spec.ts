import { createTree } from '../generators/testing-utils/create-tree';
import {
  createGitIgnoreChecker,
  createIgnoreChainResolver,
  createOxfmtIgnoreChecker,
  createPrettierIgnoreChecker,
  isIgnoredByChain,
  posixDirname,
} from './ignore';

describe('createIgnoreChainResolver', () => {
  /** Builds a resolver over an in-memory `path -> contents` map. */
  function resolverFor(
    files: Record<string, string>,
    filenames = ['.gitignore'],
    merge = false
  ) {
    return createIgnoreChainResolver(
      (path) => files[path] ?? null,
      filenames,
      merge
    );
  }

  function ignores(
    files: Record<string, string>,
    filePath: string,
    filenames?: string[],
    merge = false
  ) {
    const resolve = resolverFor(files, filenames, merge);
    return isIgnoredByChain(resolve(posixDirname(filePath)), filePath);
  }

  it('applies the root ignore file to a nested file', () => {
    expect(ignores({ '.gitignore': 'dist\n' }, 'apps/foo/dist/a.ts')).toBe(
      true
    );
    expect(ignores({ '.gitignore': 'dist\n' }, 'apps/foo/src/a.ts')).toBe(
      false
    );
  });

  it('applies a nested ignore file', () => {
    const files = { 'apps/foo/.gitignore': 'skip.ts\n' };

    expect(ignores(files, 'apps/foo/skip.ts')).toBe(true);
    // The same name outside that directory is untouched by it.
    expect(ignores(files, 'apps/bar/skip.ts')).toBe(false);
  });

  it('anchors a nested pattern at its own directory', () => {
    // A leading slash anchors to the file holding it. Matching against the
    // workspace-relative path instead would never hit here - and a bare
    // filename would hit either way, so this is what pins the rebasing.
    const files = { 'apps/foo/.gitignore': '/generated/\n' };

    expect(ignores(files, 'apps/foo/generated/a.ts')).toBe(true);
    expect(ignores(files, 'generated/a.ts')).toBe(false);
    expect(ignores(files, 'apps/foo/src/generated/a.ts')).toBe(false);
  });

  it('combines a root and a nested ignore file', () => {
    const files = {
      '.gitignore': 'dist\n',
      'apps/foo/.gitignore': 'tmp\n',
    };

    expect(ignores(files, 'apps/foo/dist/a.ts')).toBe(true);
    expect(ignores(files, 'apps/foo/tmp/a.ts')).toBe(true);
    // The nested file's patterns must not escape upwards.
    expect(ignores(files, 'apps/bar/tmp/a.ts')).toBe(false);
  });

  it('lets a nested negation re-include a file the root ignored', () => {
    const files = {
      '.gitignore': '*.log\n',
      'apps/foo/.gitignore': '!keep.log\n',
    };

    expect(ignores(files, 'apps/foo/keep.log')).toBe(false);
    expect(ignores(files, 'apps/foo/other.log')).toBe(true);
    expect(ignores(files, 'apps/bar/keep.log')).toBe(true);
  });

  it('does not let one file negate another file in the same directory', () => {
    // prettier builds an ignorer per ignore file and ORs them, so a `!` in one
    // cannot re-include what another excluded. Merging them into one matcher
    // would, and would reformat a file the user deliberately excluded.
    const files = {
      '.gitignore': 'both.ts\n',
      '.prettierignore': '!both.ts\n',
    };
    const filenames = ['.gitignore', '.prettierignore'];

    expect(ignores(files, 'both.ts', filenames)).toBe(true);
    // Order must not matter either.
    expect(ignores(files, 'both.ts', [...filenames].reverse())).toBe(true);
  });

  it('lets a later file override an earlier one when merged', () => {
    // The native walker registers `.nxignore` via `add_custom_ignore_filename`,
    // which outranks `.gitignore` - measured against `WorkspaceContext` in both
    // directions - and master merged both files into one matcher so `.nxignore`
    // won there too. Without the merge `.gitignore`'s exclusion would win.
    const names = ['.gitignore', '.nxignore'];

    expect(
      ignores(
        { '.gitignore': 'x.ts\n', '.nxignore': '!x.ts\n' },
        'x.ts',
        names,
        true
      )
    ).toBe(false);
    expect(
      ignores(
        { '.gitignore': '!x.ts\n', '.nxignore': 'x.ts\n' },
        'x.ts',
        names,
        true
      )
    ).toBe(true);
    // A file with no opinion falls through to the next one.
    expect(
      ignores(
        { '.gitignore': 'x.ts\n', '.nxignore': 'other.ts\n' },
        'x.ts',
        names,
        true
      )
    ).toBe(true);
  });

  it('still honours a negation within a single file', () => {
    const files = { '.gitignore': '*.log\n!keep.log\n' };

    expect(ignores(files, 'keep.log')).toBe(false);
    expect(ignores(files, 'other.log')).toBe(true);
  });

  it('reads every configured filename in a directory', () => {
    const files = {
      'apps/foo/.gitignore': 'a.ts\n',
      'apps/foo/.nxignore': 'b.ts\n',
    };
    const filenames = ['.gitignore', '.nxignore'];

    expect(ignores(files, 'apps/foo/a.ts', filenames)).toBe(true);
    expect(ignores(files, 'apps/foo/b.ts', filenames)).toBe(true);
    expect(ignores(files, 'apps/foo/c.ts', filenames)).toBe(false);
  });

  it('reads each directory once across sibling leaves', () => {
    const reads: string[] = [];
    const resolve = createIgnoreChainResolver(
      (path) => {
        reads.push(path);
        return path === '.gitignore' ? 'dist\n' : null;
      },
      ['.gitignore'],
      false
    );

    resolve('apps/foo/src');
    resolve('apps/foo/lib');

    // The shared trunk - apps/foo, apps, root - is walked once, not once per
    // leaf, so only the second leaf's own directory is newly read.
    expect(reads).toEqual([
      'apps/foo/src/.gitignore',
      'apps/foo/.gitignore',
      'apps/.gitignore',
      '.gitignore',
      'apps/foo/lib/.gitignore',
    ]);
  });

  it('returns an empty chain when nothing is ignored anywhere', () => {
    const resolve = resolverFor({});

    expect(resolve('apps/foo')).toEqual([]);
    expect(isIgnoredByChain([], 'apps/foo/a.ts')).toBe(false);
  });
});

describe('posixDirname', () => {
  it.each([
    ['apps/foo/a.ts', 'apps/foo'],
    ['a.ts', ''],
    ['apps/a.ts', 'apps'],
  ])('maps %s to %s', (input, expected) => {
    expect(posixDirname(input)).toBe(expected);
  });
});

// Each constructor bundles three values - which files it reads, whether they
// cascade, and whether they merge. git's and prettier's are unreachable from a
// caller, so the only way to pin them is through what the returned predicates
// do. oxfmt's is exported as `OXFMT_IGNORE_OPTIONS` because the disk-backed
// resolver needs the same set, but it is pinned the same way here.
describe('the ignore checkers', () => {
  function treeWith(files: Record<string, string>) {
    const tree = createTree();
    for (const [path, contents] of Object.entries(files)) {
      tree.write(path, contents);
    }
    return tree;
  }

  describe('createGitIgnoreChecker', () => {
    it('reads .gitignore and .nxignore', () => {
      const git = createGitIgnoreChecker(
        treeWith({
          '.gitignore': 'a.ts\n',
          '.nxignore': 'b.ts\n',
          '.prettierignore': 'c.ts\n',
        })
      );

      expect(git.isIgnoredFile('a.ts')).toBe(true);
      expect(git.isIgnoredFile('b.ts')).toBe(true);
      // git knows nothing about .prettierignore - the set is exact, not a floor.
      expect(git.isIgnoredFile('c.ts')).toBe(false);
    });

    it('cascades, so a nested ignore file covers its own directory', () => {
      const git = createGitIgnoreChecker(
        treeWith({ 'apps/foo/.gitignore': 'nested.ts\n' })
      );

      expect(git.isIgnoredFile('apps/foo/nested.ts')).toBe(true);
      // The same name elsewhere is untouched - the nested file is not global.
      expect(git.isIgnoredFile('apps/bar/nested.ts')).toBe(false);
    });

    it('merges the files of one directory, so .nxignore outranks .gitignore', () => {
      const git = createGitIgnoreChecker(
        treeWith({ '.gitignore': 'a.ts\n', '.nxignore': '!a.ts\n' })
      );

      expect(git.isIgnoredFile('a.ts')).toBe(false);
    });
  });

  describe('createPrettierIgnoreChecker', () => {
    it('reads .gitignore and .prettierignore, not .nxignore', () => {
      const prettier = createPrettierIgnoreChecker(
        treeWith({
          '.gitignore': 'a.ts\n',
          '.prettierignore': 'b.ts\n',
          '.nxignore': 'c.ts\n',
        })
      );

      expect(prettier.isIgnoredFile('a.ts')).toBe(true);
      expect(prettier.isIgnoredFile('b.ts')).toBe(true);
      expect(prettier.isIgnoredFile('c.ts')).toBe(false);
    });

    it('does not cascade - prettier resolves from the workspace root only', () => {
      const prettier = createPrettierIgnoreChecker(
        treeWith({ 'apps/foo/.prettierignore': 'nested.ts\n' })
      );

      expect(prettier.isIgnoredFile('apps/foo/nested.ts')).toBe(false);
    });

    it('keeps the files separate, so .prettierignore cannot re-include', () => {
      const prettier = createPrettierIgnoreChecker(
        treeWith({ '.gitignore': 'a.ts\n', '.prettierignore': '!a.ts\n' })
      );

      expect(prettier.isIgnoredFile('a.ts')).toBe(true);
    });
  });

  describe('createOxfmtIgnoreChecker', () => {
    it('reads .gitignore and .prettierignore, not .nxignore', () => {
      const oxfmt = createOxfmtIgnoreChecker(
        treeWith({
          '.gitignore': 'a.ts\n',
          '.prettierignore': 'b.ts\n',
          '.nxignore': 'c.ts\n',
        })
      );

      expect(oxfmt.isIgnoredFile('a.ts')).toBe(true);
      expect(oxfmt.isIgnoredFile('b.ts')).toBe(true);
      expect(oxfmt.isIgnoredFile('c.ts')).toBe(false);
    });

    // The one axis oxfmt differs from prettier on, measured against both CLIs.
    it('cascades, unlike prettier', () => {
      const oxfmt = createOxfmtIgnoreChecker(
        treeWith({ 'apps/foo/.prettierignore': 'nested.ts\n' })
      );

      expect(oxfmt.isIgnoredFile('apps/foo/nested.ts')).toBe(true);
      expect(oxfmt.isIgnoredFile('apps/bar/nested.ts')).toBe(false);
    });

    it('keeps the files separate, so .prettierignore cannot re-include', () => {
      const oxfmt = createOxfmtIgnoreChecker(
        treeWith({ '.gitignore': 'a.ts\n', '.prettierignore': '!a.ts\n' })
      );

      expect(oxfmt.isIgnoredFile('a.ts')).toBe(true);
    });
  });

  it.each([
    ['git', createGitIgnoreChecker],
    ['prettier', createPrettierIgnoreChecker],
    ['oxfmt', createOxfmtIgnoreChecker],
  ])('%s always ignores the hardcoded directories', (_name, create) => {
    const checker = create(treeWith({ '.gitignore': '!node_modules\n' }));

    expect(checker.isIgnoredFile('node_modules/pkg/a.ts')).toBe(true);
    expect(checker.isIgnoredDirectory('node_modules')).toBe(true);
  });
});
