import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Cache } from '@angular/build/private';

export interface JavascriptTransformerCache {
  cache: Cache<Uint8Array>;
  close(): Promise<void>;
}

interface LmdbCacheStoreLike {
  createCache<V>(namespace: string): Cache<V>;
  close(): Promise<void>;
}

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
  try {
    const requireFn = createRequire(__filename);
    const angularBuildDir = dirname(
      requireFn.resolve('@angular/build/package.json')
    );
    const { LmdbCacheStore } = requireFn(
      join(angularBuildDir, 'src/tools/esbuild/lmdb-cache-store.js')
    ) as { LmdbCacheStore: new (cachePath: string) => LmdbCacheStoreLike };
    const store = new LmdbCacheStore(
      join(persistentCachePath, 'angular-compiler.db')
    );
    return {
      cache: store.createCache('jstransformer'),
      close: () => store.close(),
    };
  } catch {
    return undefined;
  }
}
