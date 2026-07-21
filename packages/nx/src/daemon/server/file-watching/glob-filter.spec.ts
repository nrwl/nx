import {
  compileGlobs,
  fileMatchesGlobFilter,
  filterChangedFiles,
  selectChangedProjectsAndFiles,
} from './glob-filter';
import type { ChangedFile } from './changed-projects';

// Convenience: the filter helpers take precompiled matchers, so tests compile
// their raw patterns up front (mirroring how the daemon compiles once at
// registration).
const globs = (patterns: string[]) => compileGlobs(patterns);

describe('fileMatchesGlobFilter', () => {
  describe('no filters (empty include and exclude)', () => {
    it('accepts any file', () => {
      expect(fileMatchesGlobFilter('src/index.ts', [], [])).toBe(true);
      expect(fileMatchesGlobFilter('some/random/path.json', [], [])).toBe(true);
    });
  });

  describe('include only', () => {
    it('accepts files matching an include pattern', () => {
      expect(
        fileMatchesGlobFilter('src/app/main.ts', globs(['**/*.ts']), [])
      ).toBe(true);
    });

    it('rejects files not matching any include pattern', () => {
      expect(
        fileMatchesGlobFilter('src/app/styles.css', globs(['**/*.ts']), [])
      ).toBe(false);
    });

    it('accepts a file matching any one of multiple include patterns', () => {
      expect(
        fileMatchesGlobFilter(
          'src/app/main.ts',
          globs(['**/*.ts', '**/*.tsx']),
          []
        )
      ).toBe(true);
    });

    it('supports brace-expansion globs (passed through intact)', () => {
      const matchers = globs(['**/*.{ts,tsx}']);
      expect(fileMatchesGlobFilter('src/app/main.tsx', matchers, [])).toBe(
        true
      );
      expect(fileMatchesGlobFilter('src/app/main.ts', matchers, [])).toBe(true);
      expect(fileMatchesGlobFilter('src/app/main.css', matchers, [])).toBe(
        false
      );
    });
  });

  describe('exclude only', () => {
    it('rejects files matching an exclude pattern', () => {
      expect(
        fileMatchesGlobFilter(
          'src/app/main.spec.ts',
          [],
          globs(['**/*.spec.ts'])
        )
      ).toBe(false);
    });

    it('accepts files not matching any exclude pattern', () => {
      expect(
        fileMatchesGlobFilter('src/app/main.ts', [], globs(['**/*.spec.ts']))
      ).toBe(true);
    });
  });

  describe('include and exclude combined', () => {
    it('accepts a file matching include but not exclude', () => {
      expect(
        fileMatchesGlobFilter(
          'src/app/main.ts',
          globs(['**/*.ts']),
          globs(['**/*.spec.ts'])
        )
      ).toBe(true);
    });

    it('rejects a file matching both include and exclude (exclude wins)', () => {
      expect(
        fileMatchesGlobFilter(
          'src/app/main.spec.ts',
          globs(['**/*.ts']),
          globs(['**/*.spec.ts'])
        )
      ).toBe(false);
    });

    it('rejects a file not matching include', () => {
      expect(
        fileMatchesGlobFilter(
          'src/app/styles.css',
          globs(['**/*.ts']),
          globs(['**/*.spec.ts'])
        )
      ).toBe(false);
    });
  });

  describe('dot files', () => {
    it('traverses a dot-prefixed directory (load-bearing: needs dot:true)', () => {
      // `**/*.ts` only reaches a file inside `.config/` because compileGlobs
      // uses `dot: true`. Removing `dot: true` makes this assertion fail, which
      // is what makes it a real guard for the option (unlike a pattern with a
      // literal leading dot, which matches either way).
      expect(
        fileMatchesGlobFilter('.config/settings.ts', globs(['**/*.ts']), [])
      ).toBe(true);
    });

    it('includes dot files when no filter is set', () => {
      expect(fileMatchesGlobFilter('.gitignore', [], [])).toBe(true);
    });
  });
});

describe('filterChangedFiles', () => {
  const makeFile = (path: string): ChangedFile => ({ path, type: 'update' });

  it('returns the original array by reference when both filters are empty', () => {
    const files = [makeFile('a.ts'), makeFile('b.ts')];
    expect(filterChangedFiles(files, [], [])).toBe(files); // same reference
  });

  it('keeps only files matching the include pattern', () => {
    const files = [makeFile('a.ts'), makeFile('b.css'), makeFile('c.ts')];
    const result = filterChangedFiles(files, globs(['**/*.ts']), []);
    expect(result.map((f) => f.path)).toEqual(['a.ts', 'c.ts']);
  });

  it('removes files matching the exclude pattern', () => {
    const files = [
      makeFile('a.ts'),
      makeFile('a.spec.ts'),
      makeFile('b.spec.ts'),
    ];
    const result = filterChangedFiles(files, [], globs(['**/*.spec.ts']));
    expect(result.map((f) => f.path)).toEqual(['a.ts']);
  });

  it('drops all files when every one is filtered out', () => {
    const files = [makeFile('src/a.spec.ts'), makeFile('src/b.spec.ts')];
    const result = filterChangedFiles(
      files,
      globs(['**/*.ts']),
      globs(['**/*.spec.ts'])
    );
    expect(result).toHaveLength(0);
  });

  it('preserves the ChangedFile shape (path + type)', () => {
    const files: ChangedFile[] = [
      { path: 'src/a.ts', type: 'create' },
      { path: 'src/b.ts', type: 'delete' },
    ];
    const result = filterChangedFiles(files, globs(['**/*.ts']), []);
    expect(result).toEqual(files);
  });
});

describe('selectChangedProjectsAndFiles (project-drop gate)', () => {
  const makeFile = (path: string): ChangedFile => ({ path, type: 'update' });

  it('drops a project when all of its changed files are filtered out', () => {
    // proj-a only changed spec files (all excluded) → the whole project is
    // dropped. proj-b has a surviving file → it is kept.
    const projects = {
      'proj-a': [makeFile('proj-a/x.spec.ts'), makeFile('proj-a/y.spec.ts')],
      'proj-b': [makeFile('proj-b/z.ts')],
    };

    const { changedProjects, changedFiles, consideredFileCount } =
      selectChangedProjectsAndFiles(
        projects,
        globs(['**/*.ts']),
        globs(['**/*.spec.ts'])
      );

    expect(changedProjects).toEqual(['proj-b']);
    expect(changedFiles.map((f) => f.path)).toEqual(['proj-b/z.ts']);
    // Both projects' files were considered before filtering.
    expect(consideredFileCount).toBe(3);
  });

  it('keeps every project when there are no filters', () => {
    const projects = {
      'proj-a': [makeFile('proj-a/x.ts')],
      'proj-b': [makeFile('proj-b/y.css')],
    };

    const { changedProjects, changedFiles, consideredFileCount } =
      selectChangedProjectsAndFiles(projects, [], []);

    expect(changedProjects).toEqual(['proj-a', 'proj-b']);
    expect(changedFiles.map((f) => f.path)).toEqual([
      'proj-a/x.ts',
      'proj-b/y.css',
    ]);
    expect(consideredFileCount).toBe(2);
  });

  it('drops every project when the filter excludes all files', () => {
    const projects = {
      'proj-a': [makeFile('proj-a/x.spec.ts')],
      'proj-b': [makeFile('proj-b/y.spec.ts')],
    };

    const { changedProjects, changedFiles, consideredFileCount } =
      selectChangedProjectsAndFiles(projects, [], globs(['**/*.spec.ts']));

    expect(changedProjects).toEqual([]);
    expect(changedFiles).toEqual([]);
    // Nothing survived, but two files were considered — the caller uses this to
    // tell "entire batch filtered out" apart from "nothing changed".
    expect(consideredFileCount).toBe(2);
  });
});
