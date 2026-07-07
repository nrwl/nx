import type { LoaderContext } from '@rspack/core';
import type { TransformedSource } from '@nx/angular-rspack-compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NG_RSPACK_SYMBOL_NAME, type NgRspackCompilation } from '../../models';
import { default as angularTransformLoader } from './angular-transform.loader';

class StyleUrlsResolverMock {
  constructor(private cb: (content: string) => string) {}

  resolve(content: string, _: string): string[] {
    return [this.cb(content)];
  }
}

class TemplateUrlsResolverMock {
  constructor(private cb: (content: string) => string) {}

  resolve(content: string, _: string): string[] {
    return [this.cb(content)];
  }
}

describe('angular-transform.loader', () => {
  const callback = vi.fn();
  const addDependency = vi.fn();
  const typescriptFileCache = new Map<string, string | TransformedSource>();
  const javascriptTransformer = {
    transformData: vi.fn(),
  };
  const _compilation = {
    [NG_RSPACK_SYMBOL_NAME]: () => ({
      typescriptFileCache,
      javascriptTransformer,
    }),
  } as unknown as NgRspackCompilation;
  const thisValue = {
    async: vi.fn(() => callback),
    _compilation: {},
  } as unknown as LoaderContext<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    typescriptFileCache.clear();
  });

  it('should return content when NG_RSPACK_SYMBOL_NAME is undefined', () => {
    angularTransformLoader.call(thisValue, 'content');
    expect(callback).toHaveBeenCalledWith(null, 'content');
  });

  it('should add dependencies for resolved template and style URLs', () => {
    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation,
        resourcePath: '/home/projects/analog/src/app/app.component.ts',
        addDependency,
      },
      '@Component()',
      {
        templateUrlsResolver: new TemplateUrlsResolverMock(
          () =>
            './app.component.html|/home/projects/analog/src/app/app.component.html'
        ),
        styleUrlsResolver: new StyleUrlsResolverMock(
          () =>
            './app.component.css|/home/projects/analog/src/app/app.component.css'
        ),
      } as any
    );

    expect(addDependency).toHaveBeenCalledTimes(2);
    expect(addDependency).toHaveBeenNthCalledWith(
      1,
      '/home/projects/analog/src/app/app.component.html'
    );
    expect(addDependency).toHaveBeenNthCalledWith(
      2,
      '/home/projects/analog/src/app/app.component.css'
    );
  });

  it('should emit an empty module when the angular compilation failed', () => {
    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation: {
          [NG_RSPACK_SYMBOL_NAME]: () => ({
            typescriptFileCache,
            angularCompilationFailed: true,
          }),
        } as unknown as NgRspackCompilation,
        resourcePath: '/path/to/file.ts',
      },
      'content'
    );

    expect(callback).toHaveBeenCalledWith(null, '');
  });

  it('should return content when typescriptFileCache does not contain normalizedRequest', () => {
    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation,
        resourcePath: '/path/to/file.ts',
      },
      'content'
    );

    expect(callback).toHaveBeenCalledWith(null, 'content');
  });

  it('should serve a transformed entry without re-transforming', () => {
    typescriptFileCache.set('/home/projects/analog/src/app/app.component.ts', {
      code: 'transformed content',
      map: undefined,
    });

    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation,
        resourcePath: '/home/projects/analog/src/app/app.component.ts',
      },
      '@Component()'
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      'transformed content',
      undefined
    );
    expect(javascriptTransformer.transformData).not.toHaveBeenCalled();
  });

  it('should transform the raw emit on demand and cache the result', async () => {
    typescriptFileCache.set('/path/to/lazy.ts', 'raw emit');
    javascriptTransformer.transformData.mockResolvedValue(
      Buffer.from('transformed content')
    );

    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation,
        resourcePath: '/path/to/lazy.ts',
      },
      'content'
    );
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(javascriptTransformer.transformData).toHaveBeenCalledWith(
      '/path/to/lazy.ts',
      'raw emit',
      true,
      false
    );
    expect(callback).toHaveBeenCalledWith(null, 'transformed content');
    expect(typescriptFileCache.get('/path/to/lazy.ts')).toEqual({
      code: 'transformed content',
      map: undefined,
    });
  });

  it('should not overwrite a newer emit stored while transforming', async () => {
    typescriptFileCache.set('/path/to/racy.ts', 'raw emit');
    let resolveTransform: (value: Uint8Array) => void;
    javascriptTransformer.transformData.mockReturnValue(
      new Promise((resolve) => {
        resolveTransform = resolve;
      })
    );

    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation,
        resourcePath: '/path/to/racy.ts',
      },
      'content'
    );
    // A rebuild emits fresh content while the transform is in flight.
    typescriptFileCache.set('/path/to/racy.ts', 'newer raw emit');
    resolveTransform!(Buffer.from('stale transformed'));
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(callback).toHaveBeenCalledWith(null, 'stale transformed');
    expect(typescriptFileCache.get('/path/to/racy.ts')).toBe('newer raw emit');
  });

  it('should forward transformation errors to the loader callback', async () => {
    typescriptFileCache.set('/path/to/broken.ts', 'raw emit');
    const error = new Error('transform failed');
    javascriptTransformer.transformData.mockRejectedValue(error);

    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation,
        resourcePath: '/path/to/broken.ts',
      },
      'content'
    );
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(callback).toHaveBeenCalledWith(error);
    expect(typescriptFileCache.get('/path/to/broken.ts')).toBe('raw emit');
  });
});
