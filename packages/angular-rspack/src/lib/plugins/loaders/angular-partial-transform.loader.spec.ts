import type { LoaderContext } from '@rspack/core';
import type { TransformedSource } from '@nx/angular-rspack-compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NG_RSPACK_SYMBOL_NAME, type NgRspackCompilation } from '../../models';
import { default as angularPartialTransformLoader } from './angular-partial-transform.loader';

describe('angular-partial-transform.loader', () => {
  const callback = vi.fn();
  const typescriptFileCache = new Map<string, string | TransformedSource>();
  const babelFileCache = new Map<string, string>();
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

  beforeEach(() => {
    vi.clearAllMocks();
    typescriptFileCache.clear();
    babelFileCache.clear();
  });

  it('should return content when NG_RSPACK_SYMBOL_NAME is undefined', () => {
    angularPartialTransformLoader.call(thisValue, '@angular content');

    expect(callback).toHaveBeenCalledWith(null, '@angular content');
  });

  it('should pass content through when the angular compilation failed', () => {
    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(true),
        resourcePath: '/path/to/file.js',
      },
      '@angular content'
    );

    expect(callback).toHaveBeenCalledWith(null, '@angular content');
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
      expect(callback).toHaveBeenCalledWith(null, 'transformed')
    );
    expect(babelFileCache.get('/path/to/file.js')).toBe('transformed');
    expect(typescriptFileCache.has('/path/to/file.js')).toBe(false);
  });

  it('should serve a previously transformed file without re-transforming', () => {
    babelFileCache.set('/path/to/file.js', 'transformed');

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content'
    );

    expect(callback).toHaveBeenCalledWith(null, 'transformed');
    expect(transformFile).not.toHaveBeenCalled();
    expect(transformData).not.toHaveBeenCalled();
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

    expect(callback).toHaveBeenCalledWith(null, '@angular content');
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

    expect(callback).toHaveBeenCalledWith(null, 'plain js content');
    expect(transformFile).not.toHaveBeenCalled();
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
