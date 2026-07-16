import type { LoaderContext } from '@rspack/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NG_RSPACK_SYMBOL_NAME, type NgRspackCompilation } from '../../models';
import { default as angularPartialTransformLoader } from './angular-partial-transform.loader';

describe('angular-partial-transform.loader', () => {
  const callback = vi.fn();
  const typescriptFileCache = new Map<string, string | Uint8Array>();
  const transformFile = vi.fn();
  const makeCompilation = (angularCompilationFailed = false) =>
    ({
      [NG_RSPACK_SYMBOL_NAME]: () => ({
        javascriptTransformer: { transformFile },
        typescriptFileCache,
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
      expect(callback).toHaveBeenCalledWith(null, 'transformed', undefined)
    );
    expect(typescriptFileCache.get('/path/to/file.js')).toBe('transformed');
  });

  it('should extract an inline sourcemap from the transformed output', async () => {
    const map = {
      version: 3,
      sources: ['file.js'],
      sourcesContent: ['@angular content'],
      mappings: 'AAAA',
      names: [],
    };
    const inlineMap = Buffer.from(JSON.stringify(map)).toString('base64');
    // Built via concatenation so the test transform doesn't treat the literal
    // token in this source file as a real sourcemap reference.
    const comment =
      `//# source` +
      `MappingURL=data:application/json;charset=utf-8;base64,${inlineMap}`;
    const transformed = `transformed\n${comment}\n`;
    transformFile.mockResolvedValue(Buffer.from(transformed));

    angularPartialTransformLoader.call(
      {
        ...thisValue,
        _compilation: makeCompilation(),
        resourcePath: '/path/to/file.js',
      },
      '@angular content'
    );

    await vi.waitFor(() =>
      expect(callback).toHaveBeenCalledWith(null, 'transformed', map)
    );
    // The full transformed output (including the inline map) stays cached so
    // subsequent reads re-extract the same map.
    expect(typescriptFileCache.get('/path/to/file.js')).toBe(transformed);
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
