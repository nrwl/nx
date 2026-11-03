import { join } from 'node:path';
import type { Cache } from '@angular/build/private';
import { requireAngularBuildFile } from './angular-build-file';

export interface JavascriptTransformerCache {
  cache: Cache<Uint8Array>;
  close(): Promise<void>;
}

interface LmdbCacheStoreLike {
  createCache<V>(namespace: string): Cache<V>;
  close(): Promise<void>;
}

// `@angular/build` 22.2 moved the store out of `src/tools/esbuild`.
const LMDB_CACHE_STORE_PATHS = [
  'src/utils/cache/lmdb-cache-store.js',
  'src/tools/esbuild/lmdb-cache-store.js',
];

/**
 * Creates the persistent store the esbuild application builder uses for
 * `JavaScriptTransformer` results, so Angular package linking is only paid
 * on the first build with a given cache directory.
 *
 * The LMDB-backed store is not part of `@angular/build`'s exported API and
 * its exports map blocks subpath imports, so it is loaded from the resolved
 * package location. Returns `undefined` when it cannot be loaded (older
 * `@angular/build` versions, platforms without lmdb prebuilds), in which
 * case the transformer runs uncached.
 */
export function createJavascriptTransformerCache(
  persistentCachePath: string
): JavascriptTransformerCache | undefined {
  for (const storePath of LMDB_CACHE_STORE_PATHS) {
    try {
      const {
        LmdbCacheStore,
      }: { LmdbCacheStore: new (cachePath: string) => LmdbCacheStoreLike } =
        requireAngularBuildFile(storePath);
      const store = new LmdbCacheStore(
        join(persistentCachePath, 'angular-compiler.db')
      );
      return {
        cache: store.createCache('jstransformer'),
        close: () => store.close(),
      };
    } catch {
      // Not loadable from this location; try the next one.
    }
  }
  return undefined;
}
