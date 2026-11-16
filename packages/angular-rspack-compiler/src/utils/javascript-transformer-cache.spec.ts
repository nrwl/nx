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

  it.each([
    'src/utils/cache/lmdb-cache-store.js',
    'src/tools/esbuild/lmdb-cache-store.js',
  ])(
    'should create a namespaced cache backed by the store at %s',
    async (storePath) => {
      const cache = { get: vi.fn(), put: vi.fn() };
      const createCache = vi.fn().mockReturnValue(cache);
      const close = vi.fn().mockResolvedValue(undefined);
      const storeCtor = vi.fn();
      requireMock.resolve.mockReturnValue(
        join('/root/node_modules/@angular/build', 'package.json')
      );
      const storeModulePath = join(
        '/root/node_modules/@angular/build',
        storePath
      );
      requireMock.mockImplementation((path: string) => {
        if (path !== storeModulePath) {
          throw new Error(`Cannot find module '${path}'`);
        }
        return {
          LmdbCacheStore: class {
            createCache = createCache;
            close = close;
            constructor(cachePath: string) {
              storeCtor(cachePath);
            }
          },
        };
      });

      const result = createJavascriptTransformerCache('/root/.angular/cache');

      expect(requireMock.resolve).toHaveBeenCalledWith(
        '@angular/build/package.json'
      );
      expect(requireMock).toHaveBeenCalledWith(storeModulePath);
      expect(storeCtor).toHaveBeenCalledWith(
        join('/root/.angular/cache', 'angular-compiler.db')
      );
      expect(createCache).toHaveBeenCalledWith('jstransformer');
      expect(result?.cache).toBe(cache);

      await result?.close();
      expect(close).toHaveBeenCalled();
    }
  );

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
