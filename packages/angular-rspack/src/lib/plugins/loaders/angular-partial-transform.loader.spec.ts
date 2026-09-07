import type { LoaderContext, RawSourceMap } from '@rspack/core';
import type {
  BabelFileCacheEntry,
  TransformedSource,
} from '@nx/angular-rspack-compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NG_RSPACK_SYMBOL_NAME, type NgRspackCompilation } from '../../models';
import { default as angularPartialTransformLoader } from './angular-partial-transform.loader';

const { readFileMock } = vi.hoisted(() => ({ readFileMock: vi.fn() }));
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: readFileMock,
}));

describe('angular-partial-transform.loader', () => {
  const callback = vi.fn();
  const typescriptFileCache = new Map<string, string | TransformedSource>();
  const babelFileCache = new Map<string, BabelFileCacheEntry>();
  const transformFile = vi.fn();
  const transformData = vi.fn();
  const makeCompilation = (angularCompilationFailed = false) =>
    ({
      [NG_RSPACK_SYMBOL_NAME]: () => ({
        javascriptTransformer: { transformFile, transformData },
        typescriptFileCache,
        babelFileCache,
        angularCompilationFailed,
      }),
    }) as unknown as NgRspackCompilation;
  const thisValue = {
    async: vi.fn(() => callback),
    _compilation: {},
  } as unknown as LoaderContext<unknown>;
  const chainMap = {
    version: 3,
    sources: ['/path/to/file-original.ts'],
    sourcesContent: ['original source'],
    names: [],
    mappings: 'AAAA',
  } as RawSourceMap;
  // Built via concatenation so tools scanning this file for sourcemap
  // comments do not mistake the literal for a real one.
  const inlineComment = (map: object) =>
    `//# sourceMapping` +
    `URL=data:application/json;charset=utf-8;base64,${Buffer.from(
      JSON.stringify(map)
    ).toString('base64')}`;

  beforeEach(() => {
    vi.clearAllMocks();
    typescriptFileCache.clear();
    babelFileCache.clear();
  });

  it('should return content when NG_RSPACK_SYMBOL_NAME is undefined', () => {
    angularPartialTransformLoader.call(thisValue, '@angular content');

    expect(callback).toHaveBeenCalledWith(null, '@angular content', undefined);
  });

  it('should forward the chained sourcemap when NG_RSPACK_SYMBOL_NAME is undefined', () => {
    angularPartialTransformLoader.call(thisValue, '@angular content', chainMap);

    expect(callback).toHaveBeenCalledWith(null, '@angular content', chainMap);
  });

  it('should pass content through when the angular compilation failed', () => {
    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(true),
        resourcePath: '/path/to/file.js',
      },
      '@angular content',
      chainMap
    );

    expect(callback).toHaveBeenCalledWith(null, '@angular content', chainMap);
    expect(transformFile).not.toHaveBeenCalled();
  });

  it('should transform the file and cache the result', async () => {
    transformFile.mockResolvedValue(Buffer.from('transformed'));

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content'
    );

    await vi.waitFor(() =>
      expect(callback).toHaveBeenCalledWith(null, 'transformed', undefined)
    );
    expect(babelFileCache.get('/path/to/file.js')).toEqual({
      code: 'transformed',
      map: undefined,
      chainedMap: undefined,
    });
    expect(typescriptFileCache.has('/path/to/file.js')).toBe(false);
  });

  it('should extract the inline sourcemap from the transformed file', async () => {
    const map = { version: 3, sources: ['file.js'], mappings: 'AAAA' };
    transformFile.mockResolvedValue(
      Buffer.from(`transformed\n${inlineComment(map)}\n`)
    );

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content'
    );

    await vi.waitFor(() =>
      expect(callback).toHaveBeenCalledWith(
        null,
        'transformed',
        JSON.stringify(map)
      )
    );
    expect(babelFileCache.get('/path/to/file.js')).toEqual({
      code: 'transformed',
      map: JSON.stringify(map),
      chainedMap: undefined,
    });
  });

  it('should chain the loader sourcemap when the transformer passed through an external map reference', async () => {
    // A file needing no transformation is passed through with its original
    // comment; source-map-loader has already read the referenced map file.
    transformFile.mockResolvedValue(
      Buffer.from('untouched\n//# sourceMapping' + 'URL=file.js.map\n')
    );

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content',
      chainMap
    );

    await vi.waitFor(() =>
      expect(callback).toHaveBeenCalledWith(
        null,
        'untouched',
        JSON.stringify(chainMap)
      )
    );
    expect(babelFileCache.get('/path/to/file.js')).toEqual({
      code: 'untouched',
      map: JSON.stringify(chainMap),
      chainedMap: JSON.stringify(chainMap),
    });
  });

  it('should chain the loader sourcemap when the transformer passed through a block-form external map reference', async () => {
    transformFile.mockResolvedValue(
      Buffer.from('untouched\n/*# sourceMapping' + 'URL=file.js.map */\n')
    );

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content',
      chainMap
    );

    await vi.waitFor(() =>
      expect(callback).toHaveBeenCalledWith(
        null,
        'untouched',
        JSON.stringify(chainMap)
      )
    );
  });

  it('should not forward the loader sourcemap when the transformed file carries no sourcemap comment', async () => {
    // The transformer strips all sourcemap comments when sourcemaps are off
    // for the file; the chained map describes pre-transform content, so
    // forwarding it would attach a mismatched map.
    transformFile.mockResolvedValue(Buffer.from('transformed'));

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content',
      chainMap
    );

    await vi.waitFor(() =>
      expect(callback).toHaveBeenCalledWith(null, 'transformed', undefined)
    );
    expect(babelFileCache.get('/path/to/file.js')).toEqual({
      code: 'transformed',
      map: undefined,
      chainedMap: JSON.stringify(chainMap),
    });
  });

  it('should serve a previously transformed file without re-transforming', () => {
    babelFileCache.set('/path/to/file.js', {
      code: 'transformed',
      map: '{"mappings":"AAAA"}',
      chainedMap: undefined,
    });

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content'
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      'transformed',
      '{"mappings":"AAAA"}'
    );
    expect(transformFile).not.toHaveBeenCalled();
    expect(transformData).not.toHaveBeenCalled();
  });

  it('should serve a cached transform when the chained sourcemap is unchanged', () => {
    babelFileCache.set('/path/to/file.js', {
      code: 'transformed',
      map: JSON.stringify(chainMap),
      chainedMap: JSON.stringify(chainMap),
    });

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content',
      chainMap
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      'transformed',
      JSON.stringify(chainMap)
    );
    expect(transformFile).not.toHaveBeenCalled();
  });

  it('should bypass the transformer caches and re-transform when the chained sourcemap changed', async () => {
    // The transformer merges a file's external map file into its output and
    // its persistent cache is keyed on the file bytes alone, so a
    // watch-mode change to that map (its own loader dependency) must
    // re-transform the current file data directly.
    const staleChainMap = {
      ...chainMap,
      sourcesContent: ['stale original source'],
    } as RawSourceMap;
    babelFileCache.set('/path/to/file.js', {
      code: 'untouched',
      map: JSON.stringify(staleChainMap),
      chainedMap: JSON.stringify(staleChainMap),
    });
    readFileMock.mockResolvedValue('raw file data');
    transformData.mockResolvedValue(
      Buffer.from('untouched\n//# sourceMapping' + 'URL=file.js.map\n')
    );

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content',
      chainMap
    );

    await vi.waitFor(() =>
      expect(callback).toHaveBeenCalledWith(
        null,
        'untouched',
        JSON.stringify(chainMap)
      )
    );
    expect(readFileMock).toHaveBeenCalledWith('/path/to/file.js', 'utf8');
    expect(transformData).toHaveBeenCalledWith(
      '/path/to/file.js',
      'raw file data',
      false,
      false
    );
    expect(transformFile).not.toHaveBeenCalled();
    expect(babelFileCache.get('/path/to/file.js')).toEqual({
      code: 'untouched',
      map: JSON.stringify(chainMap),
      chainedMap: JSON.stringify(chainMap),
    });
  });

  it('should fail the module when reading the file for a bypassed transform rejects', async () => {
    const error = new Error('read failed');
    babelFileCache.set('/path/to/file.js', {
      code: 'untouched',
      map: undefined,
      chainedMap: undefined,
    });
    readFileMock.mockRejectedValue(error);

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content',
      chainMap
    );

    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(error));
    expect(transformData).not.toHaveBeenCalled();
    expect(transformFile).not.toHaveBeenCalled();
  });

  it('should serve a transformed emit entry without re-transforming', () => {
    typescriptFileCache.set('/path/to/file.js', {
      code: 'transformed',
      map: undefined,
    });

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content'
    );

    expect(callback).toHaveBeenCalledWith(null, 'transformed', undefined);
    expect(transformFile).not.toHaveBeenCalled();
    expect(transformData).not.toHaveBeenCalled();
  });

  it('should transform a raw emit from the cache even without @angular content', async () => {
    typescriptFileCache.set('/path/to/util.js', 'raw emitted js');
    transformData.mockResolvedValue(Buffer.from('transformed emit'));

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/util.js',
      },
      'plain js content'
    );

    await vi.waitFor(() =>
      expect(callback).toHaveBeenCalledWith(null, 'transformed emit', undefined)
    );
    expect(transformData).toHaveBeenCalledWith(
      '/path/to/util.js',
      'raw emitted js',
      true,
      false
    );
    expect(transformFile).not.toHaveBeenCalled();
    expect(typescriptFileCache.get('/path/to/util.js')).toEqual({
      code: 'transformed emit',
      map: undefined,
    });
  });

  it('should pass through the module federation runtime data URI', () => {
    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath:
          'data:text/javascript;charset=utf-8,__module_federation_bundler_runtime__',
      },
      '@angular content'
    );

    expect(callback).toHaveBeenCalledWith(null, '@angular content', undefined);
    expect(transformFile).not.toHaveBeenCalled();
    expect(transformData).not.toHaveBeenCalled();
  });

  it('should not overwrite a newer emit stored while transforming', async () => {
    typescriptFileCache.set('/path/to/racy.js', 'raw emit');
    let resolveTransform: (value: Uint8Array) => void;
    transformData.mockReturnValue(
      new Promise((resolve) => {
        resolveTransform = resolve;
      })
    );

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/racy.js',
      },
      'plain js content'
    );
    // A rebuild emits fresh content while the transform is in flight.
    typescriptFileCache.set('/path/to/racy.js', 'newer raw emit');
    resolveTransform!(Buffer.from('stale transformed'));
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(callback).toHaveBeenCalledWith(null, 'stale transformed', undefined);
    expect(typescriptFileCache.get('/path/to/racy.js')).toBe('newer raw emit');
  });

  it('should pass through files without @angular content and no cache entry', () => {
    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/plain.js',
      },
      'plain js content'
    );

    expect(callback).toHaveBeenCalledWith(null, 'plain js content', undefined);
    expect(transformFile).not.toHaveBeenCalled();
  });

  it('should forward the chained sourcemap for files it passes through', () => {
    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/plain.js',
      },
      'plain js content',
      chainMap
    );

    expect(callback).toHaveBeenCalledWith(null, 'plain js content', chainMap);
  });

  it('should drop a chained sourcemap that rspack would reject', () => {
    // A package can ship a parseable sourcemap with wrongly typed fields;
    // rspack fails the module build when one is forwarded.
    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/plain.js',
      },
      'plain js content',
      { version: 3, sources: [42], mappings: 'AAAA' } as unknown as RawSourceMap
    );

    expect(callback).toHaveBeenCalledWith(null, 'plain js content', undefined);
  });

  it('should fail the module when the transform rejects', async () => {
    const error = new Error('worker crashed');
    transformFile.mockRejectedValue(error);

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content'
    );

    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(error));
  });
});
