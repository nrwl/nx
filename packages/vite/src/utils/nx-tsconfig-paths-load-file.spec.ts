import type { ConfigLoaderSuccessResult } from 'tsconfig-paths';
import { loadFileFromPaths as loadFileFromPathsMain } from './nx-tsconfig-paths-load-file';

describe('@nx/vite nx-tsconfig-paths-load-file', () => {
  const extensions = ['.ts', '.tsx', '.js', '.json'];
  const fs = new Set<string>([
    '/ws/packages/foo/angular.ts',
    '/ws/packages/foo/legacy.js',
    '/ws/packages/foo/react/index.ts',
    '/ws/packages/baz/src/index.ts',
    '/ws/packages/exact/index.ts',
    '/ws/packages/exact/thing.ts',
    '/ws/packages/one/src/index.ts',
    '/ws/packages/weird/$&.ts',
  ]);
  const existsSyncImpl = ((path: string) => fs.has(path)) as any;

  const loadFileFromPaths = (
    paths: Record<string, string[]>,
    importPath: string
  ) =>
    loadFileFromPathsMain(
      {
        absoluteBaseUrl: '/ws',
        paths,
      } as ConfigLoaderSuccessResult,
      importPath,
      extensions,
      existsSyncImpl
    );

  it('should substitute the wildcard when it is followed by an extension', () => {
    expect(
      loadFileFromPaths(
        { '@repo/foo/*': ['packages/foo/*.ts'] },
        '@repo/foo/angular'
      )
    ).toEqual('/ws/packages/foo/angular.ts');
  });

  it('should substitute the wildcard in the middle of the mapped path', () => {
    expect(
      loadFileFromPaths(
        { '@repo/foo/*': ['packages/foo/*/index.ts'] },
        '@repo/foo/react'
      )
    ).toEqual('/ws/packages/foo/react/index.ts');
  });

  it('should fall through to the next mapped path when the first does not exist', () => {
    expect(
      loadFileFromPaths(
        { '@repo/foo/*': ['packages/foo/*.ts', 'packages/foo/*/index.ts'] },
        '@repo/foo/react'
      )
    ).toEqual('/ws/packages/foo/react/index.ts');
  });

  it('should resolve a trailing wildcard mapped path', () => {
    expect(
      loadFileFromPaths(
        { '@repo/baz/*': ['packages/baz/src/*'] },
        '@repo/baz/index'
      )
    ).toEqual('/ws/packages/baz/src/index.ts');
  });

  it('should resolve an import with an explicit extension', () => {
    expect(
      loadFileFromPaths(
        { '@repo/baz/*': ['packages/baz/src/*'] },
        '@repo/baz/index.js'
      )
    ).toEqual('/ws/packages/baz/src/index.ts');
  });

  it('should not resolve a sibling when the mapped path appends a different extension', () => {
    expect(
      loadFileFromPaths(
        { '@repo/foo/*': ['packages/foo/*.ts'] },
        '@repo/foo/legacy.js'
      )
    ).toBeUndefined();
  });

  it('should not resolve a sibling when the mapped path appends the import extension', () => {
    expect(
      loadFileFromPaths(
        { '@repo/foo/*': ['packages/foo/*.js'] },
        '@repo/foo/legacy.js'
      )
    ).toBeUndefined();
  });

  it('should not resolve the mapped file when the import repeats the appended extension', () => {
    expect(
      loadFileFromPaths(
        { '@repo/foo/*': ['packages/foo/*.ts'] },
        '@repo/foo/angular.ts'
      )
    ).toBeUndefined();
  });

  it('should resolve a non-wildcard alias', () => {
    expect(
      loadFileFromPaths({ '@repo/exact': ['packages/exact'] }, '@repo/exact')
    ).toEqual('/ws/packages/exact/index.ts');
  });

  it('should append the subpath of an import matching a non-wildcard alias', () => {
    expect(
      loadFileFromPaths(
        { '@repo/exact': ['packages/exact'] },
        '@repo/exact/thing'
      )
    ).toEqual('/ws/packages/exact/thing.ts');
  });

  it('should resolve a mid-pattern wildcard pointing at a directory', () => {
    expect(
      loadFileFromPaths({ '@lib/*': ['packages/*/src'] }, '@lib/one')
    ).toEqual('/ws/packages/one/src/index.ts');
  });

  it('should resolve an import with an explicit extension for a non-wildcard alias', () => {
    expect(
      loadFileFromPaths(
        { '@repo/exact': ['packages/exact'] },
        '@repo/exact/thing.js'
      )
    ).toEqual('/ws/packages/exact/thing.ts');
  });

  it('should not expand $ substitution patterns coming from the import', () => {
    expect(
      loadFileFromPaths(
        { '@repo/weird/*': ['packages/weird/*.ts'] },
        '@repo/weird/$&'
      )
    ).toEqual('/ws/packages/weird/$&.ts');
  });

  it('should not match an alias that is only a partial prefix of the import', () => {
    expect(
      loadFileFromPaths({ '@repo/ex/*': ['packages/exact/*'] }, '@repo/exact')
    ).toBeUndefined();
  });

  it('should return undefined when no mapped path resolves', () => {
    expect(
      loadFileFromPaths(
        { '@repo/foo/*': ['packages/foo/*.ts'] },
        '@repo/foo/missing'
      )
    ).toBeUndefined();
  });
});
