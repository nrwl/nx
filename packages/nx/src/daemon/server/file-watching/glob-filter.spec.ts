import { fileMatchesGlobFilter, filterChangedFiles } from './glob-filter';
import type { ChangedFile } from './changed-projects';

describe('fileMatchesGlobFilter', () => {
  describe('no filters (empty include and exclude)', () => {
    it('accepts any file', () => {
      expect(fileMatchesGlobFilter('src/index.ts', [], [])).toBe(true);
      expect(fileMatchesGlobFilter('some/random/path.json', [], [])).toBe(true);
    });
  });

  describe('include only', () => {
    it('accepts files matching an include pattern', () => {
      expect(fileMatchesGlobFilter('src/app/main.ts', ['**/*.ts'], [])).toBe(
        true
      );
    });

    it('rejects files not matching any include pattern', () => {
      expect(fileMatchesGlobFilter('src/app/styles.css', ['**/*.ts'], [])).toBe(
        false
      );
    });

    it('accepts a file matching any one of multiple include patterns', () => {
      expect(
        fileMatchesGlobFilter('src/app/main.ts', ['**/*.ts', '**/*.tsx'], [])
      ).toBe(true);
    });
  });

  describe('exclude only', () => {
    it('rejects files matching an exclude pattern', () => {
      expect(
        fileMatchesGlobFilter('src/app/main.spec.ts', [], ['**/*.spec.ts'])
      ).toBe(false);
    });

    it('accepts files not matching any exclude pattern', () => {
      expect(
        fileMatchesGlobFilter('src/app/main.ts', [], ['**/*.spec.ts'])
      ).toBe(true);
    });
  });

  describe('include and exclude combined', () => {
    it('accepts a file matching include but not exclude', () => {
      expect(
        fileMatchesGlobFilter('src/app/main.ts', ['**/*.ts'], ['**/*.spec.ts'])
      ).toBe(true);
    });

    it('rejects a file matching both include and exclude (exclude wins)', () => {
      expect(
        fileMatchesGlobFilter(
          'src/app/main.spec.ts',
          ['**/*.ts'],
          ['**/*.spec.ts']
        )
      ).toBe(false);
    });

    it('rejects a file not matching include', () => {
      expect(
        fileMatchesGlobFilter(
          'src/app/styles.css',
          ['**/*.ts'],
          ['**/*.spec.ts']
        )
      ).toBe(false);
    });
  });

  describe('dot files', () => {
    it('matches dot files when the pattern uses dot:true semantics', () => {
      expect(fileMatchesGlobFilter('.env', ['**/.env'], [])).toBe(true);
    });

    it('includes dot files when no filter is set', () => {
      expect(fileMatchesGlobFilter('.gitignore', [], [])).toBe(true);
    });
  });
});

describe('filterChangedFiles', () => {
  const makeFile = (path: string): ChangedFile => ({ path, type: 'update' });

  it('returns the original array when both filters are empty', () => {
    const files = [makeFile('a.ts'), makeFile('b.ts')];
    expect(filterChangedFiles(files, [], [])).toBe(files); // same reference
  });

  it('keeps only files matching the include pattern', () => {
    const files = [makeFile('a.ts'), makeFile('b.css'), makeFile('c.ts')];
    const result = filterChangedFiles(files, ['**/*.ts'], []);
    expect(result.map((f) => f.path)).toEqual(['a.ts', 'c.ts']);
  });

  it('removes files matching the exclude pattern', () => {
    const files = [
      makeFile('a.ts'),
      makeFile('a.spec.ts'),
      makeFile('b.spec.ts'),
    ];
    const result = filterChangedFiles(files, [], ['**/*.spec.ts']);
    expect(result.map((f) => f.path)).toEqual(['a.ts']);
  });

  it('drops a project when all its files are filtered out', () => {
    // Simulate: only spec files changed → all filtered → empty result
    const files = [makeFile('src/a.spec.ts'), makeFile('src/b.spec.ts')];
    const result = filterChangedFiles(files, ['**/*.ts'], ['**/*.spec.ts']);
    expect(result).toHaveLength(0);
  });

  it('preserves the ChangedFile shape (path + type)', () => {
    const files: ChangedFile[] = [
      { path: 'src/a.ts', type: 'create' },
      { path: 'src/b.ts', type: 'delete' },
    ];
    const result = filterChangedFiles(files, ['**/*.ts'], []);
    expect(result).toEqual(files);
  });
});
