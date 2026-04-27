import { stripGlobToBaseDir } from './strip-glob-to-base-dir';

describe('stripGlobToBaseDir', () => {
  it('should return the input unchanged when there is no glob', () => {
    expect(stripGlobToBaseDir('apps/foo/dist')).toBe('apps/foo/dist');
    expect(stripGlobToBaseDir('/abs/path/dist')).toBe('/abs/path/dist');
  });

  it('should trim trailing separators when there is no glob', () => {
    expect(stripGlobToBaseDir('apps/foo/dist/')).toBe('apps/foo/dist');
    expect(stripGlobToBaseDir('apps/foo/dist///')).toBe('apps/foo/dist');
    expect(stripGlobToBaseDir('apps\\foo\\dist\\')).toBe('apps\\foo\\dist');
  });

  it('should strip the glob portion back to the last path separator', () => {
    expect(stripGlobToBaseDir('apps/foo/dist/**/*.js')).toBe('apps/foo/dist');
    expect(
      stripGlobToBaseDir(
        'apps/foo/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}'
      )
    ).toBe('apps/foo/dist');
  });

  it('should handle absolute paths with globs', () => {
    expect(
      stripGlobToBaseDir('/home/runner/work/apps/foo/dist/**/*.{js,d.ts}')
    ).toBe('/home/runner/work/apps/foo/dist');
  });

  it('should handle Windows-style separators', () => {
    expect(stripGlobToBaseDir('apps\\foo\\dist\\**\\*.js')).toBe(
      'apps\\foo\\dist'
    );
  });

  it('should strip back to the last separator before the first glob char', () => {
    // Glob char in the middle of a segment: strip that segment too.
    expect(stripGlobToBaseDir('apps/foo/dist/sub*dir/file.js')).toBe(
      'apps/foo/dist'
    );
  });

  it('should recognize the full set of glob meta characters', () => {
    expect(stripGlobToBaseDir('apps/foo/?.js')).toBe('apps/foo');
    expect(stripGlobToBaseDir('apps/foo/[abc].js')).toBe('apps/foo');
    expect(stripGlobToBaseDir('apps/foo/{a,b}.js')).toBe('apps/foo');
    expect(stripGlobToBaseDir('apps/foo/(a|b).js')).toBe('apps/foo');
  });

  it('should return an empty string when the glob has no preceding separator', () => {
    expect(stripGlobToBaseDir('**/*.js')).toBe('');
    expect(stripGlobToBaseDir('*.js')).toBe('');
  });
});
