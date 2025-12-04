import { extractGlobLiteralPrefix } from './nx-copy-assets.plugin';

describe('extractGlobLiteralPrefix', () => {
  it('should extract literal directory prefix from path without globs', () => {
    expect(extractGlobLiteralPrefix('libs/mylib/README.md')).toEqual({
      prefix: 'libs/mylib',
      glob: 'README.md',
    });
  });

  it('should return "." prefix for filename-only patterns', () => {
    expect(extractGlobLiteralPrefix('README.md')).toEqual({
      prefix: '.',
      glob: 'README.md',
    });
  });

  it('should return "." prefix when glob starts with wildcard', () => {
    expect(extractGlobLiteralPrefix('**/*.md')).toEqual({
      prefix: '.',
      glob: '**/*.md',
    });

    expect(extractGlobLiteralPrefix('*.md')).toEqual({
      prefix: '.',
      glob: '*.md',
    });
  });

  it('should split at glob boundary', () => {
    expect(extractGlobLiteralPrefix('docs/*.md')).toEqual({
      prefix: 'docs',
      glob: '*.md',
    });

    expect(extractGlobLiteralPrefix('libs/mylib/src/assets/**/*.png')).toEqual({
      prefix: 'libs/mylib/src/assets',
      glob: '**/*.png',
    });
  });

  it('should handle other glob characters', () => {
    expect(extractGlobLiteralPrefix('libs/[abc]/file.ts')).toEqual({
      prefix: 'libs',
      glob: '[abc]/file.ts',
    });

    expect(extractGlobLiteralPrefix('libs/{a,b}/file.ts')).toEqual({
      prefix: 'libs',
      glob: '{a,b}/file.ts',
    });

    expect(extractGlobLiteralPrefix('libs/file?.ts')).toEqual({
      prefix: 'libs',
      glob: 'file?.ts',
    });
  });
});
