import { JavaScriptTransformer, type Cache } from '@angular/build/private';
import { isAngularBuildVersionAtLeast } from './angular-build-version';
import { maxTransformWorkers, maxWorkers } from './utils';

type JavaScriptTransformerOptions = Omit<
  ConstructorParameters<typeof JavaScriptTransformer>[0],
  'maxConcurrency'
>;

/**
 * The `JavaScriptTransformer` API as it was before `@angular/build` 22.2,
 * which moved the per-transform flags into an options object.
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
  close(): Promise<void>;
}

type LegacyJavaScriptTransformerConstructor = new (
  options: JavaScriptTransformerOptions,
  maxThreads: number,
  cache?: Cache<Uint8Array>
) => JavaScriptTransformerAdapter;

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
    return new JavaScriptTransformer(options, maxWorkers(), cache);
  }

  const transformer = new JavaScriptTransformer(
    { ...options, maxConcurrency: maxTransformWorkers() },
    cache
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
    close: () => transformer.close(),
  };
}
