import { join, resolve } from 'node:path';
import type { ConfigLoaderSuccessResult } from 'tsconfig-paths';
import { loadFileFromPaths as loadFileFromPathsMain } from './nx-tsconfig-paths-load-file';

describe('@nx/vite nx-tsconfig-paths-load-file', () => {
  const extensions = ['.ts', '.tsx', '.js', '.json'];
  // `findFile` returns `resolve`d paths, which on Windows carry a drive letter
  // and backslashes. Anchor the fixtures the same way.
  const ws = resolve('/ws');
  const fs = new Set<string>([
    join(ws, 'packages/foo/angular.ts'),
    join(ws, 'packages/foo/legacy.js'),
    join(ws, 'packages/foo/react/index.ts'),
    join(ws, 'packages/baz/src/index.ts'),
    join(ws, 'packages/exact/index.ts'),
    join(ws, 'packages/exact/thing.ts'),
    join(ws, 'packages/one/src/index.ts'),
    join(ws, 'packages/weird/$&.ts'),
    join(ws, 'packages/broad/exact/thing.ts'),
    join(ws, 'packages/narrow/thing.ts'),
  ]);
  const existsSyncImpl = ((path: string) => fs.has(path)) as any;

  const loadFileFromPaths = (
    paths: Record<string, string[]>,
    importPath: string
  ) =>
    loadFileFromPathsMain(
      {
        absoluteBaseUrl: ws,
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
    ).toEqual(join(ws, 'packages/foo/angular.ts'));
  });

  it('should substitute the wildcard in the middle of the mapped path', () => {
    expect(
      loadFileFromPaths(
        { '@repo/foo/*': ['packages/foo/*/index.ts'] },
        '@repo/foo/react'
      )
    ).toEqual(join(ws, 'packages/foo/react/index.ts'));
  });

  it('should fall through to the next mapped path when the first does not exist', () => {
    expect(
      loadFileFromPaths(
        { '@repo/foo/*': ['packages/foo/*.ts', 'packages/foo/*/index.ts'] },
        '@repo/foo/react'
      )
    ).toEqual(join(ws, 'packages/foo/react/index.ts'));
  });

  it('should resolve a trailing wildcard mapped path', () => {
    expect(
      loadFileFromPaths(
        { '@repo/baz/*': ['packages/baz/src/*'] },
        '@repo/baz/index'
      )
    ).toEqual(join(ws, 'packages/baz/src/index.ts'));
  });

  it('should resolve an import with an explicit extension', () => {
    expect(
      loadFileFromPaths(
        { '@repo/baz/*': ['packages/baz/src/*'] },
        '@repo/baz/index.js'
      )
    ).toEqual(join(ws, 'packages/baz/src/index.ts'));
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
    ).toEqual(join(ws, 'packages/exact/index.ts'));
  });

  it('should append the subpath of an import matching a non-wildcard alias', () => {
    expect(
      loadFileFromPaths(
        { '@repo/exact': ['packages/exact'] },
        '@repo/exact/thing'
      )
    ).toEqual(join(ws, 'packages/exact/thing.ts'));
  });

  it('should resolve a mid-pattern wildcard pointing at a directory', () => {
    expect(
      loadFileFromPaths({ '@lib/*': ['packages/*/src'] }, '@lib/one')
    ).toEqual(join(ws, 'packages/one/src/index.ts'));
  });

  it('should resolve an import with an explicit extension for a non-wildcard alias', () => {
    expect(
      loadFileFromPaths(
        { '@repo/exact': ['packages/exact'] },
        '@repo/exact/thing.js'
      )
    ).toEqual(join(ws, 'packages/exact/thing.ts'));
  });

  it('should not expand $ substitution patterns coming from the import', () => {
    expect(
      loadFileFromPaths(
        { '@repo/weird/*': ['packages/weird/*.ts'] },
        '@repo/weird/$&'
      )
    ).toEqual(join(ws, 'packages/weird/$&.ts'));
  });

  it('should not match an alias that is only a partial prefix of the import', () => {
    expect(
      loadFileFromPaths({ '@repo/ex/*': ['packages/exact/*'] }, '@repo/exact')
    ).toBeUndefined();
  });

  it.each([
    [
      'the broader alias',
      { '@repo': ['packages/broad'], '@repo/exact': ['packages/narrow'] },
      'packages/broad/exact/thing.ts',
    ],
    [
      'the narrower alias',
      { '@repo/exact': ['packages/narrow'], '@repo': ['packages/broad'] },
      'packages/narrow/thing.ts',
    ],
  ])(
    'should keep the declaration order of non-wildcard aliases matching only a prefix, %s first',
    (_, paths, expected) => {
      expect(loadFileFromPaths(paths, '@repo/exact/thing')).toEqual(
        join(ws, expected)
      );
    }
  );

  it('should return undefined when no mapped path resolves', () => {
    expect(
      loadFileFromPaths(
        { '@repo/foo/*': ['packages/foo/*.ts'] },
        '@repo/foo/missing'
      )
    ).toBeUndefined();
  });
});
