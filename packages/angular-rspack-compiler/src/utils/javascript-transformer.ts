import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { Cache, JavaScriptTransformer } from '@angular/build/private';
import { isAngularBuildVersionAtLeast } from './angular-build-version';
import { maxTransformWorkers, maxWorkers } from './utils';

type JavaScriptTransformerOptions = Omit<
  ConstructorParameters<typeof JavaScriptTransformer>[0],
  'maxConcurrency'
>;

/**
 * The `JavaScriptTransformer` API as it was before `@angular/build` 22.2,
 * which moved the per-transform flags into an options object, plus
 * `transformFileUncached`.
 */
export interface JavaScriptTransformerAdapter {
  transformData(
    filename: string,
    data: string,
    skipLinker: boolean,
    sideEffects?: boolean
  ): Promise<Uint8Array>;
  transformFile(
    filename: string,
    skipLinker?: boolean,
    sideEffects?: boolean
  ): Promise<Uint8Array>;
  /** Like `transformFile`, but never reads or writes the cache. */
  transformFileUncached(
    filename: string,
    skipLinker?: boolean,
    sideEffects?: boolean
  ): Promise<Uint8Array>;
  close(): Promise<void>;
}

type LegacyJavaScriptTransformerConstructor = new (
  options: JavaScriptTransformerOptions,
  maxThreads: number,
  cache?: Cache<Uint8Array>
) => Omit<JavaScriptTransformerAdapter, 'transformFileUncached'>;

// The declarations are those of the installed @angular/build, so only its
// version tells whether the class has the pre-22.2 constructor.
function hasLegacyConstructor(
  transformer: typeof JavaScriptTransformer
): transformer is LegacyJavaScriptTransformerConstructor &
  typeof JavaScriptTransformer {
  return !isAngularBuildVersionAtLeast('22.2.0');
}

/**
 * Creates the `@angular/build` JavaScript transformer for the installed
 * version, sized with that version's worker count, exposing the pre-22.2 API.
 */
export function createJavaScriptTransformer(
  options: JavaScriptTransformerOptions,
  cache?: Cache<Uint8Array>
): JavaScriptTransformerAdapter {
  if (hasLegacyConstructor(JavaScriptTransformer)) {
    const transformer = new JavaScriptTransformer(options, maxWorkers(), cache);
    return {
      transformData: transformer.transformData.bind(transformer),
      transformFile: transformer.transformFile.bind(transformer),
      // `transformData` never uses the cache before 22.2.
      transformFileUncached: async (filename, skipLinker, sideEffects) =>
        transformer.transformData(
          filename,
          await readFile(filename, 'utf8'),
          skipLinker,
          sideEffects
        ),
      close: transformer.close.bind(transformer),
    };
  }

  const skipCache = new AsyncLocalStorage<boolean>();
  const transformer = new JavaScriptTransformer(
    { ...options, maxConcurrency: maxTransformWorkers() },
    cache && createSkippableCache(cache, skipCache)
  );
  const toTransformOptions = (skipLinker?: boolean, sideEffects?: boolean) => ({
    skipLinker,
    sideEffects:
      sideEffects === undefined ? undefined : async () => sideEffects,
  });

  return {
    transformData: (filename, data, skipLinker, sideEffects) =>
      transformer.transformData(
        filename,
        data,
        toTransformOptions(skipLinker, sideEffects)
      ),
    transformFile: (filename, skipLinker, sideEffects) =>
      transformer.transformFile(
        filename,
        toTransformOptions(skipLinker, sideEffects)
      ),
    transformFileUncached: (filename, skipLinker, sideEffects) =>
      skipCache.run(true, () =>
        transformer.transformFile(
          filename,
          toTransformOptions(skipLinker, sideEffects)
        )
      ),
    close: () => transformer.close(),
  };
}

// `@angular/build` 20 does not export `Cache`, so it may only be referenced
// at runtime on the 22.2 path.
function createSkippableCache(
  cache: Cache<Uint8Array>,
  skipCache: AsyncLocalStorage<boolean>
): Cache<Uint8Array> {
  return new Cache<Uint8Array>({
    get: (key) => (skipCache.getStore() ? undefined : cache.get(key)),
    has: async (key) =>
      !skipCache.getStore() && (await cache.get(key)) !== undefined,
    async set(key, value) {
      if (!skipCache.getStore()) {
        await cache.put(key, value);
      }
      return this;
    },
  });
}
