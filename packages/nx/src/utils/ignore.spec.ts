import {
  createIgnoreChainResolver,
  isIgnoredByChain,
  posixDirname,
} from './ignore';

describe('createIgnoreChainResolver', () => {
  /** Builds a resolver over an in-memory `path -> contents` map. */
  function resolverFor(
    files: Record<string, string>,
    filenames = ['.gitignore']
  ) {
    return createIgnoreChainResolver((path) => files[path] ?? null, filenames);
  }

  function ignores(
    files: Record<string, string>,
    filePath: string,
    filenames?: string[]
  ) {
    const resolve = resolverFor(files, filenames);
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
      ['.gitignore']
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
