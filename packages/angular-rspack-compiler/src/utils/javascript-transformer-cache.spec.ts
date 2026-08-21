import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createJavascriptTransformerCache } from './javascript-transformer-cache';

const { requireMock } = vi.hoisted(() => {
  const requireMock = Object.assign(vi.fn(), { resolve: vi.fn() });
  return { requireMock };
});

vi.mock('node:module', () => ({
  createRequire: () => requireMock,
}));

describe('createJavascriptTransformerCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a namespaced cache backed by a store in the cache directory', async () => {
    const cache = { get: vi.fn(), put: vi.fn() };
    const createCache = vi.fn().mockReturnValue(cache);
    const close = vi.fn().mockResolvedValue(undefined);
    const storeCtor = vi.fn();
    requireMock.resolve.mockReturnValue(
      join('/root/node_modules/@angular/build', 'package.json')
    );
    requireMock.mockReturnValue({
      LmdbCacheStore: class {
        createCache = createCache;
        close = close;
        constructor(cachePath: string) {
          storeCtor(cachePath);
        }
      },
    });

    const result = createJavascriptTransformerCache('/root/.angular/cache');

    expect(requireMock.resolve).toHaveBeenCalledWith(
      '@angular/build/package.json'
    );
    expect(requireMock).toHaveBeenCalledWith(
      join(
        '/root/node_modules/@angular/build',
        'src/tools/esbuild/lmdb-cache-store.js'
      )
    );
    expect(storeCtor).toHaveBeenCalledWith(
      join('/root/.angular/cache', 'angular-compiler.db')
    );
    expect(createCache).toHaveBeenCalledWith('jstransformer');
    expect(result?.cache).toBe(cache);

    await result?.close();
    expect(close).toHaveBeenCalled();
  });

  it('should return undefined when the store cannot be loaded', () => {
    requireMock.resolve.mockReturnValue(
      join('/root/node_modules/@angular/build', 'package.json')
    );
    requireMock.mockImplementation(() => {
      throw new Error('platform not supported');
    });

    expect(
      createJavascriptTransformerCache('/root/.angular/cache')
    ).toBeUndefined();
  });
});
